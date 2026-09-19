import "server-only";

import { prisma } from "@/lib/db/prisma";
import { normaliseCompanyNumber } from "@/lib/normalise/company-name";

/**
 * Everything needed to render a company profile, assembled from every
 * connected source. Each section carries its own provenance so the page can
 * attribute individual facts rather than the page as a whole.
 */

export async function getCompanyProfile(rawCompanyNumber: string) {
  const companyNumber = normaliseCompanyNumber(rawCompanyNumber);
  if (!companyNumber) return null;

  const company = await prisma.company.findUnique({
    where: { companyNumber },
    include: {
      localAuthority: { select: { name: true, slug: true, region: true } },
      primarySector: { select: { name: true, slug: true } },
      addresses: { where: { isCurrent: true }, orderBy: { type: "asc" } },
      officers: {
        orderBy: [{ isActive: "desc" }, { appointedOn: "desc" }],
        take: 50,
      },
      pscs: { orderBy: [{ isActive: "desc" }, { notifiedOn: "desc" }], take: 25 },
      filings: { orderBy: { date: "desc" }, take: 25 },
      charges: { orderBy: { createdOn: "desc" }, take: 25 },
      industries: { include: { sicCode: { select: { code: true, description: true } } } },
      _count: { select: { officers: true, filings: true, charges: true, pscs: true } },
    },
  });

  if (!company) return null;

  const [timeline, procurementAwards, planningApplications, fundingAwards, relatedCompanies, jobs] =
    await Promise.all([
      prisma.companyEvent.findMany({
        where: { companyId: company.id },
        orderBy: { occurredAt: "desc" },
        take: 100,
      }),
      prisma.procurementAward.findMany({
        where: { supplier: { resolvedCompanyId: company.id } },
        orderBy: { awardedAt: "desc" },
        take: 25,
        include: {
          notice: {
            select: {
              id: true,
              title: true,
              ocid: true,
              buyer: { select: { name: true } },
              sourceUrl: true,
              source: true,
            },
          },
          supplier: { select: { name: true, resolutionConfidence: true } },
        },
      }),
      prisma.planningApplication.findMany({
        where: { resolvedCompanyId: company.id },
        orderBy: { submittedOn: "desc" },
        take: 25,
        include: { authority: { select: { name: true } } },
      }),
      prisma.fundingAward.findMany({
        where: { resolvedCompanyId: company.id },
        orderBy: { awardedAt: "desc" },
        take: 25,
        include: { opportunity: { select: { title: true, organisationName: true } } },
      }),
      getRelatedCompanies(company.id),
      prisma.jobPosting.findMany({
        where: { companyId: company.id },
        orderBy: { postedAt: "desc" },
        take: 10,
      }),
    ]);

  const sourcesUsed = new Set<string>([company.source]);
  for (const award of procurementAwards) sourcesUsed.add(award.source);
  for (const application of planningApplications) sourcesUsed.add(application.source);
  for (const award of fundingAwards) sourcesUsed.add(award.source);

  return {
    company,
    timeline,
    procurementAwards,
    planningApplications,
    fundingAwards,
    relatedCompanies,
    jobs,
    sourcesUsed: [...sourcesUsed],
  };
}

export type CompanyProfile = NonNullable<Awaited<ReturnType<typeof getCompanyProfile>>>;

/**
 * Companies connected through the intelligence graph: shared officers, PSC
 * ownership, or any explicit edge recorded during ingestion.
 */
async function getRelatedCompanies(companyId: string) {
  const links = await prisma.entityLink.findMany({
    where: {
      OR: [
        { fromType: "company", fromId: companyId, toType: "company" },
        { toType: "company", toId: companyId, fromType: "company" },
      ],
    },
    orderBy: { confidence: "desc" },
    take: 20,
  });

  const relatedIds = links.map((link) => (link.fromId === companyId ? link.toId : link.fromId));

  // Companies sharing an active officer are related even without an explicit
  // edge, so they are found by name match across appointments.
  const sharedOfficerRows = await prisma.$queryRaw<
    Array<{ id: string; company_number: string; name: string; officer_name: string }>
  >`
    SELECT DISTINCT other.id, other.company_number, other.name, o2.name AS officer_name
    FROM company_officers o1
    JOIN company_officers o2
      ON o2.normalised_name = o1.normalised_name
     AND o2.company_id <> o1.company_id
    JOIN companies other ON other.id = o2.company_id
    WHERE o1.company_id = ${companyId}::uuid
      AND o1.is_active = true
      AND o2.is_active = true
      AND length(o1.normalised_name) > 6
    LIMIT 15
  `;

  const linked = relatedIds.length
    ? await prisma.company.findMany({
        where: { id: { in: relatedIds } },
        select: { id: true, companyNumber: true, name: true, status: true, town: true },
      })
    : [];

  return {
    linked: linked.map((company) => {
      const link = links.find((l) => l.fromId === company.id || l.toId === company.id);
      return {
        ...company,
        relation: link?.relation ?? "RELATED_TO",
        confidence: link?.confidence ?? 0,
      };
    }),
    sharedOfficers: sharedOfficerRows.map((row) => ({
      id: row.id,
      companyNumber: row.company_number,
      name: row.name,
      officerName: row.officer_name,
    })),
  };
}

/** Records a "user saved this company" relationship. */
export async function isCompanySaved(userId: string, companyId: string): Promise<boolean> {
  const saved = await prisma.savedCompany.findUnique({
    where: { userId_companyId: { userId, companyId } },
    select: { id: true },
  });
  return saved !== null;
}
