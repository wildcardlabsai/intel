import { z } from "zod";

import { checkUrlShape } from "@/lib/http/ssrf";

/**
 * Per-authority planning connector configuration.
 *
 * Welsh planning data has no single national feed: each of the 25 authorities
 * publishes — or does not publish — separately, in its own shape. Rather than
 * writing 25 parsers, the shape of each authority's data is held as
 * configuration: which adapter reads it, where it lives, and which of its
 * field names correspond to ours.
 *
 * Connecting an authority is therefore a configuration change, not a deploy.
 * An authority with no configuration stays UNAVAILABLE and its absence is
 * stated on the planning page — never filled in with invented records.
 */

/** Adapters that read genuinely machine-readable, documented formats. */
export const PLANNING_ADAPTERS = [
  "arcgis_feature_server",
  "ckan_datastore",
  "geojson",
  "json_array",
] as const;

export type PlanningAdapterKey = (typeof PLANNING_ADAPTERS)[number];

/**
 * Adapters that are recognised but deliberately not implemented.
 *
 * Idox, Ocella and similar planning portals publish search results as HTML
 * intended for a browser. Scraping them would put load on a public service in
 * a way its terms do not contemplate, and would break on any redesign. An
 * authority on one of these is recorded honestly as unsupported rather than
 * quietly scraped — or, worse, quietly populated with nothing.
 */
export const UNSUPPORTED_ADAPTERS: Record<string, string> = {
  idox_html:
    "This authority publishes planning data only as HTML search pages (Idox Public Access). " +
    "There is no machine-readable feed to read, and scraping the portal is not something we do. " +
    "Ask the authority to publish an open data endpoint.",
  ocella_html:
    "This authority publishes planning data only as HTML search pages (Ocella). " +
    "There is no machine-readable feed to read.",
  none:
    "This authority does not publish planning data in any machine-readable form that we can find.",
};

/**
 * Maps this authority's own field names onto ours.
 *
 * Only `reference` is required: everything else is genuinely optional, because
 * authorities publish different subsets and a field we cannot find must stay
 * null rather than being guessed at.
 */
export const fieldMapSchema = z.object({
  reference: z.string().min(1),
  siteAddress: z.string().optional(),
  postcode: z.string().optional(),
  description: z.string().optional(),
  applicationType: z.string().optional(),
  status: z.string().optional(),
  decision: z.string().optional(),
  submittedOn: z.string().optional(),
  validatedOn: z.string().optional(),
  consultationEndsOn: z.string().optional(),
  decidedOn: z.string().optional(),
  applicantName: z.string().optional(),
  agentName: z.string().optional(),
  /** WGS84 degrees. */
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  /** British National Grid metres, converted to WGS84 when present. */
  easting: z.string().optional(),
  northing: z.string().optional(),
  dwellingCount: z.string().optional(),
  /** A field holding the record's own URL at the authority. */
  url: z.string().optional(),
});

export type FieldMap = z.infer<typeof fieldMapSchema>;

export const planningConnectorConfigSchema = z.object({
  adapter: z.enum(PLANNING_ADAPTERS),
  /** The endpoint to read. Must be https — planning data is public, not secret, but the transport still matters. */
  endpoint: z.string().url(),
  fieldMap: fieldMapSchema,
  /**
   * Maps this authority's own status words onto our PlanningStatus enum.
   * Anything unmapped becomes UNKNOWN rather than being guessed.
   */
  statusMap: z.record(z.string(), z.string()).default({}),
  categoryMap: z.record(z.string(), z.string()).default({}),
  /** Template for the public record URL, with {reference} substituted. */
  recordUrlTemplate: z.string().optional(),
  /** Records per request. Kept modest so a run stays polite. */
  pageSize: z.coerce.number().int().min(1).max(2000).default(200),
  /** CKAN only: the resource id to read. */
  resourceId: z.string().optional(),
  licence: z.string().optional(),
});

export type PlanningConnectorConfig = z.infer<typeof planningConnectorConfigSchema>;

export type ConfigCheck =
  | { ok: true; config: PlanningConnectorConfig }
  | { ok: false; reason: string };

/**
 * Reads an authority's stored configuration.
 *
 * A misconfigured authority is reported with the reason, never treated as
 * "no data": the planning page distinguishes "we have not connected this
 * authority" from "this authority has no applications".
 */
export function readPlanningConfig(
  connectorKey: string | null,
  raw: unknown
): ConfigCheck {
  if (!connectorKey) {
    return { ok: false, reason: "No adapter has been chosen for this authority." };
  }

  const unsupported = UNSUPPORTED_ADAPTERS[connectorKey];
  if (unsupported) return { ok: false, reason: unsupported };

  if (!(PLANNING_ADAPTERS as readonly string[]).includes(connectorKey)) {
    return { ok: false, reason: `Unknown planning adapter “${connectorKey}”.` };
  }

  const parsed = planningConnectorConfigSchema.safeParse({
    ...(typeof raw === "object" && raw !== null ? raw : {}),
    adapter: connectorKey,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      reason: `Configuration is incomplete: ${issue?.path.join(".") || "(root)"} — ${issue?.message}.`,
    };
  }

  // The endpoint is typed into a form by an administrator and then fetched by
  // the server, so it is checked against the non-routable ranges before it is
  // ever stored. The hostname is resolved and re-checked at fetch time.
  const urlCheck = checkUrlShape(parsed.data.endpoint);
  if (!urlCheck.ok) {
    return { ok: false, reason: urlCheck.reason };
  }

  if (parsed.data.adapter === "ckan_datastore" && !parsed.data.resourceId) {
    return { ok: false, reason: "A CKAN datastore needs a resourceId." };
  }

  return { ok: true, config: parsed.data };
}
