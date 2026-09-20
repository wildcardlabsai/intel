import { NextResponse } from "next/server";

import { authoriseCronRequest } from "@/lib/api/cron-auth";
import { prisma } from "@/lib/db/prisma";
import { getIntegrationStatuses } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Health and readiness.
 *
 * Two levels, because the two audiences are different. Unauthenticated callers
 * — an uptime monitor, a load balancer — get liveness and nothing else. A
 * caller holding CRON_SECRET gets the detail you actually want after a deploy:
 * which integrations are configured, whether migrations are applied, and how
 * fresh each source is.
 *
 * The detailed view still never returns a secret. It reports whether a
 * variable is set and, when it is not, its name — which .env.example already
 * publishes. Values are never read back.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const startedAt = Date.now();

  let database: { reachable: boolean; latencyMs: number | null; error?: string };
  try {
    const began = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    database = { reachable: true, latencyMs: Date.now() - began };
  } catch (error) {
    logger.error("health check: database unreachable", error);
    database = {
      reachable: false,
      latencyMs: null,
      error: error instanceof Error ? error.message : "unknown",
    };
  }

  // Liveness is the shallow answer: is this instance up and can it reach its
  // database. Anything more is only for an authorised caller.
  const authorised = authoriseCronRequest(request) === null;

  if (!authorised) {
    return NextResponse.json(
      {
        status: database.reachable ? "ok" : "degraded",
        database: { reachable: database.reachable },
        checkedAt: new Date().toISOString(),
      },
      {
        status: database.reachable ? 200 : 503,
        headers: { "cache-control": "no-store" },
      }
    );
  }

  const integrations = getIntegrationStatuses().map((integration) => ({
    key: integration.key,
    label: integration.label,
    configured: integration.configured,
    missingEnvVars: integration.missingEnvVars,
    impact: integration.configured ? undefined : integration.impact,
  }));

  let migrations: { applied: number; latest: string | null; pending: boolean } | null = null;
  let sources: Array<Record<string, unknown>> = [];
  let referenceData: Record<string, number> | null = null;

  if (database.reachable) {
    try {
      const rows = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`
        SELECT migration_name, finished_at
        FROM _prisma_migrations
        ORDER BY finished_at DESC NULLS FIRST
      `;
      migrations = {
        applied: rows.filter((row) => row.finished_at !== null).length,
        latest: rows.find((row) => row.finished_at !== null)?.migration_name ?? null,
        // A row with no finished_at is a migration that started and failed.
        pending: rows.some((row) => row.finished_at === null),
      };
    } catch {
      migrations = null;
    }

    try {
      const [registry, authorities, plans] = await Promise.all([
        prisma.dataSource.findMany({
          select: {
            key: true,
            name: true,
            status: true,
            totalRecords: true,
            lastSuccessAt: true,
            lastErrorAt: true,
          },
          orderBy: { name: "asc" },
        }),
        prisma.planningAuthority.count({ where: { status: "CONNECTED" } }),
        prisma.plan.count(),
      ]);

      sources = registry.map((source) => ({
        key: source.key,
        name: source.name,
        status: source.status,
        records: source.totalRecords,
        lastSuccessAt: source.lastSuccessAt?.toISOString() ?? null,
        staleDays: source.lastSuccessAt
          ? Math.floor((Date.now() - source.lastSuccessAt.getTime()) / 86_400_000)
          : null,
      }));

      referenceData = {
        localAuthorities: await prisma.localAuthority.count(),
        planningAuthoritiesConnected: authorities,
        plans,
      };
    } catch (error) {
      logger.warn("health check: could not read source registry", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // "Ready to serve" is a stricter bar than "alive": the database must be
  // reachable, migrations applied, and reference data seeded.
  const ready =
    database.reachable &&
    migrations !== null &&
    migrations.applied > 0 &&
    !migrations.pending &&
    (referenceData?.localAuthorities ?? 0) > 0;

  return NextResponse.json(
    {
      status: ready ? "ok" : database.reachable ? "not_ready" : "degraded",
      ready,
      checkedAt: new Date().toISOString(),
      tookMs: Date.now() - startedAt,
      database,
      migrations,
      referenceData,
      integrations,
      sources,
    },
    { status: database.reachable ? 200 : 503, headers: { "cache-control": "no-store" } }
  );
}
