import { NextResponse } from "next/server";

import { apiResponse, authenticateApiRequest, recordApiCall } from "@/lib/api/auth";
import { companiesHouseWebUrl } from "@/lib/sources/companies-house/client";
import { searchCompanies } from "@/lib/search/companies";
import { companyFilterSchema, paginationSchema } from "@/lib/search/types";

/**
 * GET /api/v1/companies — search Welsh companies.
 *
 * Every record carries its source and a link back to the publisher, so API
 * consumers can attribute the data exactly as the licence requires.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);

  const filtersResult = companyFilterSchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    status: url.searchParams.getAll("status"),
    sicCodes: url.searchParams.getAll("sic"),
    region: url.searchParams.get("region") ?? undefined,
    localAuthority: url.searchParams.get("localAuthority") ?? undefined,
    postcode: url.searchParams.get("postcode") ?? undefined,
    incorporatedFrom: url.searchParams.get("incorporatedFrom") ?? undefined,
    incorporatedTo: url.searchParams.get("incorporatedTo") ?? undefined,
    welshOnly: url.searchParams.get("welshOnly") ?? true,
    sort: url.searchParams.get("sort") ?? "relevance",
  });

  if (!filtersResult.success) {
    await recordApiCall(auth.apiKey, auth.user, "/api/v1/companies", 400);
    return NextResponse.json(
      {
        error: "invalid_parameters",
        message: "One or more query parameters are invalid.",
        issues: filtersResult.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  const pagination = paginationSchema.parse({
    page: url.searchParams.get("page") ?? 1,
    perPage: url.searchParams.get("perPage") ?? 25,
  });

  const results = await searchCompanies(filtersResult.data, pagination);
  await recordApiCall(auth.apiKey, auth.user, "/api/v1/companies", 200);

  return apiResponse(
    results.items.map((company) => ({
      companyNumber: company.companyNumber,
      name: company.name,
      status: company.status,
      incorporatedOn: company.incorporatedOn,
      town: company.town,
      postcode: company.postcode,
      region: company.region,
      localAuthority: company.localAuthorityName,
      sicCodes: company.sicCodes,
      sizeBand: company.sizeBand,
      latitude: company.latitude,
      longitude: company.longitude,
      source: company.source,
      sourceUrl: company.sourceUrl ?? companiesHouseWebUrl(company.companyNumber),
      lastUpdatedAt: company.lastUpdatedAt,
    })),
    {
      total: results.total,
      page: results.page,
      perPage: results.perPage,
      totalPages: results.totalPages,
      query: results.query,
    }
  );
}
