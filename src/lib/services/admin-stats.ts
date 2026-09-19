import "server-only";

import { prisma } from "@/lib/db/prisma";

/**
 * Time-windowed admin aggregates.
 *
 * These live outside the page components because computing a window boundary
 * needs the current time, which a React component body must not read.
 */

export async function countRecentImportErrors(withinHours: number): Promise<number> {
  const since = new Date(Date.now() - withinHours * 60 * 60 * 1000);
  return prisma.dataImportError.count({ where: { createdAt: { gte: since } } });
}

export async function countRecentImportRuns(withinHours: number): Promise<number> {
  const since = new Date(Date.now() - withinHours * 60 * 60 * 1000);
  return prisma.dataImportRun.count({ where: { startedAt: { gte: since } } });
}

export type DataQualityReport = {
  totalCompanies: number;
  missingLocation: number;
  missingPostcode: number;
  unresolvedSuppliers: number;
  unresolvedPlanningApplicants: number;
  lowConfidenceLinks: number;
  staleCompanies: number;
  unknownWelshStatus: number;
  duplicateNameGroups: number;
};

/**
 * Data quality counters. Nothing here is hidden or smoothed — the point is to
 * make bad data visible so it gets fixed.
 */
export async function getDataQualityReport(): Promise<DataQualityReport> {
  const staleBefore = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalCompanies,
    missingLocation,
    missingPostcode,
    unresolvedSuppliers,
    unresolvedPlanningApplicants,
    lowConfidenceLinks,
    staleCompanies,
    unknownWelshStatus,
    duplicateGroups,
  ] = await Promise.all([
    prisma.company.count(),
    prisma.company.count({ where: { isWelsh: true, latitude: null } }),
    prisma.company.count({ where: { isWelsh: true, postcode: null } }),
    prisma.procurementSupplier.count({ where: { resolvedCompanyId: null } }),
    prisma.planningApplication.count({
      where: { resolvedCompanyId: null, applicantName: { not: null } },
    }),
    prisma.entityLink.count({ where: { confidence: { lt: 0.8 } } }),
    prisma.company.count({ where: { isWelsh: true, lastSeenAt: { lt: staleBefore } } }),
    prisma.company.count({ where: { welshConfidence: "UNKNOWN" } }),
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM (
        SELECT normalised_name
        FROM companies
        WHERE is_welsh = true
        GROUP BY normalised_name
        HAVING COUNT(*) > 1
      ) duplicates
    `,
  ]);

  return {
    totalCompanies,
    missingLocation,
    missingPostcode,
    unresolvedSuppliers,
    unresolvedPlanningApplicants,
    lowConfidenceLinks,
    staleCompanies,
    unknownWelshStatus,
    duplicateNameGroups: Number(duplicateGroups[0]?.count ?? 0),
  };
}
