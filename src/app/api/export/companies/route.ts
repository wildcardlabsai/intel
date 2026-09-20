import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth/session";
import { checkUsage, getEntitlements, recordUsage } from "@/lib/billing/plans";
import { prisma } from "@/lib/db/prisma";
import { searchCompanies } from "@/lib/search/companies";
import { companyFilterSchema } from "@/lib/search/types";
import { logger } from "@/lib/logger";

/**
 * CSV export of a company search.
 *
 * Exports are metered and capped by plan. Every row keeps its source and
 * source URL so exported data stays attributable once it leaves the platform,
 * as the Open Government Licence requires.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_ROWS = 10_000;

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

  const requested = Number(url.searchParams.get("limit") ?? 1_000);
  const limit = Math.min(
    Number.isFinite(requested) ? Math.max(requested, 1) : 1_000,
    entitlements.limits.bulkExport ? MAX_ROWS : 1_000
  );

  const results = await searchCompanies(parsed.data, { page: 1, perPage: limit });

  const header = [
    "company_number",
    "name",
    "status",
    "incorporated_on",
    "town",
    "postcode",
    "local_authority",
    "region",
    "sic_codes",
    "size_band",
    "latitude",
    "longitude",
    "source",
    "source_url",
    "last_updated_at",
  ];

  const rows = results.items.map((company) => [
    company.companyNumber,
    company.name,
    company.status,
    company.incorporatedOn?.toISOString().slice(0, 10) ?? "",
    company.town ?? "",
    company.postcode ?? "",
    company.localAuthorityName ?? "",
    company.region ?? "",
    company.sicCodes.join(" "),
    company.sizeBand ?? "",
    company.latitude?.toString() ?? "",
    company.longitude?.toString() ?? "",
    company.source,
    company.sourceUrl ?? "",
    company.lastUpdatedAt.toISOString(),
  ]);

  const csv = [header, ...rows].map(toCsvRow).join("\r\n");

  await recordUsage(user, "EXPORT", {
    entity: "company",
    rows: rows.length,
    filters: parsed.data.q ?? null,
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      actorEmail: user.email,
      action: "export.companies",
      metadata: { rows: rows.length },
    },
  });

  logger.info("csv export", { userId: user.id, rows: rows.length });

  const filename = `cymru-intelligence-companies-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

/**
 * RFC 4180 quoting. A leading =, +, - or @ is prefixed with a single quote so
 * a spreadsheet cannot interpret an exported value as a formula.
 */
function toCsvRow(values: string[]): string {
  return values
    .map((value) => {
      const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
      return `"${safe.replace(/"/g, '""')}"`;
    })
    .join(",");
}
