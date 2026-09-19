import type { ProcurementNoticeType, ProcurementStatus } from "@/generated/prisma/enums";
import {
  companyNumberFromOcdsIdentifier,
  normaliseCompanyName,
} from "@/lib/normalise/company-name";
import { normalisePostcode } from "@/lib/wales/classification";
import type {
  OcdsAward,
  OcdsDocument,
  OcdsOrganisation,
  OcdsRelease,
} from "@/lib/sources/sell2wales/types";

/**
 * Pure OCDS → Cymru Intelligence mappers. No I/O, so every rule is testable.
 */

/**
 * OCDS release tags describe what the release is. The most specific tag wins,
 * because a release commonly carries several (e.g. ["tender", "award"]).
 */
const TAG_PRIORITY: Array<[string, ProcurementNoticeType]> = [
  ["awardUpdate", "CONTRACT_AWARD"],
  ["award", "CONTRACT_AWARD"],
  ["contractAmendment", "MODIFICATION"],
  ["contractUpdate", "CONTRACT_IMPLEMENTATION"],
  ["contract", "CONTRACT_IMPLEMENTATION"],
  ["tenderAmendment", "MODIFICATION"],
  ["tenderUpdate", "TENDER"],
  ["tender", "TENDER"],
  ["planningUpdate", "PRIOR_INFORMATION"],
  ["planning", "PRIOR_INFORMATION"],
];

export function mapNoticeType(release: OcdsRelease): ProcurementNoticeType {
  const tags = (release.tag ?? []).map((tag) => tag.trim());
  for (const [tag, type] of TAG_PRIORITY) {
    if (tags.includes(tag)) return type;
  }

  const method = release.tender?.procurementMethodDetails?.toLowerCase() ?? "";
  if (method.includes("framework")) return "FRAMEWORK";
  if (method.includes("quotation")) return "QUOTATION";

  return "UNKNOWN";
}

const TENDER_STATUS_MAP: Record<string, ProcurementStatus> = {
  planning: "PLANNING",
  planned: "PLANNING",
  active: "ACTIVE",
  cancelled: "CANCELLED",
  unsuccessful: "UNSUCCESSFUL",
  complete: "COMPLETE",
  withdrawn: "WITHDRAWN",
};

const AWARD_STATUS_MAP: Record<string, ProcurementStatus> = {
  pending: "ACTIVE",
  active: "AWARDED",
  cancelled: "CANCELLED",
  unsuccessful: "UNSUCCESSFUL",
};

export function mapStatus(release: OcdsRelease): ProcurementStatus {
  // An award present and active is the strongest statement about the process.
  const award = release.awards?.find((a) => a.status === "active") ?? release.awards?.[0];
  if (award?.status) {
    const mapped = AWARD_STATUS_MAP[award.status.toLowerCase()];
    if (mapped) return mapped;
  }
  if (release.awards?.length) return "AWARDED";

  const tenderStatus = release.tender?.status?.toLowerCase();
  if (tenderStatus) {
    const mapped = TENDER_STATUS_MAP[tenderStatus];
    if (mapped) return mapped;
  }

  return "UNKNOWN";
}

/** OCDS dates are ISO 8601. Invalid values are dropped, never coerced. */
export function parseOcdsDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export type NormalisedOrganisation = {
  sourceId: string;
  name: string;
  normalisedName: string;
  identifierScheme: string | null;
  identifierId: string | null;
  companyNumber: string | null;
  addressLocality: string | null;
  postcode: string | null;
  country: string | null;
  isSme: boolean | null;
  contactEmail: string | null;
  website: string | null;
};

