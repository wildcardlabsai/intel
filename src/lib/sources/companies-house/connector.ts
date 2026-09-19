import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getEnv } from "@/lib/env";
import { recordChanges } from "@/lib/ingestion/runner";
import type {
  Connector,
  ConnectorContext,
  FetchedRecord,
  StoreContext,
  StoreOutcome,
  ValidationResult,
} from "@/lib/ingestion/types";
import { lookupPostcode } from "@/lib/geo/postcodes";
import {
  companiesHouse,
  companiesHouseWebUrl,
} from "@/lib/sources/companies-house/client";
import {
  normaliseCompanyProfile,
  type NormalisedCompany,
} from "@/lib/sources/companies-house/normalise";
import type { ChCompanyProfile } from "@/lib/sources/companies-house/types";
import { classifyWelshLocation } from "@/lib/wales/classification";
import { WELSH_LOCAL_AUTHORITIES } from "@/lib/wales/local-authorities";

/**
 * Companies House connector.
 *
 * Discovery strategy
 * ------------------
 * There is no "all Welsh companies" endpoint. The advanced search endpoint
 * does support a free-text `location` filter matched against the registered
 * office address, so discovery walks a list of Welsh location terms (the 22
 * unitary authorities plus major towns), pages through each, and records every
 * company found. The cursor encodes "which term, how far into it", so a run
 * that hits its time budget resumes exactly where it stopped.
 *
 * Every candidate is then classified by address evidence (see
 * lib/wales/classification.ts). Companies that turn out not to be Welsh are
 * still stored with isWelsh = false rather than discarded, so we never
 * re-fetch them, and the classification is re-evaluated when the address
 * changes.
 */

/**
 * Location terms used for discovery. Authority names first, then towns whose
 * addresses commonly omit the authority name.
 */
export const WELSH_LOCATION_TERMS: string[] = [
  ...WELSH_LOCAL_AUTHORITIES.map((la) => la.name),
  "Cardiff",
  "Swansea",
  "Newport",
  "Wrexham",
  "Bangor",
  "Aberystwyth",
  "Llandudno",
  "Caernarfon",
  "Carmarthen",
  "Haverfordwest",
  "Bridgend",
  "Barry",
  "Neath",
  "Port Talbot",
  "Pontypridd",
  "Merthyr Tydfil",
  "Cwmbran",
  "Ebbw Vale",
  "Colwyn Bay",
  "Rhyl",
  "Mold",
  "Llanelli",
  "Brecon",
  "Newtown",
  "Welshpool",
  "Aberdare",
  "Caerphilly",
  "Pontypool",
  "Abergavenny",
  "Monmouth",
  "Chepstow",
  "Milford Haven",
  "Pembroke",
  "Cardigan",
  "Machynlleth",
  "Dolgellau",
  "Pwllheli",
  "Holyhead",
  "Llangefni",
  "Ruthin",
  "Denbigh",
  "Flint",
  "Buckley",
  "Connah's Quay",
  "Wales",
];

const PAGE_SIZE = 100;

type Cursor = { termIndex: number; startIndex: number };

function parseCursor(raw: string | null): Cursor {
  if (!raw) return { termIndex: 0, startIndex: 0 };
  try {
    const parsed = JSON.parse(raw) as Partial<Cursor>;
    return {
      termIndex: Number.isInteger(parsed.termIndex) ? (parsed.termIndex as number) : 0,
      startIndex: Number.isInteger(parsed.startIndex) ? (parsed.startIndex as number) : 0,
    };
  } catch {
    return { termIndex: 0, startIndex: 0 };
  }
}

