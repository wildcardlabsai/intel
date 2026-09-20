import type { PlanningCategory, PlanningStatus } from "@/generated/prisma/enums";
import { osgbToWgs84 } from "@/lib/geo/osgb";
import { normalisePersonName } from "@/lib/normalise/company-name";
import type { FieldMap, PlanningConnectorConfig } from "@/lib/sources/planning/config";
import { normalisePostcode } from "@/lib/wales/classification";

/**
 * Maps one authority's published record onto ours.
 *
 * Pure, so every authority's field map can be unit-tested without touching a
 * network or a database. The rule throughout: a field that is absent, blank or
 * unrecognised becomes null or UNKNOWN. Nothing is inferred from a value that
 * was not published — a planning record with no decision date does not get
 * one, and an unmapped status word does not get guessed at.
 */

export type RawPlanningRecord = Record<string, unknown>;

export type NormalisedPlanningApplication = {
  reference: string;
  siteAddress: string | null;
  postcode: string | null;
  latitude: number | null;
  longitude: number | null;
  easting: number | null;
  northing: number | null;
  description: string | null;
  applicationType: string | null;
  category: PlanningCategory;
  status: PlanningStatus;
  decision: string | null;
  submittedOn: Date | null;
  validatedOn: Date | null;
  consultationEndsOn: Date | null;
  decidedOn: Date | null;
  applicantName: string | null;
  applicantNormalisedName: string | null;
  agentName: string | null;
  agentNormalisedName: string | null;
  dwellingCount: number | null;
  sourceUrl: string | null;
};

const PLANNING_STATUSES: PlanningStatus[] = [
  "SUBMITTED",
  "VALIDATED",
  "PENDING",
  "UNDER_CONSIDERATION",
  "APPROVED",
  "APPROVED_WITH_CONDITIONS",
  "REFUSED",
  "WITHDRAWN",
  "APPEAL",
  "DECIDED",
  "UNKNOWN",
];

const PLANNING_CATEGORIES: PlanningCategory[] = [
  "RESIDENTIAL",
  "COMMERCIAL",
  "INDUSTRIAL",
  "RETAIL",
  "ENERGY",
  "INFRASTRUCTURE",
  "LEISURE",
  "AGRICULTURAL",
  "MIXED_USE",
  "CHANGE_OF_USE",
  "OTHER",
  "UNKNOWN",
];