export function normaliseOrganisation(
  org: OcdsOrganisation | undefined,
  fallbackId: string
): NormalisedOrganisation | null {
  if (!org) return null;

  const name = org.name?.trim() ?? org.identifier?.legalName?.trim();
  if (!name) return null;

  // Prefer the primary identifier, then look through additional identifiers
  // for a Companies House number — that is what makes the supplier resolvable.
  let companyNumber = companyNumberFromOcdsIdentifier(org.identifier?.scheme, org.identifier?.id);
  if (!companyNumber) {
    for (const extra of org.additionalIdentifiers ?? []) {
      companyNumber = companyNumberFromOcdsIdentifier(extra.scheme, extra.id);
      if (companyNumber) break;
    }
  }

  const scale = org.details?.scale?.toLowerCase();

  return {
    sourceId: org.id?.trim() || `${normaliseCompanyName(name)}:${fallbackId}`,
    name,
    normalisedName: normaliseCompanyName(name),
    identifierScheme: org.identifier?.scheme ?? null,
    identifierId: org.identifier?.id ?? null,
    companyNumber,
    addressLocality: org.address?.locality ?? null,
    postcode: normalisePostcode(org.address?.postalCode) ?? org.address?.postalCode ?? null,
    country: org.address?.countryName ?? null,
    isSme: scale ? scale === "sme" || scale === "small" || scale === "micro" : null,
    contactEmail: org.contactPoint?.email ?? null,
    website: org.contactPoint?.url ?? null,
  };
}

export type NormalisedAward = {
  awardId: string;
  title: string | null;
  description: string | null;
  status: ProcurementStatus;
  valueAmount: number | null;
  valueCurrency: string | null;
  awardedAt: Date | null;
  contractStartAt: Date | null;
  contractEndAt: Date | null;
  suppliers: NormalisedOrganisation[];
};

export function normaliseAward(award: OcdsAward, index: number): NormalisedAward {
  return {
    awardId: award.id?.trim() || String(index),
    title: award.title ?? null,
    description: award.description ?? null,
    status: award.status
      ? AWARD_STATUS_MAP[award.status.toLowerCase()] ?? "UNKNOWN"
      : "UNKNOWN",
    valueAmount: typeof award.value?.amount === "number" ? award.value.amount : null,
    valueCurrency: award.value?.currency ?? null,
    awardedAt: parseOcdsDate(award.date),
    contractStartAt: parseOcdsDate(award.contractPeriod?.startDate),
    contractEndAt: parseOcdsDate(award.contractPeriod?.endDate),
    suppliers: (award.suppliers ?? [])
      .map((supplier, supplierIndex) =>
        normaliseOrganisation(supplier, `${award.id ?? index}:${supplierIndex}`)
      )
      .filter((supplier): supplier is NormalisedOrganisation => supplier !== null),
  };
}

export type NormalisedDocument = {
  documentId: string;
  title: string | null;
  description: string | null;
  documentType: string | null;
  url: string;
  format: string | null;
  publishedAt: Date | null;
};

export function normaliseDocuments(documents: OcdsDocument[] | undefined): NormalisedDocument[] {
  return (documents ?? [])
    .filter((doc): doc is OcdsDocument & { url: string } => Boolean(doc.url))
    .map((doc, index) => ({
      documentId: doc.id?.trim() || String(index),
      title: doc.title ?? null,
      description: doc.description ?? null,
      documentType: doc.documentType ?? null,
      url: doc.url,
      format: doc.format ?? null,
      publishedAt: parseOcdsDate(doc.datePublished),
    }));
}

export type NormalisedNotice = {
  ocid: string;
  noticeId: string;
  type: ProcurementNoticeType;
  status: ProcurementStatus;
  title: string;
  description: string | null;
  valueAmount: number | null;
  valueCurrency: string | null;
  valueAmountMin: number | null;
  publishedAt: Date | null;
  deadlineAt: Date | null;
  contractStartAt: Date | null;
  contractEndAt: Date | null;
  cpvCodes: string[];
  categories: string[];
  procurementMethod: string | null;
  deliveryLocality: string | null;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  buyer: NormalisedOrganisation | null;
  awards: NormalisedAward[];
  documents: NormalisedDocument[];
};

/** CPV codes appear as classifications with scheme "CPV". */
function extractCpvCodes(release: OcdsRelease): string[] {
  const codes = new Set<string>();

  const add = (classification?: { scheme?: string; id?: string }) => {
    if (!classification?.id) return;
    const scheme = (classification.scheme ?? "").toUpperCase();
    if (scheme && scheme !== "CPV") return;
    codes.add(classification.id.trim());
  };

  add(release.tender?.classification);
  for (const extra of release.tender?.additionalClassifications ?? []) add(extra);
  for (const item of release.tender?.items ?? []) {
    add(item.classification);
    for (const extra of item.additionalClassifications ?? []) add(extra);
  }

  return [...codes];
}

