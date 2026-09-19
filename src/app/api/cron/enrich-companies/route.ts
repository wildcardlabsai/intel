import { NextResponse } from "next/server";

import { authoriseCronRequest } from "@/lib/api/cron-auth";
import { isConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  selectCompaniesForEnrichment,
  syncCompanyDetail,
} from "@/lib/sources/companies-house/enrich";

/**
 * Pulls officers, PSCs, filings and charges for the companies most in need of
 * a refresh.
 *
 * Each company costs four Companies House requests, so the batch size is kept
 * well inside the published rate limit of 600 requests per five minutes.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_BATCH = 25;

export async function POST(request: Request) {
  const unauthorised = authoriseCronRequest(request);
  if (unauthorised) return unauthorised;

  if (!isConfigured("companies_house")) {
    return NextResponse.json(
      {
        status: "not_configured",
        message: "COMPANIES_HOUSE_API_KEY is not set, so company detail cannot be fetched.",
      },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const requested = Number(url.searchParams.get("limit") ?? DEFAULT_BATCH);
  const batchSize = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 100) : DEFAULT_BATCH;

  const companyNumbers = await selectCompaniesForEnrichment(batchSize);

  const results = { processed: 0, failed: 0, officers: 0, filings: 0, charges: 0, pscs: 0 };

  for (const companyNumber of companyNumbers) {
    try {
      const result = await syncCompanyDetail(companyNumber);
      results.processed += 1;
      results.officers += result.officers;
      results.filings += result.filings;
      results.charges += result.charges;
      results.pscs += result.pscs;
    } catch (error) {
      // One company failing must not stop the batch.
      results.failed += 1;
      logger.warn("company enrichment failed", {
        companyNumber,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({ status: "ok", candidates: companyNumbers.length, ...results });
}

export async function GET(request: Request) {
  return POST(request);
}
