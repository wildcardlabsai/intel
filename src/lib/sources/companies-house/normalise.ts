import type { AddressType, CompanyStatus } from "@/generated/prisma/enums";
import { normaliseCompanyName, normalisePersonName } from "@/lib/normalise/company-name";
import { normalisePostcode } from "@/lib/wales/classification";
import type {
  ChAddress,
  ChCharge,
  ChCompanyProfile,
  ChFilingItem,
  ChOfficer,
  ChPsc,
} from "@/lib/sources/companies-house/types";

/**
 * Pure mappers from Companies House shapes onto ours.
 *
 * No I/O and no database access, so every rule here is unit-testable without
 * network or a database.
 */

const STATUS_MAP: Record<string, CompanyStatus> = {
  active: "ACTIVE",
  dissolved: "DISSOLVED",
  liquidation: "LIQUIDATION",
  receivership: "RECEIVERSHIP",
  administration: "ADMINISTRATION",
  "voluntary-arrangement": "VOLUNTARY_ARRANGEMENT",
  "converted-closed": "CONVERTED_CLOSED",
  "insolvency-proceedings": "INSOLVENCY_PROCEEDINGS",
  "administrative-receivership": "RECEIVERSHIP",
  "in-administration": "ADMINISTRATION",
  registered: "REGISTERED",
  removed: "REMOVED",
  closed: "CLOSED",
  open: "OPEN",
};

export function mapCompanyStatus(status: string | undefined): CompanyStatus {
  if (!status) return "UNKNOWN";
  return STATUS_MAP[status.toLowerCase().trim()] ?? "UNKNOWN";
}

/**
 * Companies House publishes dates as YYYY-MM-DD. Anything else is treated as
 * absent rather than coerced, so a malformed date never becomes a wrong date.
 */
