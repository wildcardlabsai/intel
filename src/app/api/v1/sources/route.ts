import { apiResponse, authenticateApiRequest, recordApiCall } from "@/lib/api/auth";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/v1/sources — the data source registry.
 *
 * Exposed so API consumers can see exactly which datasets are connected,
 * when they last synced, and under which licence, rather than having to
 * assume the data behind a response is complete.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await authenticateApiRequest(request);
  if (!auth.ok) return auth.response;

  const sources = await prisma.dataSource.findMany({
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: {
      key: true,
      name: true,
      organisation: true,
      category: true,
      description: true,
      homepageUrl: true,
      licence: true,
      licenceUrl: true,
      usageRestrictions: true,
      updateFrequency: true,
      status: true,
      statusMessage: true,
      lastSuccessAt: true,
      totalRecords: true,
    },
  });

  await recordApiCall(auth.apiKey, auth.user, "/api/v1/sources", 200);

  return apiResponse(sources, { total: sources.length });
}
