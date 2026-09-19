import "server-only";

import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { companiesHouse, companiesHouseWebUrl } from "@/lib/sources/companies-house/client";
import {
  normaliseCharge,
  normaliseFiling,
  normaliseOfficer,
  normalisePsc,
} from "@/lib/sources/companies-house/normalise";
import { normaliseCompanyNumber } from "@/lib/normalise/company-name";
import { linkEntities } from "@/lib/entity-resolution/resolve-company";

/**
 * Detail enrichment: officers, persons with significant control, filing
 * history and charges for a single company.
 *
 * Kept separate from discovery because these are four extra API calls per
 * company. Discovery covers the whole register cheaply; enrichment is driven
 * by a cron that picks the companies most in need of a refresh, plus an
 * on-demand path when a user opens a profile that has never been enriched.
 */

export type EnrichmentResult = {
  companyNumber: string;
  officers: number;
  pscs: number;
  filings: number;
  charges: number;
  events: number;
};

export async function syncCompanyDetail(rawCompanyNumber: string): Promise<EnrichmentResult> {
  const companyNumber = normaliseCompanyNumber(rawCompanyNumber);
  if (!companyNumber) {
    throw new Error(`"${rawCompanyNumber}" is not a valid company number`);
  }

  const company = await prisma.company.findUnique({
    where: { companyNumber },
    select: { id: true, name: true },
  });
  if (!company) {
    throw new Error(`Company ${companyNumber} has not been ingested yet`);
  }

  const log = logger.child({ connector: "companies_house_detail", companyNumber });
  const sourceUrl = companiesHouseWebUrl(companyNumber);
  const now = new Date();
  const result: EnrichmentResult = {
    companyNumber,
    officers: 0,
    pscs: 0,
    filings: 0,
    charges: 0,
    events: 0,
  };

  // --- Officers ------------------------------------------------------------
  const officerList = await companiesHouse.officers(companyNumber);
  for (const [index, officer] of (officerList?.items ?? []).entries()) {
    const normalised = normaliseOfficer(officer, index);
    if (!normalised.name) continue;

    await prisma.companyOfficer.upsert({
      where: { companyId_sourceId: { companyId: company.id, sourceId: normalised.sourceId } },
      create: {
        companyId: company.id,
        sourceId: normalised.sourceId,
        officerId: officer.links?.officer?.appointments ?? null,
        name: normalised.name,
        normalisedName: normalised.normalisedName,
        role: normalised.role,
        appointedOn: normalised.appointedOn,
        resignedOn: normalised.resignedOn,
        nationality: normalised.nationality,
        countryOfResidence: normalised.countryOfResidence,
        occupation: normalised.occupation,
        dobMonth: normalised.dobMonth,
        dobYear: normalised.dobYear,
        addressLocality: normalised.addressLocality,
        addressPostcode: normalised.addressPostcode,
        isActive: normalised.isActive,
        source: "companies_house",
        sourceUrl,
      },
      update: {
        name: normalised.name,
        normalisedName: normalised.normalisedName,
        role: normalised.role,
        resignedOn: normalised.resignedOn,
        isActive: normalised.isActive,
        lastSeenAt: now,
        lastUpdatedAt: now,
      },
    });
    result.officers += 1;

    if (normalised.appointedOn) {
      const created = await upsertEvent({
        companyId: company.id,
        type: "OFFICER_APPOINTED",
        title: `${normalised.name} appointed${normalised.role ? ` as ${formatRole(normalised.role)}` : ""}`,
        occurredAt: normalised.appointedOn,
        sourceEntityType: "company_officer",
        sourceEntityId: normalised.sourceId,
        sourceUrl,
      });
      if (created) result.events += 1;
    }

    if (normalised.resignedOn) {
      const created = await upsertEvent({
        companyId: company.id,
        type: "OFFICER_RESIGNED",
        title: `${normalised.name} resigned`,
        occurredAt: normalised.resignedOn,
        sourceEntityType: "company_officer",
        sourceEntityId: normalised.sourceId,
        sourceUrl,
      });
      if (created) result.events += 1;
    }
  }

  // --- Persons with significant control ------------------------------------
  const pscList = await companiesHouse.pscs(companyNumber);
  for (const [index, psc] of (pscList?.items ?? []).entries()) {
    const normalised = normalisePsc(psc, index);
    if (!normalised.name) continue;

    await prisma.companyPsc.upsert({
      where: { companyId_sourceId: { companyId: company.id, sourceId: normalised.sourceId } },
      create: {
        companyId: company.id,
        sourceId: normalised.sourceId,
        name: normalised.name,
        normalisedName: normalised.normalisedName,
        kind: normalised.kind,
        naturesOfControl: normalised.naturesOfControl,
        notifiedOn: normalised.notifiedOn,
        ceasedOn: normalised.ceasedOn,
        nationality: normalised.nationality,
        countryOfResidence: normalised.countryOfResidence,
        dobMonth: normalised.dobMonth,
        dobYear: normalised.dobYear,
        pscCompanyNumber: normalised.pscCompanyNumber,
        isActive: normalised.isActive,
        source: "companies_house",
        sourceUrl,
      },
      update: {
        ceasedOn: normalised.ceasedOn,
        isActive: normalised.isActive,
        naturesOfControl: normalised.naturesOfControl,
        lastSeenAt: now,
        lastUpdatedAt: now,
      },
    });
    result.pscs += 1;

    // A corporate PSC with a company number is a company-to-company ownership
    // edge in the intelligence graph.
    const ownerNumber = normaliseCompanyNumber(normalised.pscCompanyNumber);
    if (ownerNumber) {
      const owner = await prisma.company.findUnique({
        where: { companyNumber: ownerNumber },
        select: { id: true },
      });
      if (owner) {
        await linkEntities({
          fromType: "company",
          fromId: owner.id,
          toType: "company",
          toId: company.id,
          relation: "PSC_OF",
          confidence: 1,
          method: "companies_house_psc_registration_number",
          evidence: { naturesOfControl: normalised.naturesOfControl, sourceUrl },
        });
      }
    }
  }

  // --- Filing history ------------------------------------------------------
  const filingHistory = await companiesHouse.filingHistory(companyNumber);
  for (const filing of filingHistory?.items ?? []) {
    const normalised = normaliseFiling(filing);
    if (!normalised) continue;

    await prisma.companyFiling.upsert({
      where: {
        companyId_transactionId: {
          companyId: company.id,
          transactionId: normalised.transactionId,
        },
      },
      create: {
        companyId: company.id,
        transactionId: normalised.transactionId,
        category: normalised.category,
        subcategory: normalised.subcategory,
        type: normalised.type,
        description: normalised.description,
        descriptionValues: (normalised.descriptionValues ?? undefined) as never,
        date: normalised.date,
        pages: normalised.pages,
        documentUrl: normalised.documentUrl,
        source: "companies_house",
        sourceUrl,
      },
      update: { lastSeenAt: now },
    });
    result.filings += 1;

    if (normalised.date) {
      const created = await upsertEvent({
        companyId: company.id,
        type: "FILING",
        title: describeFiling(normalised.category, normalised.description),
        occurredAt: normalised.date,
        sourceEntityType: "company_filing",
        sourceEntityId: normalised.transactionId,
        sourceUrl,
      });
      if (created) result.events += 1;
    }
  }

  // --- Charges -------------------------------------------------------------
  const chargeList = await companiesHouse.charges(companyNumber);
  for (const [index, charge] of (chargeList?.items ?? []).entries()) {
    const normalised = normaliseCharge(charge, index);

    await prisma.companyCharge.upsert({
      where: { companyId_chargeId: { companyId: company.id, chargeId: normalised.chargeId } },
      create: {
        companyId: company.id,
        chargeId: normalised.chargeId,
        chargeCode: normalised.chargeCode,
        classification: normalised.classification,
        status: normalised.status,
        createdOn: normalised.createdOn,
        deliveredOn: normalised.deliveredOn,
        satisfiedOn: normalised.satisfiedOn,
        personsEntitled: normalised.personsEntitled,
        amountSecured: normalised.amountSecured,
        particulars: normalised.particulars,
        source: "companies_house",
        sourceUrl,
      },
      update: {
        status: normalised.status,
        satisfiedOn: normalised.satisfiedOn,
        lastSeenAt: now,
        lastUpdatedAt: now,
      },
    });
    result.charges += 1;

    if (normalised.createdOn) {
      const created = await upsertEvent({
        companyId: company.id,
        type: "CHARGE_CREATED",
        title: `Charge registered${normalised.personsEntitled[0] ? ` — ${normalised.personsEntitled[0]}` : ""}`,
        occurredAt: normalised.createdOn,
        sourceEntityType: "company_charge",
        sourceEntityId: normalised.chargeId,
        sourceUrl,
      });
      if (created) result.events += 1;
    }
  }

  await prisma.company.update({
    where: { id: company.id },
    data: { detailSyncedAt: now },
  });

  log.info("company detail synced", { ...result });
  return result;
}

