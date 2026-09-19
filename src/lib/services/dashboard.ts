import "server-only";

import { prisma } from "@/lib/db/prisma";

/**
 * Dashboard aggregates.
 *
 * Every figure here is a live count from the database. When nothing has been
 * ingested the counts are genuinely zero and the UI says so — no figure on
 * this platform is ever estimated, sampled or filled in.
 */

export type DashboardMetric = {
  key: string;
  label: string;
  value: number;
  /** Count added in the last 30 days, when the entity records a first-seen date. */
  recent: number | null;
  href: string;
  source: string;
};

export type DashboardSummary = {
  metrics: DashboardMetric[];
  totalRecords: number;
  lastSyncAt: Date | null;
  connectedSources: number;
  totalSources: number;
  hasAnyData: boolean;
};

function thirtyDaysAgo(): Date {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const since = thirtyDaysAgo();

  const [
    welshCompanies,
    recentCompanies,
    planningApplications,
    recentPlanning,
    procurementNotices,
    recentProcurement,
    fundingOpportunities,
    openFunding,
    sources,
    lastRun,
  ] = await Promise.all([
    prisma.company.count({ where: { isWelsh: true } }),
    prisma.company.count({ where: { isWelsh: true, firstSeenAt: { gte: since } } }),
    prisma.planningApplication.count(),
    prisma.planningApplication.count({ where: { firstSeenAt: { gte: since } } }),
    prisma.procurementNotice.count(),
    prisma.procurementNotice.count({ where: { firstSeenAt: { gte: since } } }),
    prisma.fundingOpportunity.count(),
    prisma.fundingOpportunity.count({ where: { status: { in: ["OPEN", "CLOSING_SOON"] } } }),
    prisma.dataSource.findMany({ select: { status: true, lastSuccessAt: true } }),
    prisma.dataImportRun.findFirst({
      where: { status: { in: ["SUCCESS", "PARTIAL"] } },
      orderBy: { finishedAt: "desc" },
      select: { finishedAt: true },
    }),
  ]);

  const metrics: DashboardMetric[] = [
    {
      key: "companies",
      label: "Welsh companies",
      value: welshCompanies,
      recent: recentCompanies,
      href: "/dashboard/companies",
      source: "companies_house",
    },
    {
      key: "procurement",
      label: "Procurement notices",
      value: procurementNotices,
      recent: recentProcurement,
      href: "/dashboard/procurement",
      source: "sell2wales",
    },
    {
      key: "planning",
      label: "Planning applications",
      value: planningApplications,
      recent: recentPlanning,
      href: "/dashboard/planning",
      source: "planning_wales",
    },
    {
      key: "funding",
      label: "Open funding schemes",
      value: openFunding,
      recent: null,
      href: "/dashboard/funding",
      source: "funding_wales",
    },
  ];

  const totalRecords =
    welshCompanies + planningApplications + procurementNotices + fundingOpportunities;

  return {
    metrics,
    totalRecords,
    lastSyncAt: lastRun?.finishedAt ?? null,
    connectedSources: sources.filter((s) => s.status === "CONNECTED").length,
    totalSources: sources.length,
    hasAnyData: totalRecords > 0,
  };
}

export type ActivityItem = {
  id: string;
  kind: "company" | "procurement" | "planning" | "funding";
  title: string;
  subtitle: string | null;
  occurredAt: Date;
  href: string;
  source: string;
  sourceUrl: string | null;
};

