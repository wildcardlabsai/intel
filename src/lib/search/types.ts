import { z } from "zod";

/**
 * Search abstraction.
 *
 * The first implementation is PostgreSQL full-text search. The interface is
 * deliberately engine-agnostic — filters are structured values rather than
 * SQL, and ranking is expressed as an option — so an Elasticsearch, OpenSearch
 * or Typesense provider can be dropped in later without touching any caller.
 */

export const SORT_ORDERS = ["relevance", "newest", "oldest", "value_desc", "value_asc", "name"] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export type Pagination = z.infer<typeof paginationSchema>;

export type SearchResult<T> = {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  /** Echoed back so the UI can show exactly what was searched. */
  query: string | null;
  tookMs: number;
};

/** Radius search around a point, in kilometres. */
export const radiusSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(0.1).max(200),
});

export type Radius = z.infer<typeof radiusSchema>;

export const companyFilterSchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.array(z.string()).optional(),
  sicCodes: z.array(z.string()).optional(),
  sectorSlug: z.string().optional(),
  region: z.string().optional(),
  localAuthority: z.string().optional(),
  postcode: z.string().optional(),
  town: z.string().optional(),
  incorporatedFrom: z.string().optional(),
  incorporatedTo: z.string().optional(),
  sizeBand: z.array(z.string()).optional(),
  hasCharges: z.coerce.boolean().optional(),
  /** Restrict to companies classified as Welsh. Defaults to true. */
  welshOnly: z.coerce.boolean().default(true),
  radius: radiusSchema.optional(),
  sort: z.enum(SORT_ORDERS).default("relevance"),
});

export type CompanyFilters = z.infer<typeof companyFilterSchema>;

export const procurementFilterSchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.array(z.string()).optional(),
  type: z.array(z.string()).optional(),
  buyerId: z.string().optional(),
  supplierId: z.string().optional(),
  minValue: z.coerce.number().optional(),
  maxValue: z.coerce.number().optional(),
  cpvPrefix: z.string().optional(),
  localAuthority: z.string().optional(),
  region: z.string().optional(),
  publishedFrom: z.string().optional(),
  publishedTo: z.string().optional(),
  sort: z.enum(SORT_ORDERS).default("relevance"),
});

export type ProcurementFilters = z.infer<typeof procurementFilterSchema>;

export const planningFilterSchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.array(z.string()).optional(),
  category: z.array(z.string()).optional(),
  authoritySlug: z.string().optional(),
  localAuthority: z.string().optional(),
  postcode: z.string().optional(),
  submittedFrom: z.string().optional(),
  submittedTo: z.string().optional(),
  radius: radiusSchema.optional(),
  sort: z.enum(SORT_ORDERS).default("relevance"),
});

export type PlanningFilters = z.infer<typeof planningFilterSchema>;

export const fundingFilterSchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: z.array(z.string()).optional(),
  type: z.array(z.string()).optional(),
  organisationId: z.string().optional(),
  minAmount: z.coerce.number().optional(),
  maxAmount: z.coerce.number().optional(),
  sector: z.string().optional(),
  closingBefore: z.string().optional(),
  sort: z.enum(SORT_ORDERS).default("relevance"),
});

export type FundingFilters = z.infer<typeof fundingFilterSchema>;

/**
 * Turns user input into a PostgreSQL `websearch_to_tsquery` string.
 *
 * `websearch_to_tsquery` already handles quoted phrases, OR and negation
 * safely, and — critically — never throws on malformed input the way
 * `to_tsquery` does. Input is still length-capped and stripped of control
 * characters before it reaches the database.
 */
export function toSearchQuery(input: string | null | undefined): string | null {
  if (!input) return null;
  const cleaned = input
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, 200);
  return cleaned.length > 0 ? cleaned : null;
}
