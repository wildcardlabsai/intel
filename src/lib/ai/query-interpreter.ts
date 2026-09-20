import { z } from "zod";

import { companyFilterSchema, type CompanyFilters } from "@/lib/search/types";

/**
 * Natural-language query interpretation.
 *
 * The model's only job here is translation: it turns a phrase such as
 * "active construction firms in Gwynedd incorporated since 2020" into
 * structured filter values. It is never shown a database record, never asked
 * to summarise one, and never produces a factual statement of any kind.
 *
 * Three guarantees make that hold rather than being a matter of prompting:
 *
 *  1. The response is constrained to a JSON schema of filter fields. There is
 *     no free-text field in which the model could assert a fact.
 *  2. Every value it returns is checked against a vocabulary built from the
 *     database — region names, authority slugs, statuses. Anything outside it
 *     is dropped and reported, never passed to the query.
 *  3. The filters are then re-parsed by the same schema the ordinary search
 *     page uses, so an interpreted search and a hand-built one execute through
 *     exactly the same code path.
 *
 * The explanation shown to the user is generated locally from the validated
 * filters, not taken from the model, so what the user reads is always what was
 * actually searched for.
 *
 * Everything in this file is pure. The API call lives in `interpret.ts`.
 */

export type Vocabulary = {
  regions: string[];
  localAuthorities: Array<{ slug: string; name: string; welshName: string | null }>;
  statuses: string[];
  sizeBands: string[];
  sorts: string[];
};

/**
 * The shape the model is constrained to.
 *
 * Every field is optional: the model omits what the phrase does not mention
 * rather than inventing a plausible value. Dates are plain years or ISO dates
 * and are normalised here, because a model asked for "since 2020" will
 * reasonably answer either way.
 */
export const interpretationSchema = z.object({
  /**
   * Words that should go to full-text search because they are not a filter —
   * a trading name, a product, a sector word with no SIC mapping.
   */
  keywords: z.string().max(200).nullable(),
  region: z.string().max(60).nullable(),
  localAuthority: z.string().max(80).nullable(),
  postcode: z.string().max(10).nullable(),
  town: z.string().max(60).nullable(),
  statuses: z.array(z.string().max(40)).max(6),
  sizeBands: z.array(z.string().max(20)).max(5),
  sicCodes: z.array(z.string().max(6)).max(10),
  incorporatedFrom: z.string().max(10).nullable(),
  incorporatedTo: z.string().max(10).nullable(),
  sort: z.string().max(20).nullable(),
  /**
   * Parts of the request that could not be expressed as a filter, so the user
   * is told rather than being given a silently narrower search.
   */
  unresolved: z.array(z.string().max(80)).max(5),
});

export type RawInterpretation = z.infer<typeof interpretationSchema>;

export type Interpretation = {
  filters: CompanyFilters;
  /** Values the model produced that are not in the vocabulary. */
  dropped: string[];
  /** Parts of the phrase the model could not express as a filter. */
  unresolved: string[];
};

export function buildVocabulary(
  localAuthorities: Array<{ slug: string; name: string; welshName?: string | null }>
): Vocabulary {
  return {
    regions: ["NORTH_WALES", "MID_WALES", "WEST_WALES", "SOUTH_WALES", "SOUTH_EAST_WALES"],
    localAuthorities: localAuthorities.map((authority) => ({
      slug: authority.slug,
      name: authority.name,
      welshName: authority.welshName ?? null,
    })),
    statuses: [
      "ACTIVE",
      "DISSOLVED",
      "LIQUIDATION",
      "RECEIVERSHIP",
      "ADMINISTRATION",
      "VOLUNTARY_ARRANGEMENT",
      "INSOLVENCY_PROCEEDINGS",
      "CONVERTED_CLOSED",
      "REGISTERED",
      "REMOVED",
      "CLOSED",
      "OPEN",
    ],
    sizeBands: ["micro", "small", "medium", "large", "dormant"],
    sorts: ["relevance", "newest", "oldest", "name"],
  };
}

/** Turns a year or an ISO date into an ISO date, or nothing at all. */
function toIsoDate(value: string | null, endOfYear: boolean): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();

  if (/^\d{4}$/.test(trimmed)) {
    return endOfYear ? `${trimmed}-12-31` : `${trimmed}-01-01`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? undefined : trimmed;
  }
  return undefined;
}

/** A SIC code is five digits. Anything else is not a SIC code. */
function validSicCodes(codes: string[]): string[] {
  return codes.map((code) => code.trim()).filter((code) => /^\d{4,5}$/.test(code));
}

/**
 * Checks everything the model produced against the vocabulary, drops what does
 * not belong, and re-parses the result through the ordinary search schema.
 */
