import { z } from "zod";

import type { EntityType } from "@/generated/prisma/enums";
import {
  companyFilterSchema,
  fundingFilterSchema,
  planningFilterSchema,
  procurementFilterSchema,
} from "@/lib/search/types";

/**
 * Saved searches.
 *
 * A saved search is the user's filter state, stored so it can be re-run later
 * and so an alert can be built from it. Everything here is pure: capturing
 * filters from a URL, rebuilding a URL from stored filters, and describing a
 * saved search in words. That keeps it unit-testable without a database, and
 * keeps one canonical definition of "what a search is" shared by the search
 * pages, the saved-search list and the alert runner.
 *
 * Filters are validated on the way in against the same schema the search page
 * uses, so a stored search can never carry a filter the search engine would
 * reject — and anything unrecognised is dropped rather than persisted.
 */

/** Entity types a search can be saved for — those with a filter schema. */
export const SAVEABLE_ENTITY_TYPES = [
  "COMPANY",
  "PROCUREMENT",
  "PLANNING",
  "FUNDING",
] as const;

export type SaveableEntityType = (typeof SAVEABLE_ENTITY_TYPES)[number];

export const saveableEntityTypeSchema = z.enum(SAVEABLE_ENTITY_TYPES);

export function isSaveableEntityType(value: EntityType | string): value is SaveableEntityType {
  return (SAVEABLE_ENTITY_TYPES as readonly string[]).includes(value);
}

export const ENTITY_BASE_PATHS: Record<SaveableEntityType, string> = {
  COMPANY: "/dashboard/companies",
  PROCUREMENT: "/dashboard/procurement",
  PLANNING: "/dashboard/planning",
  FUNDING: "/dashboard/funding",
};

export const ENTITY_LABELS: Record<SaveableEntityType, string> = {
  COMPANY: "Companies",
  PROCUREMENT: "Procurement",
  PLANNING: "Planning",
  FUNDING: "Funding",
};

const FILTER_SCHEMAS = {
  COMPANY: companyFilterSchema,
  PROCUREMENT: procurementFilterSchema,
  PLANNING: planningFilterSchema,
  FUNDING: fundingFilterSchema,
} as const;

/**
 * Parameters that describe *where you are* rather than *what you searched
 * for*. They are deliberately not stored: re-running a saved search should
 * start at page one with the current data, not at whatever page the user
 * happened to be on when they saved it.
 */
const POSITIONAL_PARAMS = new Set(["page", "perPage"]);

/** Filter values that carry no information because they are the default. */
function isMeaningful(key: string, value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;
  // "relevance" is the default sort, and welshOnly defaults to true; storing
  // either would make two identical searches compare as different.
  if (key === "sort" && value === "relevance") return false;
  if (key === "welshOnly" && value === true) return false;
  return true;
}

const ARRAY_KEYS = ["status", "sicCodes", "sizeBand", "type", "category"] as const;

export type CapturedSearch = {
  /** Free-text query, stored separately so it can be shown and edited. */
  query: string | null;
  /** Everything else, validated and normalised. */
  filters: Record<string, unknown>;
};

/**
 * Validates raw URL parameters into a storable search.
 *
 * Unknown keys are dropped by the schema, defaults are dropped by
 * `isMeaningful`, and pagination is dropped entirely — so the same search
 * always produces the same stored record regardless of how the user got there.
 */
export function captureSearch(
  entityType: SaveableEntityType,
  params: Record<string, string | string[] | undefined>
): CapturedSearch {
  const schema = FILTER_SCHEMAS[entityType];

  const input: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (POSITIONAL_PARAMS.has(key) || value === undefined) continue;
    input[key] = value;
  }

  // Array-valued filters arrive as a bare string when only one is selected.
  for (const key of ARRAY_KEYS) {
    const value = input[key];
    if (typeof value === "string") input[key] = [value];
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    // Fall back to the query alone rather than refusing to save: a malformed
    // filter in the URL should not cost the user their search term.
    const q = typeof params.q === "string" ? params.q.trim() : "";
    return { query: q.length > 0 ? q : null, filters: {} };
  }

  const { q, ...rest } = parsed.data as Record<string, unknown> & { q?: string };

  const filters: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (isMeaningful(key, value)) filters[key] = value;
  }

  return { query: typeof q === "string" && q.length > 0 ? q : null, filters };
}

/** True when a search has nothing to it — there is no point saving it. */
export function isEmptySearch(search: CapturedSearch): boolean {
  return !search.query && Object.keys(search.filters).length === 0;
}

/** Rebuilds the search page URL for a stored search. */
export function savedSearchHref(
  entityType: SaveableEntityType,
  query: string | null,
  filters: Record<string, unknown>
): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);

  for (const [key, value] of Object.entries(filters ?? {})) {
    if (!isMeaningful(key, value)) continue;
    if (Array.isArray(value)) {
      for (const entry of value) params.append(key, String(entry));
    } else if (typeof value === "object") {
      // Nested objects (a radius, for example) are flattened to their parts so
      // the search page can parse them back out of the query string.
      for (const [innerKey, innerValue] of Object.entries(value as Record<string, unknown>)) {
        if (isMeaningful(innerKey, innerValue)) params.append(innerKey, String(innerValue));
      }
    } else {
      params.set(key, String(value));
    }
  }

  const queryString = params.toString();
  const base = ENTITY_BASE_PATHS[entityType];
  return queryString ? `${base}?${queryString}` : base;
}

const FILTER_LABELS: Record<string, string> = {
  status: "status",
  sicCodes: "SIC code",
  sectorSlug: "sector",
  region: "region",
  localAuthority: "authority",
  postcode: "postcode",
  town: "town",
  incorporatedFrom: "incorporated from",
  incorporatedTo: "incorporated to",
  sizeBand: "size",
  hasCharges: "has charges",
  welshOnly: "Welsh only",
  type: "type",
  buyerId: "buyer",
  supplierId: "supplier",
  minValue: "min value",
  maxValue: "max value",
  cpvPrefix: "CPV",
  publishedFrom: "published from",
  publishedTo: "published to",
  category: "category",
  authoritySlug: "authority",
  submittedFrom: "submitted from",
  submittedTo: "submitted to",
  organisationId: "funder",
  minAmount: "min amount",
  maxAmount: "max amount",
  sector: "sector",
  closingBefore: "closing before",
  sort: "sorted by",
};

/** A short human description, e.g. `“solar” · region: South West · status: Active`. */
export function describeSavedSearch(
  query: string | null,
  filters: Record<string, unknown>
): string {
  const parts: string[] = [];
  if (query) parts.push(`“${query}”`);

  for (const [key, value] of Object.entries(filters ?? {})) {
    if (!isMeaningful(key, value)) continue;
    const label = FILTER_LABELS[key] ?? key;
    const rendered = Array.isArray(value) ? value.join(", ") : String(value);
    parts.push(`${label}: ${rendered}`);
  }

  return parts.length > 0 ? parts.join(" · ") : "All records";
}
