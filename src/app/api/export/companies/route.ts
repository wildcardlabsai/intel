import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/session";
import { checkUsage, getEntitlements, recordUsage } from "@/lib/billing/plans";
import { prisma } from "@/lib/db/prisma";
import { companyExportDataset } from "@/lib/export/companies";
import { exportFilename, toCsv } from "@/lib/export/dataset";
import { toPdf } from "@/lib/export/pdf";
import { toXlsx } from "@/lib/export/xlsx";
import { logger } from "@/lib/logger";
import { searchCompanies } from "@/lib/search/companies";
import { companyFilterSchema } from "@/lib/search/types";

/**
 * Company search export, in CSV, XLSX or PDF.
 *
 * All three formats are rendered from one dataset description, so the same
 * search always produces the same rows whichever format is chosen. Exports are
 * metered and capped by plan, and every row keeps its source and source URL so
 * exported data stays attributable once it leaves the platform, as the Open
 * Government Licence requires.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_ROWS_BULK = 10_000;
const MAX_ROWS_STANDARD = 1_000;
/** A PDF of a very long table is unusable, and slow to render. */
const MAX_ROWS_PDF = 2_000;

const formatSchema = z.enum(["csv", "xlsx", "pdf"]).default("csv");

const CONTENT_TYPES = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
} as const;

export async function GET(request: Request) {
  const user = await requireUser("/dashboard/exports");

  const entitlements = await getEntitlements(user);
  if (entitlements.limits.exportsPerMonth === 0) {
    return NextResponse.json(
      {
        error: "export_not_included",
        message: `Exports are not included in the ${entitlements.planName} plan.`,
      },
      { status: 403 }
    );
  }

  const usage = await checkUsage(user, "EXPORT");
  if (!usage.allowed) {
    return NextResponse.json({ error: "quota_exceeded", message: usage.reason }, { status: 429 });
  }

  const url = new URL(request.url);

  const format = formatSchema.safeParse(url.searchParams.get("format") ?? "csv");
  if (!format.success) {
    return NextResponse.json(
      { error: "invalid_format", message: "Supported formats are csv, xlsx and pdf." },
      { status: 400 }
    );
  }

  const parsed = companyFilterSchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    region: url.searchParams.get("region") ?? undefined,
    localAuthority: url.searchParams.get("localAuthority") ?? undefined,
    status: url.searchParams.getAll("status"),
    sicCodes: url.searchParams.getAll("sicCodes"),
    postcode: url.searchParams.get("postcode") ?? undefined,
    welshOnly: url.searchParams.get("welshOnly") ?? true,
    sort: url.searchParams.get("sort") ?? "name",
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_parameters" }, { status: 400 });
  }

  const ceiling = Math.min(
    entitlements.limits.bulkExport ? MAX_ROWS_BULK : MAX_ROWS_STANDARD,
    format.data === "pdf" ? MAX_ROWS_PDF : Number.MAX_SAFE_INTEGER
  );
  const requested = Number(url.searchParams.get("limit") ?? MAX_ROWS_STANDARD);
  const limit = Math.min(
    Number.isFinite(requested) ? Math.max(requested, 1) : MAX_ROWS_STANDARD,
    ceiling
  );

  const results = await searchCompanies(parsed.data, { page: 1, perPage: limit });

  const dataset = companyExportDataset(results.items, parsed.data, {
    // Only say the export was capped when rows were actually left behind.
    truncatedAt: results.total > results.items.length ? limit : undefined,
  });

  let body: string | Buffer;
  try {
    if (format.data === "xlsx") {
      body = await toXlsx(dataset);
    } else if (format.data === "pdf") {
      body = Buffer.from(await toPdf(dataset));
    } else {
      body = toCsv(dataset);
    }
  } catch (error) {
    logger.error("export rendering failed", error, {
      userId: user.id,
      format: format.data,
      rows: dataset.rows.length,
    });
    return NextResponse.json(
      { error: "export_failed", message: "The export could not be generated." },
      { status: 500 }
    );
  }

  await recordUsage(user, "EXPORT", {
    entity: "company",
    format: format.data,
    rows: dataset.rows.length,
    filters: parsed.data.q ?? null,
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      actorEmail: user.email,
      action: "export.companies",
      metadata: { rows: dataset.rows.length, format: format.data },
    },
  });

  logger.info("company export", {
    userId: user.id,
    rows: dataset.rows.length,
    format: format.data,
  });

  return new NextResponse(body as BodyInit, {
    headers: {
      "content-type": CONTENT_TYPES[format.data],
      "content-disposition": `attachment; filename="${exportFilename(dataset, format.data)}"`,
      "cache-control": "no-store",
    },
  });
}