export const companiesHouseConnector: Connector<ChCompanyProfile, NormalisedCompany> = {
  key: "companies_house_discovery",
  dataSourceKey: "companies_house",
  label: "Companies House — Welsh company discovery",

  readiness() {
    const env = getEnv();
    if (!env.COMPANIES_HOUSE_API_KEY) {
      return {
        ready: false,
        reason:
          "COMPANIES_HOUSE_API_KEY is not set. Register a free application key at " +
          "developer.company-information.service.gov.uk and add it to the environment.",
        missingEnvVars: ["COMPANIES_HOUSE_API_KEY"],
      };
    }
    return { ready: true };
  },

  async *fetch(context: ConnectorContext) {
    const cursor = parseCursor(context.cursor);
    let emitted = 0;

    for (let termIndex = cursor.termIndex; termIndex < WELSH_LOCATION_TERMS.length; termIndex += 1) {
      const term = WELSH_LOCATION_TERMS[termIndex];
      let startIndex = termIndex === cursor.termIndex ? cursor.startIndex : 0;

      for (;;) {
        if (context.signal?.aborted) {
          return JSON.stringify({ termIndex, startIndex } satisfies Cursor);
        }

        const response = await companiesHouse.advancedSearch({
          location: term,
          size: PAGE_SIZE,
          startIndex,
        });

        const items = response?.items ?? [];
        context.logger.debug("advanced search page", {
          term,
          startIndex,
          returned: items.length,
          hits: response?.hits,
        });

        if (items.length === 0) break;

        for (const item of items) {
          const companyNumber = item.company_number?.trim().toUpperCase();
          if (!companyNumber) continue;

          // Advanced search returns the fields we need for the register row.
          // The detail endpoints (officers, PSC, filings) are pulled by the
          // separate enrichment connector so that discovery stays inside the
          // API rate limit.
          const profile: ChCompanyProfile = {
            company_number: companyNumber,
            company_name: item.company_name,
            company_status: item.company_status,
            type: item.company_type,
            date_of_creation: item.date_of_creation,
            date_of_cessation: item.date_of_cessation,
            sic_codes: item.sic_codes,
            registered_office_address: item.registered_office_address,
          };

          yield {
            sourceRecordId: companyNumber,
            sourceUrl: companiesHouseWebUrl(companyNumber),
            raw: profile,
          } satisfies FetchedRecord<ChCompanyProfile>;

          emitted += 1;
          if (emitted >= context.limit) {
            return JSON.stringify({
              termIndex,
              startIndex: startIndex + items.length,
            } satisfies Cursor);
          }
        }

        startIndex += items.length;

        // The endpoint caps how deep paging can go; move on to the next term.
        if (items.length < PAGE_SIZE || startIndex >= 10_000) break;
      }
    }

    // A full pass finished — start the next run from the beginning so changes
    // to already-known companies are picked up.
    return JSON.stringify({ termIndex: 0, startIndex: 0 } satisfies Cursor);
  },

  validate(record): ValidationResult<ChCompanyProfile> {
    const profile = record.raw;
    if (!profile.company_number) {
      return { ok: false, reason: "Missing company_number" };
    }
    if (!profile.company_name) {
      return { ok: false, reason: `Company ${profile.company_number} has no company_name` };
    }
    return { ok: true, value: record };
  },

  normalise(record) {
    return normaliseCompanyProfile(record.raw);
  },

  async store(company, context) {
    return upsertCompany(company, context);
  },
};

/**
 * Upserts a company and its registered office, classifies it against Wales,
 * and records field-level changes plus timeline events.
 *
 * Shared by the discovery connector and the detail-enrichment connector.
 */
