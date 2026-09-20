import { NextResponse } from "next/server";

import { authoriseCronRequest } from "@/lib/api/cron-auth";
import { listAllConnectors, resolveConnector } from "@/lib/ingestion/connectors";
import { runConnector } from "@/lib/ingestion/runner";
import { logger } from "@/lib/logger";

/**
 * Runs one connector. Called by Vercel Cron on the schedule in vercel.json,
 * and by administrators from Admin → Sources.
 *
 * `limit` caps records per invocation so a run always finishes inside the
 * platform's execution budget; the connector's cursor means the next run picks
 * up exactly where this one stopped.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ connector: string }> }
) {
  const unauthorised = authoriseCronRequest(request);
  if (unauthorised) return unauthorised;

  const { connector: connectorKey } = await params;
  const connector = await resolveConnector(connectorKey);

  if (!connector) {
    return NextResponse.json(
      {
        error: "unknown_connector",
        message: `No connector registered with key "${connectorKey}".`,
        available: (await listAllConnectors()).map((c) => c.key),
      },
      { status: 404 }
    );
  }

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 2_000);
  const backfill = url.searchParams.get("backfill") === "true";

  try {
    const result = await runConnector(connector, {
      trigger: backfill ? "BACKFILL" : "CRON",
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 50_000) : 2_000,
      ...(backfill ? { cursor: null } : {}),
    });

    if (result.notConfiguredReason) {
      return NextResponse.json(
        {
          status: "not_configured",
          connector: connector.key,
          message: result.notConfiguredReason,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: result.status.toLowerCase(),
      connector: connector.key,
      runId: result.runId,
      durationMs: result.durationMs,
      counters: result.counters,
      errorCount: result.errors.length,
    });
  } catch (error) {
    logger.error("cron connector run threw", error, { connector: connectorKey });
    return NextResponse.json(
      {
        status: "failed",
        connector: connector.key,
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/** Vercel Cron issues GET requests; behave identically. */
export async function GET(
  request: Request,
  context: { params: Promise<{ connector: string }> }
) {
  return POST(request, context);
}