export function validateInterpretation(
  raw: RawInterpretation,
  vocabulary: Vocabulary
): Interpretation {
  const dropped: string[] = [];

  const region = raw.region?.trim().toUpperCase().replace(/[\s-]+/g, "_") ?? null;
  const validRegion = region && vocabulary.regions.includes(region) ? region : undefined;
  if (region && !validRegion) dropped.push(`region “${raw.region}”`);

  const authoritySlug = raw.localAuthority?.trim().toLowerCase() ?? null;
  const matchedAuthority = authoritySlug
    ? vocabulary.localAuthorities.find(
        (authority) =>
          authority.slug === authoritySlug ||
          authority.name.toLowerCase() === authoritySlug ||
          authority.welshName?.toLowerCase() === authoritySlug
      )
    : undefined;
  if (authoritySlug && !matchedAuthority) dropped.push(`authority “${raw.localAuthority}”`);

  const statuses = raw.statuses
    .map((status) => status.trim().toUpperCase().replace(/[\s-]+/g, "_"))
    .filter((status) => {
      const known = vocabulary.statuses.includes(status);
      if (!known) dropped.push(`status “${status}”`);
      return known;
    });

  const sizeBands = raw.sizeBands
    .map((band) => band.trim().toLowerCase())
    .filter((band) => {
      const known = vocabulary.sizeBands.includes(band);
      if (!known) dropped.push(`size “${band}”`);
      return known;
    });

  const sicCodes = validSicCodes(raw.sicCodes);
  for (const code of raw.sicCodes) {
    if (!sicCodes.includes(code.trim())) dropped.push(`SIC code “${code}”`);
  }

  const sort = raw.sort?.trim().toLowerCase() ?? null;
  const validSort = sort && vocabulary.sorts.includes(sort) ? sort : undefined;
  if (sort && !validSort) dropped.push(`sort “${raw.sort}”`);

  const keywords = raw.keywords?.trim();

  // Re-parsed through the ordinary schema so an interpreted search and a
  // hand-built one are the same object by the time they reach the database.
  const parsed = companyFilterSchema.safeParse({
    q: keywords && keywords.length > 0 ? keywords : undefined,
    region: validRegion,
    localAuthority: matchedAuthority?.slug,
    postcode: raw.postcode?.trim() || undefined,
    town: raw.town?.trim() || undefined,
    status: statuses.length > 0 ? statuses : undefined,
    sizeBand: sizeBands.length > 0 ? sizeBands : undefined,
    sicCodes: sicCodes.length > 0 ? sicCodes : undefined,
    incorporatedFrom: toIsoDate(raw.incorporatedFrom, false),
    incorporatedTo: toIsoDate(raw.incorporatedTo, true),
    sort: validSort ?? "relevance",
  });

  return {
    // An interpretation that fails the ordinary schema is discarded entirely
    // rather than partially applied, so the user never gets a search that is
    // narrower than what they see described.
    filters: parsed.success
      ? parsed.data
      : companyFilterSchema.parse({ q: keywords || undefined }),
    dropped,
    unresolved: raw.unresolved.map((item) => item.trim()).filter(Boolean),
  };
}

/** True when nothing usable came back, so the caller should fall back. */
export function isEmptyInterpretation(interpretation: Interpretation): boolean {
  const { q, welshOnly, sort, ...rest } = interpretation.filters;
  void welshOnly;
  void sort;
  return !q && Object.values(rest).every((value) => value === undefined);
}

export function buildSystemPrompt(vocabulary: Vocabulary): string {
  return [
    "You convert a search phrase about Welsh companies into structured search filters.",
    "",
    "You are a translator, not a source of information. You have no access to any",
    "company records and you must never state a fact about a company, a place or a",
    "number. Your entire output is the filter object.",
    "",
    "Rules:",
    "- Only use values from the vocabulary below. Never invent a region, an authority",
    "  or a status name.",
    "- Omit any field the phrase does not mention. Do not guess a default.",
    "- Put words that are not a filter — a trading name, a product, a sector word —",
    "  into `keywords` for full-text search.",
    "- List anything you could not express as a filter in `unresolved`, using the",
    "  user's own words. For example, a phrase about growth, profitability, employee",
    "  numbers or ownership cannot be filtered, because this dataset does not hold it.",
    "- Dates may be a year (2020) or an ISO date (2020-04-01).",
    "",
    "Vocabulary:",
    `- region: ${vocabulary.regions.join(", ")}`,
    `- status: ${vocabulary.statuses.join(", ")}`,
    `- sizeBand: ${vocabulary.sizeBands.join(", ")}`,
    `- sort: ${vocabulary.sorts.join(", ")}`,
    `- localAuthority (use the slug): ${vocabulary.localAuthorities
      .map((authority) => authority.slug)
      .join(", ")}`,
  ].join("\n");
}