function extractDeliveryLocation(release: OcdsRelease): {
  locality: string | null;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
} {
  for (const item of release.tender?.items ?? []) {
    const address = item.deliveryAddresses?.[0];
    const coordinates = item.deliveryLocation?.geometry?.coordinates;

    if (address || coordinates) {
      // GeoJSON order is [longitude, latitude].
      const longitude = Array.isArray(coordinates) && coordinates.length >= 2 ? coordinates[0] : null;
      const latitude = Array.isArray(coordinates) && coordinates.length >= 2 ? coordinates[1] : null;

      return {
        locality: address?.locality ?? item.deliveryLocation?.description ?? null,
        postcode: normalisePostcode(address?.postalCode) ?? address?.postalCode ?? null,
        latitude: typeof latitude === "number" ? latitude : null,
        longitude: typeof longitude === "number" ? longitude : null,
      };
    }
  }

  const buyerAddress = release.buyer?.address;
  return {
    locality: buyerAddress?.locality ?? null,
    postcode: normalisePostcode(buyerAddress?.postalCode) ?? buyerAddress?.postalCode ?? null,
    latitude: null,
    longitude: null,
  };
}

/**
 * The buyer may be given inline on the release or referenced by id into
 * `parties`. Resolve both, preferring the fuller record from `parties`.
 */
function resolveBuyer(release: OcdsRelease): OcdsOrganisation | undefined {
  const buyer = release.buyer;
  if (!buyer) {
    return (release.parties ?? []).find((party) =>
      (party.roles ?? []).some((role) => role.toLowerCase() === "buyer")
    );
  }
  if (buyer.id) {
    const full = (release.parties ?? []).find((party) => party.id === buyer.id);
    if (full) return { ...full, ...buyer, address: full.address ?? buyer.address };
  }
  return buyer;
}

export function normaliseRelease(release: OcdsRelease): NormalisedNotice {
  const ocid = release.ocid?.trim();
  if (!ocid) throw new Error("OCDS release has no ocid");

  const title = release.tender?.title?.trim() || release.awards?.[0]?.title?.trim();
  if (!title) throw new Error(`OCDS release ${ocid} has no tender or award title`);

  const location = extractDeliveryLocation(release);
  const awards = (release.awards ?? []).map((award, index) => normaliseAward(award, index));

  // The headline value: the tender value where present, otherwise the total of
  // the awards. Never invented when neither is published.
  const tenderAmount =
    typeof release.tender?.value?.amount === "number" ? release.tender.value.amount : null;
  const awardTotal = awards.reduce<number | null>((total, award) => {
    if (award.valueAmount === null) return total;
    return (total ?? 0) + award.valueAmount;
  }, null);

  return {
    ocid,
    noticeId: release.id?.trim() || ocid,
    type: mapNoticeType(release),
    status: mapStatus(release),
    title,
    description: release.tender?.description ?? release.awards?.[0]?.description ?? null,
    valueAmount: tenderAmount ?? awardTotal,
    valueCurrency:
      release.tender?.value?.currency ?? awards.find((a) => a.valueCurrency)?.valueCurrency ?? null,
    valueAmountMin:
      typeof release.tender?.minValue?.amount === "number" ? release.tender.minValue.amount : null,
    publishedAt: parseOcdsDate(release.date),
    deadlineAt: parseOcdsDate(release.tender?.tenderPeriod?.endDate),
    contractStartAt: parseOcdsDate(release.tender?.contractPeriod?.startDate),
    contractEndAt: parseOcdsDate(release.tender?.contractPeriod?.endDate),
    cpvCodes: extractCpvCodes(release),
    categories: [
      release.tender?.mainProcurementCategory,
      ...(release.tender?.additionalProcurementCategories ?? []),
    ].filter((category): category is string => Boolean(category)),
    procurementMethod: release.tender?.procurementMethodDetails ?? release.tender?.procurementMethod ?? null,
    deliveryLocality: location.locality,
    postcode: location.postcode,
    latitude: location.latitude,
    longitude: location.longitude,
    buyer: normaliseOrganisation(resolveBuyer(release), ocid),
    awards,
    documents: normaliseDocuments(release.tender?.documents),
  };
}
