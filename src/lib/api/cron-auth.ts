import "server-only";

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Guards the /api/cron/* routes.
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. The comparison is
 * constant-time so the secret cannot be recovered by timing the endpoint.
 * When CRON_SECRET is unset the routes refuse to run rather than defaulting to
 * open — an unauthenticated ingestion trigger would let anyone exhaust our
 * publisher API quota.
 */
export function authoriseCronRequest(request: Request): NextResponse | null {
  const env = getEnv();

  if (!env.CRON_SECRET) {
    logger.warn("cron request rejected: CRON_SECRET is not set");
    return NextResponse.json(
      {
        error: "not_configured",
        message:
          "CRON_SECRET is not set. Scheduled jobs are disabled until it is configured.",
      },
      { status: 503 }
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!constantTimeEquals(provided, env.CRON_SECRET)) {
    logger.warn("cron request rejected: bad secret");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return null;
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  // timingSafeEqual throws on length mismatch, so compare lengths separately.
  // The length of a secret is not itself sensitive.
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
