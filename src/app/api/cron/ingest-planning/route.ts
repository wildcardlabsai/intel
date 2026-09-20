import { NextResponse } from "next/server";

import { authoriseCronRequest } from "@/lib/api/cron-auth";
import { prisma } from "@/lib/db/prisma";
import { runConnector } from "@/lib/ingestion/runner";
import { logger } from "@/lib/logger";
import { createPlanningConnector } from "@/lib/sources/planning/connector";

/**
 * Runs every configured planning authority in turn.
 *
 * Planning has no national feed, so this fans out over the authorities that
 * have an adapter configured. One authority failing never stops the others:
 * each result is reported separately, and an authority whose configuration is
 * incomplete is reported as not configured with the reason, rather than as an
 * authority with no applications.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const unauthorised = authoriseCronRequest(request);
  if (unauthorised) return unauthorised;

  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? 500);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 20_000)
    : 500;
  const backfill = url.searchParams.get("backfill") === "true";

  const authorities = await prisma.planningAuthority.findMany({
    where: { connectorKey: { not: null } },
    orderBy: { name: "asc" },
  });

  const results: Array<Record<string, unknown>> = [];

  for (const authority of authorities) {
    const connector = createPlanningConnector(authority);
    const readiness = connector.readiness();

    if (!readiness.ready) {
      results.push({
        authority: authority.slug,
        status: "not_configured",
        message: readiness.reason,
      });
      // Keep the stored status honest so the planning page and admin agree.
      await prisma.planningAuthority.update({
        where: { id: authority.id },
        data: { status: "NOT_CONFIGURED", statusMessage: readiness.reason },
      });
      continue;
    }

    try {
      const result = await runConnector(connector, {
        trigger: backfill ? "BACKFILL" : "CRON",
        limit,
        ...(backfill ? { cursor: null } : {}),
      });

      await prisma.planningAuthority.update({
        where: { id: authority.id },
        data:
          result.status === "FAILED"
            ? {
                status: "ERROR",
                lastErrorAt: new Date(),
                lastError: result.errors[0]?.message ?? "Run failed.",
              }
            : {
                status: "CONNECTED",
                statusMessage: null,
                lastSuccessAt: new Date(),
                lastError: null,
              },
      });

      results.push({
        authority: authority.slug,
        status: result.status.toLowerCase(),
        counters: result.counters,
        errorCount: result.errors.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("planning connector run threw", error, { authority: authority.slug });

      await prisma.planningAuthority.update({
        where: { id: authority.id },
        data: { status: "ERROR", lastErrorAt: new Date(), lastError: message },
      });

      results.push({ authority: authority.slug, status: "failed", message });
    }
  }

  return NextResponse.json({
    authoritiesConfigured: authorities.length,
    results,
  });
}

/** Vercel Cron issues GET requests; behave identically. */
export async function GET(request: Request) {
  return POST(request);
}