export async function upsertCompany(
  company: NormalisedCompany,
  context: StoreContext
): Promise<StoreOutcome> {
  // Authoritative country/authority resolution. Falls back to address-text
  // rules when the lookup is unavailable — never to a guess based on the name.
  const postcode = company.registeredOffice?.postcode ?? null;
  const lookup = await lookupPostcode(postcode);

  const classification = classifyWelshLocation({
    postcode,
    locality: company.registeredOffice?.locality,
    region: company.registeredOffice?.regionText,
    country: company.registeredOffice?.country,
    postcodeLookup: lookup
      ? {
          country: lookup.country,
          localAuthority: lookup.localAuthority,
          latitude: lookup.latitude,
          longitude: lookup.longitude,
        }
      : null,
  });

  const localAuthority = classification.localAuthoritySlug
    ? await prisma.localAuthority.findUnique({
        where: { slug: classification.localAuthoritySlug },
        select: { id: true },
      })
    : null;

  const existing = await prisma.company.findUnique({
    where: { companyNumber: company.companyNumber },
  });

  const now = new Date();
  const data = {
    name: company.name,
    normalisedName: company.normalisedName,
    previousNames: company.previousNames,
    status: company.status,
    statusDetail: company.statusDetail,
    companyType: company.companyType,
    jurisdiction: company.jurisdiction,
    incorporatedOn: company.incorporatedOn,
    dissolvedOn: company.dissolvedOn,
    sicCodes: company.sicCodes,
    accountsLastMadeUpTo: company.accountsLastMadeUpTo,
    accountsNextDue: company.accountsNextDue,
    accountsCategory: company.accountsCategory,
    confirmationStatementNextDue: company.confirmationStatementNextDue,
    sizeBand: company.sizeBand,
    hasInsolvencyHistory: company.hasInsolvencyHistory,
    hasCharges: company.hasCharges,
    isWelsh: classification.isWelsh,
    welshConfidence: classification.confidence,
    welshEvidence: classification.evidence,
    region: classification.region,
    localAuthorityId: localAuthority?.id ?? null,
    country: company.registeredOffice?.country ?? null,
    town: company.registeredOffice?.locality ?? null,
    postcode,
    latitude: lookup?.latitude ?? null,
    longitude: lookup?.longitude ?? null,
    source: "companies_house",
    sourceId: company.companyNumber,
    sourceUrl: companiesHouseWebUrl(company.companyNumber),
    rawRecordId: context.rawRecordId,
    lastSeenAt: now,
    lastUpdatedAt: now,
  } satisfies Prisma.CompanyUncheckedUpdateInput;

  if (!existing) {
    const created = await prisma.company.create({
      data: {
        companyNumber: company.companyNumber,
        ...data,
        firstSeenAt: now,
      } as Prisma.CompanyUncheckedCreateInput,
    });

    await upsertRegisteredOffice(created.id, company);
    await writeIncorporationEvent(created.id, company);
    return "created";
  }

  const changedFields = await recordChanges({
    entityType: "company",
    entityId: existing.id,
    before: existing as unknown as Record<string, unknown>,
    after: data as unknown as Record<string, unknown>,
    fields: [
      "name",
      "status",
      "statusDetail",
      "companyType",
      "postcode",
      "town",
      "sicCodes",
      "isWelsh",
      "region",
      "accountsNextDue",
      "hasCharges",
    ],
    dataSourceId: context.dataSourceId,
    runId: context.runId,
  });

  await prisma.company.update({
    where: { id: existing.id },
    data: data as Prisma.CompanyUncheckedUpdateInput,
  });

  await upsertRegisteredOffice(existing.id, company);

  // Turn notable changes into timeline entries.
  if (changedFields.includes("status")) {
    await prisma.companyEvent.upsert({
      where: {
        companyId_type_occurredAt_sourceEntityId: {
          companyId: existing.id,
          type: "STATUS_CHANGED",
          occurredAt: now,
          sourceEntityId: company.companyNumber,
        },
      },
      create: {
        companyId: existing.id,
        type: "STATUS_CHANGED",
        title: `Company status changed to ${formatStatus(company.status)}`,
        description: `Previously ${formatStatus(existing.status)}.`,
        occurredAt: now,
        sourceEntityType: "company",
        sourceEntityId: company.companyNumber,
        source: "companies_house",
        sourceUrl: companiesHouseWebUrl(company.companyNumber),
      },
      update: {},
    });
  }

  if (changedFields.includes("name")) {
    await prisma.companyEvent.upsert({
      where: {
        companyId_type_occurredAt_sourceEntityId: {
          companyId: existing.id,
          type: "NAME_CHANGED",
          occurredAt: now,
          sourceEntityId: company.companyNumber,
        },
      },
      create: {
        companyId: existing.id,
        type: "NAME_CHANGED",
        title: `Company renamed to ${company.name}`,
        description: `Previously ${existing.name}.`,
        occurredAt: now,
        sourceEntityType: "company",
        sourceEntityId: company.companyNumber,
        source: "companies_house",
        sourceUrl: companiesHouseWebUrl(company.companyNumber),
      },
      update: {},
    });

    // Old names become aliases so other datasets still resolve to this company.
    await prisma.companyAlias.upsert({
      where: {
        companyId_normalisedAlias: {
          companyId: existing.id,
          normalisedAlias: existing.normalisedName,
        },
      },
      create: {
        companyId: existing.id,
        alias: existing.name,
        normalisedAlias: existing.normalisedName,
        source: "companies_house",
        confidence: 1,
      },
      update: {},
    });
  }

  return changedFields.length > 0 ? "updated" : "skipped";
}

async function upsertRegisteredOffice(companyId: string, company: NormalisedCompany): Promise<void> {
  const address = company.registeredOffice;
  if (!address) return;

  const existing = await prisma.companyAddress.findFirst({
    where: { companyId, type: "REGISTERED_OFFICE", isCurrent: true },
  });

  const now = new Date();
  const payload = {
    careOf: address.careOf,
    premises: address.premises,
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    locality: address.locality,
    regionText: address.regionText,
    postcode: address.postcode,
    country: address.country,
    lastSeenAt: now,
    lastUpdatedAt: now,
  };

  if (existing) {
    await prisma.companyAddress.update({ where: { id: existing.id }, data: payload });
    return;
  }

  await prisma.companyAddress.create({
    data: {
      companyId,
      type: "REGISTERED_OFFICE",
      isCurrent: true,
      source: "companies_house",
      sourceUrl: companiesHouseWebUrl(company.companyNumber),
      ...payload,
    },
  });
}

async function writeIncorporationEvent(
  companyId: string,
  company: NormalisedCompany
): Promise<void> {
  if (!company.incorporatedOn) return;

  await prisma.companyEvent.upsert({
    where: {
      companyId_type_occurredAt_sourceEntityId: {
        companyId,
        type: "INCORPORATED",
        occurredAt: company.incorporatedOn,
        sourceEntityId: company.companyNumber,
      },
    },
    create: {
      companyId,
      type: "INCORPORATED",
      title: "Company incorporated",
      description: `${company.name} was incorporated at Companies House.`,
      occurredAt: company.incorporatedOn,
      sourceEntityType: "company",
      sourceEntityId: company.companyNumber,
      source: "companies_house",
      sourceUrl: companiesHouseWebUrl(company.companyNumber),
    },
    update: {},
  });
}

function formatStatus(status: string): string {
  return status.toLowerCase().replace(/_/g, " ");
}