/** Most recent activity across every connected dataset. */
export async function getRecentActivity(limit = 12): Promise<ActivityItem[]> {
  const [companies, notices, planning, funding] = await Promise.all([
    prisma.company.findMany({
      where: { isWelsh: true },
      orderBy: { firstSeenAt: "desc" },
      take: limit,
      select: {
        id: true,
        companyNumber: true,
        name: true,
        town: true,
        incorporatedOn: true,
        firstSeenAt: true,
        source: true,
        sourceUrl: true,
      },
    }),
    prisma.procurementNotice.findMany({
      orderBy: { publishedAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        publishedAt: true,
        firstSeenAt: true,
        valueAmount: true,
        valueCurrency: true,
        source: true,
        sourceUrl: true,
        buyer: { select: { name: true } },
      },
    }),
    prisma.planningApplication.findMany({
      orderBy: { firstSeenAt: "desc" },
      take: limit,
      select: {
        id: true,
        reference: true,
        description: true,
        siteAddress: true,
        submittedOn: true,
        firstSeenAt: true,
        source: true,
        sourceUrl: true,
      },
    }),
    prisma.fundingOpportunity.findMany({
      orderBy: { firstSeenAt: "desc" },
      take: limit,
      select: {
        id: true,
        title: true,
        organisationName: true,
        closesAt: true,
        firstSeenAt: true,
        source: true,
        sourceUrl: true,
      },
    }),
  ]);

  const items: ActivityItem[] = [
    ...companies.map((company) => ({
      id: company.id,
      kind: "company" as const,
      title: company.name,
      subtitle: company.town ? `New company · ${company.town}` : "New company",
      occurredAt: company.incorporatedOn ?? company.firstSeenAt,
      href: `/dashboard/companies/${company.companyNumber}`,
      source: company.source,
      sourceUrl: company.sourceUrl,
    })),
    ...notices.map((notice) => ({
      id: notice.id,
      kind: "procurement" as const,
      title: notice.title,
      subtitle: notice.buyer?.name ? `Contract · ${notice.buyer.name}` : "Contract notice",
      occurredAt: notice.publishedAt ?? notice.firstSeenAt,
      href: `/dashboard/procurement/${notice.id}`,
      source: notice.source,
      sourceUrl: notice.sourceUrl,
    })),
    ...planning.map((application) => ({
      id: application.id,
      kind: "planning" as const,
      title: application.description ?? application.reference,
      subtitle: application.siteAddress ? `Planning · ${application.siteAddress}` : "Planning application",
      occurredAt: application.submittedOn ?? application.firstSeenAt,
      href: `/dashboard/planning/${application.id}`,
      source: application.source,
      sourceUrl: application.sourceUrl,
    })),
    ...funding.map((opportunity) => ({
      id: opportunity.id,
      kind: "funding" as const,
      title: opportunity.title,
      subtitle: opportunity.organisationName ? `Funding · ${opportunity.organisationName}` : "Funding",
      occurredAt: opportunity.firstSeenAt,
      href: `/dashboard/funding/${opportunity.id}`,
      source: opportunity.source,
      sourceUrl: opportunity.sourceUrl,
    })),
  ];

  return items
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, limit);
}

export type SectorCount = { sectorName: string; count: number };

/** Top sectors by Welsh company count, derived from SIC code mappings. */
export async function getTopSectors(limit = 6): Promise<SectorCount[]> {
  const rows = await prisma.$queryRaw<Array<{ name: string; count: bigint }>>`
    SELECT s.name, COUNT(*)::bigint AS count
    FROM companies c
    JOIN sectors s ON s.id = c.primary_sector_id
    WHERE c.is_welsh = true
    GROUP BY s.name
    ORDER BY count DESC
    LIMIT ${limit}
  `;
  return rows.map((row) => ({ sectorName: row.name, count: Number(row.count) }));
}

export type LocationCount = { name: string; slug: string; count: number };

/** Top local authorities by Welsh company count. */
export async function getTopLocations(limit = 6): Promise<LocationCount[]> {
  const rows = await prisma.$queryRaw<Array<{ name: string; slug: string; count: bigint }>>`
    SELECT la.name, la.slug, COUNT(*)::bigint AS count
    FROM companies c
    JOIN local_authorities la ON la.id = c.local_authority_id
    WHERE c.is_welsh = true
    GROUP BY la.name, la.slug
    ORDER BY count DESC
    LIMIT ${limit}
  `;
  return rows.map((row) => ({
    name: row.name,
    slug: row.slug,
    count: Number(row.count),
  }));
}