export function parseChDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(`${value.trim()}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Derives a size band from the accounts type Companies House reports. Returns
 * null when the accounts type does not imply a size — we never estimate
 * employee counts or turnover, because Companies House does not publish them
 * in this API.
 */
export function deriveSizeBand(accountsType: string | undefined): string | null {
  if (!accountsType) return null;
  const type = accountsType.toLowerCase();
  if (type.includes("micro")) return "micro";
  if (type.includes("small")) return "small";
  if (type.includes("medium")) return "medium";
  if (type.includes("dormant")) return "dormant";
  if (type.includes("group") || type.includes("full")) return "large";
  return null;
}

export type NormalisedAddress = {
  type: AddressType;
  careOf: string | null;
  premises: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  locality: string | null;
  regionText: string | null;
  postcode: string | null;
  country: string | null;
};

export function normaliseAddress(
  address: ChAddress | undefined,
  type: AddressType
): NormalisedAddress | null {
  if (!address) return null;

  const hasContent = Boolean(
    address.address_line_1 ||
      address.premises ||
      address.locality ||
      address.postal_code ||
      address.country
  );
  if (!hasContent) return null;

  return {
    type,
    careOf: address.care_of ?? null,
    premises: address.premises ?? null,
    addressLine1: address.address_line_1 ?? null,
    addressLine2: address.address_line_2 ?? null,
    locality: address.locality ?? null,
    regionText: address.region ?? null,
    postcode: normalisePostcode(address.postal_code) ?? address.postal_code ?? null,
    country: address.country ?? null,
  };
}

export type NormalisedCompany = {
  companyNumber: string;
  name: string;
  normalisedName: string;
  previousNames: string[];
  status: CompanyStatus;
  statusDetail: string | null;
  companyType: string | null;
  jurisdiction: string | null;
  incorporatedOn: Date | null;
  dissolvedOn: Date | null;
  sicCodes: string[];
  accountsLastMadeUpTo: Date | null;
  accountsNextDue: Date | null;
  accountsCategory: string | null;
  confirmationStatementNextDue: Date | null;
  sizeBand: string | null;
  hasInsolvencyHistory: boolean;
  hasCharges: boolean;
  registeredOffice: NormalisedAddress | null;
  serviceAddress: NormalisedAddress | null;
};

export function normaliseCompanyProfile(profile: ChCompanyProfile): NormalisedCompany {
  const companyNumber = profile.company_number?.trim().toUpperCase();
  if (!companyNumber) {
    throw new Error("Companies House profile has no company_number");
  }

  const name = profile.company_name?.trim();
  if (!name) {
    throw new Error(`Companies House profile ${companyNumber} has no company_name`);
  }

  const accountsType = profile.accounts?.last_accounts?.type;

  return {
    companyNumber,
    name,
    normalisedName: normaliseCompanyName(name),
    previousNames: (profile.previous_company_names ?? [])
      .map((entry) => entry.name?.trim())
      .filter((value): value is string => Boolean(value)),
    status: mapCompanyStatus(profile.company_status),
    statusDetail: profile.company_status_detail ?? null,
    companyType: profile.type ?? null,
    jurisdiction: profile.jurisdiction ?? null,
    incorporatedOn: parseChDate(profile.date_of_creation),
    dissolvedOn: parseChDate(profile.date_of_cessation),
    sicCodes: (profile.sic_codes ?? []).map((code) => code.trim()).filter(Boolean),
    accountsLastMadeUpTo: parseChDate(profile.accounts?.last_accounts?.made_up_to),
    accountsNextDue: parseChDate(profile.accounts?.next_due ?? profile.accounts?.next_accounts?.due_on),
    accountsCategory: accountsType ?? null,
    confirmationStatementNextDue: parseChDate(profile.confirmation_statement?.next_due),
    sizeBand: deriveSizeBand(accountsType),
    hasInsolvencyHistory: profile.has_insolvency_history ?? false,
    hasCharges: profile.has_charges ?? false,
    registeredOffice: normaliseAddress(profile.registered_office_address, "REGISTERED_OFFICE"),
    serviceAddress: normaliseAddress(profile.service_address, "SERVICE_ADDRESS"),
  };
}

export type NormalisedOfficer = {
  sourceId: string;
  name: string;
  normalisedName: string;
  role: string | null;
  appointedOn: Date | null;
  resignedOn: Date | null;
  nationality: string | null;
  countryOfResidence: string | null;
  occupation: string | null;
  dobMonth: number | null;
  dobYear: number | null;
  addressLocality: string | null;
  addressPostcode: string | null;
  isActive: boolean;
};

export function normaliseOfficer(officer: ChOfficer, index: number): NormalisedOfficer {
  const name = officer.name?.trim() ?? "";
  // The appointment link is the only stable identifier Companies House gives
  // for an appointment; fall back to a deterministic composite so re-running
  // the connector does not create duplicates.
  const sourceId =
    officer.links?.self ??
    `${normalisePersonName(name)}|${officer.officer_role ?? ""}|${officer.appointed_on ?? index}`;

  return {
    sourceId,
    name,
    normalisedName: normalisePersonName(name),
    role: officer.officer_role ?? null,
    appointedOn: parseChDate(officer.appointed_on),
    resignedOn: parseChDate(officer.resigned_on),
    nationality: officer.nationality ?? null,
    countryOfResidence: officer.country_of_residence ?? null,
    occupation: officer.occupation ?? null,
    dobMonth: officer.date_of_birth?.month ?? null,
    dobYear: officer.date_of_birth?.year ?? null,
    addressLocality: officer.address?.locality ?? null,
    addressPostcode: normalisePostcode(officer.address?.postal_code),
    isActive: !officer.resigned_on,
  };
}

export type NormalisedPsc = {
  sourceId: string;
  name: string;
  normalisedName: string;
  kind: string | null;
  naturesOfControl: string[];
  notifiedOn: Date | null;
  ceasedOn: Date | null;
  nationality: string | null;
  countryOfResidence: string | null;
  dobMonth: number | null;
  dobYear: number | null;
  pscCompanyNumber: string | null;
  isActive: boolean;
};

export function normalisePsc(psc: ChPsc, index: number): NormalisedPsc {
  const name = psc.name?.trim() ?? "";
  const sourceId = psc.links?.self ?? `${normaliseCompanyName(name)}|${psc.notified_on ?? index}`;

  // A corporate PSC carries its own registration number; keep it so the
  // ownership graph can link company to company.
  const registrationNumber = psc.identification?.registration_number?.trim() ?? null;

  return {
    sourceId,
    name,
    normalisedName: psc.kind?.includes("corporate")
      ? normaliseCompanyName(name)
      : normalisePersonName(name),
    kind: psc.kind ?? null,
    naturesOfControl: psc.natures_of_control ?? [],
    notifiedOn: parseChDate(psc.notified_on),
    ceasedOn: parseChDate(psc.ceased_on),
    nationality: psc.nationality ?? null,
    countryOfResidence: psc.country_of_residence ?? null,
    dobMonth: psc.date_of_birth?.month ?? null,
    dobYear: psc.date_of_birth?.year ?? null,
    pscCompanyNumber: registrationNumber,
    isActive: !psc.ceased_on,
  };
}

export type NormalisedFiling = {
  transactionId: string;
  category: string | null;
  subcategory: string | null;
  type: string | null;
  description: string | null;
  descriptionValues: Record<string, string> | null;
  date: Date | null;
  pages: number | null;
  documentUrl: string | null;
};

export function normaliseFiling(filing: ChFilingItem): NormalisedFiling | null {
  const transactionId = filing.transaction_id?.trim();
  if (!transactionId) return null;

  return {
    transactionId,
    category: filing.category ?? null,
    subcategory: Array.isArray(filing.subcategory)
      ? filing.subcategory.join(", ")
      : filing.subcategory ?? null,
    type: filing.type ?? null,
    description: filing.description ?? null,
    descriptionValues: filing.description_values ?? null,
    date: parseChDate(filing.date),
    pages: filing.pages ?? null,
    documentUrl: filing.links?.document_metadata ?? null,
  };
}

export type NormalisedCharge = {
  chargeId: string;
  chargeCode: string | null;
  classification: string | null;
  status: string | null;
  createdOn: Date | null;
  deliveredOn: Date | null;
  satisfiedOn: Date | null;
  personsEntitled: string[];
  amountSecured: string | null;
  particulars: string | null;
};

export function normaliseCharge(charge: ChCharge, index: number): NormalisedCharge {
  return {
    chargeId: charge.id ?? charge.charge_code ?? String(charge.charge_number ?? index),
    chargeCode: charge.charge_code ?? null,
    classification: charge.classification?.description ?? charge.classification?.type ?? null,
    status: charge.status ?? null,
    createdOn: parseChDate(charge.created_on),
    deliveredOn: parseChDate(charge.delivered_on),
    satisfiedOn: parseChDate(charge.satisfied_on),
    personsEntitled: (charge.persons_entitled ?? [])
      .map((person) => person.name?.trim())
      .filter((value): value is string => Boolean(value)),
    amountSecured: charge.secured_details?.description ?? null,
    particulars: charge.particulars?.description ?? null,
  };
}