/** Reads a mapped field, tolerating nested paths like "attributes.REF". */
export function readField(record: RawPlanningRecord, path: string | undefined): unknown {
  if (!path) return undefined;
  let current: unknown = record;
  for (const segment of path.split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function readString(record: RawPlanningRecord, path: string | undefined): string | null {
  const value = readField(record, path);
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function readNumber(record: RawPlanningRecord, path: string | undefined): number | null {
  const value = readField(record, path);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value.trim().replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Parses a published date.
 *
 * Accepts ISO dates, epoch milliseconds (which ArcGIS uses) and the UK
 * `DD/MM/YYYY` form. An ambiguous or unparseable value returns null rather
 * than a date that might be wrong by ten months.
 */
export function readDate(record: RawPlanningRecord, path: string | undefined): Date | null {
  const value = readField(record, path);
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    // ArcGIS publishes dates as epoch milliseconds.
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  const uk = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
  if (uk) {
    const [, day, month, year] = uk;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    // Reject a value that rolled over, e.g. 31/02/2026.
    return date.getUTCMonth() === Number(month) - 1 ? date : null;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const date = new Date(trimmed.length === 10 ? `${trimmed}T00:00:00.000Z` : trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/** Matches a published status word against the authority's own mapping. */
export function mapStatus(
  raw: string | null,
  statusMap: Record<string, string>
): PlanningStatus {
  if (!raw) return "UNKNOWN";
  const key = raw.trim().toLowerCase();

  const mapped = statusMap[key] ?? statusMap[raw.trim()];
  if (mapped && (PLANNING_STATUSES as string[]).includes(mapped)) {
    return mapped as PlanningStatus;
  }

  // An authority may already publish our own vocabulary.
  const direct = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if ((PLANNING_STATUSES as string[]).includes(direct)) return direct as PlanningStatus;

  return "UNKNOWN";
}

export function mapCategory(
  raw: string | null,
  categoryMap: Record<string, string>
): PlanningCategory {
  if (!raw) return "UNKNOWN";
  const key = raw.trim().toLowerCase();

  const mapped = categoryMap[key] ?? categoryMap[raw.trim()];
  if (mapped && (PLANNING_CATEGORIES as string[]).includes(mapped)) {
    return mapped as PlanningCategory;
  }

  const direct = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if ((PLANNING_CATEGORIES as string[]).includes(direct)) return direct as PlanningCategory;

  return "UNKNOWN";
}

function buildRecordUrl(
  config: PlanningConnectorConfig,
  record: RawPlanningRecord,
  fieldMap: FieldMap,
  reference: string
): string | null {
  const published = readString(record, fieldMap.url);
  if (published && /^https?:\/\//i.test(published)) return published;

  if (config.recordUrlTemplate) {
    return config.recordUrlTemplate.replace("{reference}", encodeURIComponent(reference));
  }

  return null;
}

export function normalisePlanningRecord(
  record: RawPlanningRecord,
  config: PlanningConnectorConfig
): NormalisedPlanningApplication | null {
  const { fieldMap } = config;

  const reference = readString(record, fieldMap.reference);
  // Without the authority's own reference there is no stable identity for this
  // record, so it cannot be stored or de-duplicated. Reject it.
  if (!reference) return null;

  let latitude = readNumber(record, fieldMap.latitude);
  let longitude = readNumber(record, fieldMap.longitude);
  const easting = readNumber(record, fieldMap.easting);
  const northing = readNumber(record, fieldMap.northing);

  // A published WGS84 pair wins; grid references are converted only when no
  // latitude and longitude were published.
  if ((latitude === null || longitude === null) && easting !== null && northing !== null) {
    const converted = osgbToWgs84(easting, northing);
    if (converted) {
      latitude = converted.latitude;
      longitude = converted.longitude;
    }
  }

  // A coordinate pair outside plausible bounds is dropped rather than plotted.
  if (latitude !== null && (latitude < -90 || latitude > 90)) latitude = null;
  if (longitude !== null && (longitude < -180 || longitude > 180)) longitude = null;

  const applicantName = readString(record, fieldMap.applicantName);
  const agentName = readString(record, fieldMap.agentName);

  return {
    reference,
    siteAddress: readString(record, fieldMap.siteAddress),
    postcode: normalisePostcode(readString(record, fieldMap.postcode) ?? ""),
    latitude,
    longitude,
    easting: easting !== null ? Math.round(easting) : null,
    northing: northing !== null ? Math.round(northing) : null,
    description: readString(record, fieldMap.description),
    applicationType: readString(record, fieldMap.applicationType),
    category: mapCategory(readString(record, fieldMap.applicationType), config.categoryMap),
    status: mapStatus(readString(record, fieldMap.status), config.statusMap),
    decision: readString(record, fieldMap.decision),
    submittedOn: readDate(record, fieldMap.submittedOn),
    validatedOn: readDate(record, fieldMap.validatedOn),
    consultationEndsOn: readDate(record, fieldMap.consultationEndsOn),
    decidedOn: readDate(record, fieldMap.decidedOn),
    applicantName,
    applicantNormalisedName: applicantName ? normalisePersonName(applicantName) : null,
    agentName,
    agentNormalisedName: agentName ? normalisePersonName(agentName) : null,
    dwellingCount: readNumber(record, fieldMap.dwellingCount),
    sourceUrl: buildRecordUrl(config, record, fieldMap, reference),
  };
}