async function upsertEvent(params: {
  companyId: string;
  type: "OFFICER_APPOINTED" | "OFFICER_RESIGNED" | "FILING" | "CHARGE_CREATED";
  title: string;
  occurredAt: Date;
  sourceEntityType: string;
  sourceEntityId: string;
  sourceUrl: string;
}): Promise<boolean> {
  const existing = await prisma.companyEvent.findUnique({
    where: {
      companyId_type_occurredAt_sourceEntityId: {
        companyId: params.companyId,
        type: params.type,
        occurredAt: params.occurredAt,
        sourceEntityId: params.sourceEntityId,
      },
    },
    select: { id: true },
  });
  if (existing) return false;

  await prisma.companyEvent.create({
    data: {
      companyId: params.companyId,
      type: params.type,
      title: params.title,
      occurredAt: params.occurredAt,
      sourceEntityType: params.sourceEntityType,
      sourceEntityId: params.sourceEntityId,
      source: "companies_house",
      sourceUrl: params.sourceUrl,
    },
  });
  return true;
}

function formatRole(role: string): string {
  return role.replace(/-/g, " ");
}

function describeFiling(category: string | null, description: string | null): string {
  if (description) {
    // Companies House descriptions are template keys such as
    // "accounts-with-accounts-type-micro-entity" when no rendered text exists.
    if (description.includes("-") && !description.includes(" ")) {
      return description.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
    }
    return description;
  }
  if (category) return `${category.replace(/-/g, " ")} filed`;
  return "Document filed";
}

/**
 * Picks the companies most in need of detail enrichment: never-enriched first,
 * then the stalest. Used by the daily cron.
 */
export async function selectCompaniesForEnrichment(limit: number): Promise<string[]> {
  const rows = await prisma.company.findMany({
    where: { isWelsh: true, status: { in: ["ACTIVE", "LIQUIDATION", "ADMINISTRATION"] } },
    select: { companyNumber: true },
    orderBy: [{ detailSyncedAt: { sort: "asc", nulls: "first" } }, { lastSeenAt: "desc" }],
    take: limit,
  });
  return rows.map((row) => row.companyNumber);
}
