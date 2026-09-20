import { NextResponse } from "next/server";

import { apiResponse, authenticateApiRequest, recordApiCall } from "@/lib/api/auth";
import { prisma } from "@/lib/db/prisma";
import { paginationSchema, procurementFilterSchema } from "@/lib/search/types";

/** GET /api/v1/procurement — search Welsh public procurement notices. */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = procurementFilterSchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    status: url.searchParams.getAll("status"),
    type: url.searchParams.getAll("type"),
    minValue: url.searchParams.get("minValue") ?? undefined,
    maxValue: url.searchParams.get("maxValue") ?? undefined,
    cpvPrefix: url.searchParams.get("cpv") ?? undefined,
    localAuthority: url.searchParams.get("localAuthority") ?? undefined,
    publishedFrom: url.searchParams.get("publishedFrom") ?? undefined,
    publishedTo: url.searchParams.get("publishedTo") ?? undefined,
    sort: url.searchParams.get("sort") ?? "relevance",
  });

  if (!parsed.success) {
    await recordApiCall(auth.apiKey, auth.user, "/api/v1/procurement", 400);
    return NextResponse.json(
      {
        error: "invalid_parameters",
        issues: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  const filters = parsed.data;
  const pagination = paginationSchema.parse({
    page: url.searchParams.get("page") ?? 1,
    perPage: url.searchParams.get("perPage") ?? 25,
  });

  const where = {
    ...(filters.q
      ? {
          OR: [
            { title: { contains: filters.q, mode: "insensitive" as const } },
            { description: { contains: filters.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(filters.status?.length ? { status: { in: filters.status as never[] } } : {}),
    ...(filters.type?.length ? { type: { in: filters.type as never[] } } : {}),
    ...(filters.minValue !== undefined ? { valueAmount: { gte: filters.minValue } } : {}),
    ...(filters.maxValue !== undefined ? { valueAmount: { lte: filters.maxValue } } : {}),
    ...(filters.cpvPrefix ? { cpvCodes: { hasSome: [filters.cpvPrefix] } } : {}),
    ...(filters.localAuthority ? { localAuthority: { slug: filters.localAuthority } } : {}),
    ...(filters.publishedFrom ? { publishedAt: { gte: new Date(filters.publishedFrom) } } : {}),
    ...(filters.publishedTo ? { publishedAt: { lte: new Date(filters.publishedTo) } } : {}),
  };

  const orderBy =
    filters.sort === "value_desc"
      ? { valueAmount: "desc" as const }
      : filters.sort === "value_asc"
        ? { valueAmount: "asc" as const }
        : filters.sort === "oldest"
          ? { publishedAt: "asc" as const }
          : { publishedAt: "desc" as const };

  const [notices, total] = await Promise.all([
    prisma.procurementNotice.findMany({
      where,
      orderBy,
      skip: (pagination.page - 1) * pagination.perPage,
      take: pagination.perPage,
      include: {
        buyer: { select: { name: true, companyNumber: true } },
        localAuthority: { select: { name: true } },
        awards: {
          include: { supplier: { select: { name: true, companyNumber: true } } },
        },
      },
    }),
    prisma.procurementNotice.count({ where }),
  ]);

  await recordApiCall(auth.apiKey, auth.user, "/api/v1/procurement", 200);

  return apiResponse(
    notices.map((notice) => ({
      ocid: notice.ocid,
      noticeId: notice.noticeId,
      title: notice.title,
      description: notice.description,
      type: notice.type,
      status: notice.status,
      value: notice.valueAmount,
      currency: notice.valueCurrency,
      publishedAt: notice.publishedAt,
      deadlineAt: notice.deadlineAt,
      cpvCodes: notice.cpvCodes,
      buyer: notice.buyer
        ? { name: notice.buyer.name, companyNumber: notice.buyer.companyNumber }
        : null,
      localAuthority: notice.localAuthority?.name ?? null,
      deliveryLocality: notice.deliveryLocality,
      awards: notice.awards.map((award) => ({
        awardId: award.awardId,
        supplier: award.supplier
          ? { name: award.supplier.name, companyNumber: award.supplier.companyNumber }
          : null,
        value: award.valueAmount,
        currency: award.valueCurrency,
        awardedAt: award.awardedAt,
      })),
      source: notice.source,
      sourceUrl: notice.sourceUrl,
      lastUpdatedAt: notice.lastUpdatedAt,
    })),
    {
      total,
      page: pagination.page,
      perPage: pagination.perPage,
      totalPages: Math.max(1, Math.ceil(total / pagination.perPage)),
    }
  );
}
