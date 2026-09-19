import type { DataSourceCategory, DataSourceStatus } from "@/generated/prisma/enums";

/**
 * The registry of external datasets.
 *
 * Every entry states plainly what it is, who publishes it, what licence it
 * carries, and what has to be configured before it can run. Entries whose
 * publisher offers no suitable structured feed are registered with status
 * UNAVAILABLE and an explanation — they are never quietly omitted, and they
 * are never backed by invented data.
 *
 * `updateFrequency` records the publisher's own stated cadence. Where the
 * publisher does not state one it is left null rather than guessed.
 */

export type SourceDefinition = {
  key: string;
  name: string;
  organisation: string;
  category: DataSourceCategory;
  description: string;
  homepageUrl: string;
  docsUrl?: string;
  licence?: string;
  licenceUrl?: string;
  usageRestrictions?: string;
  /** Publisher's stated refresh cadence; null when not published. */
  updateFrequency: string | null;
  /** Our own pull schedule (cron, UTC). Null for sources we cannot pull. */
  schedule: string | null;
  requiredEnvVars: string[];
  /**
   * Status to register the source with when its environment variables are
   * absent. UNAVAILABLE means "no suitable structured feed exists yet", which
   * is a different and more honest statement than "not configured".
   */
  defaultStatus: Extract<DataSourceStatus, "NOT_CONFIGURED" | "UNAVAILABLE">;
  statusMessage?: string;
};

export const SOURCE_DEFINITIONS: SourceDefinition[] = [
  {
    key: "companies_house",
    name: "Companies House Public Data API",
    organisation: "Companies House (UK Government)",
    category: "COMPANIES",
    description:
      "The statutory register of UK companies: profiles, registered offices, " +
      "officers, persons with significant control, filing history and charges.",
    homepageUrl: "https://www.gov.uk/government/organisations/companies-house",
    docsUrl: "https://developer.company-information.service.gov.uk/",
    licence: "Open Government Licence v3.0",
    licenceUrl: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
    usageRestrictions:
      "Attribution required. Personal data (officer dates of birth, addresses) " +
      "must be handled in line with the Companies House terms of use.",
    updateFrequency: "Continuously, as filings are accepted",
    schedule: "0 2 * * *",
    requiredEnvVars: ["COMPANIES_HOUSE_API_KEY"],
    defaultStatus: "NOT_CONFIGURED",
    statusMessage:
      "Set COMPANIES_HOUSE_API_KEY to a key registered at " +
      "developer.company-information.service.gov.uk.",
  },
  {
    key: "sell2wales",
    name: "Sell2Wales procurement notices (OCDS)",
    organisation: "Welsh Government",
    category: "PROCUREMENT",
    description:
      "Public sector contract notices, tenders and awards published by Welsh " +
      "buying organisations, consumed as Open Contracting Data Standard releases.",
    homepageUrl: "https://www.sell2wales.gov.wales/",
    docsUrl: "https://standard.open-contracting.org/latest/en/",
    licence: "Open Government Licence v3.0",
    licenceUrl: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
    usageRestrictions: "Attribution to Sell2Wales / Welsh Government required.",
    updateFrequency: "Daily, as notices are published",
    schedule: "0 3 * * *",
    requiredEnvVars: ["SELL2WALES_OCDS_BASE"],
    defaultStatus: "NOT_CONFIGURED",
    statusMessage:
      "Set SELL2WALES_OCDS_BASE to the OCDS release-package endpoint. The " +
      "connector reads standard OCDS releases and needs no other configuration.",
  },
  {
    key: "postcodes_io",
    name: "postcodes.io",
    organisation: "Ideal Postcodes (ONS/OS derived data)",
    category: "GEOSPATIAL",
    description:
      "Open UK postcode lookup used to convert postcodes to coordinates and to " +
      "confirm, authoritatively, whether an address is in Wales and which " +
      "unitary authority it falls in.",
    homepageUrl: "https://postcodes.io/",
    docsUrl: "https://postcodes.io/docs",
    licence: "Open Government Licence v3.0 (contains OS and ONS data)",
    licenceUrl: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
    usageRestrictions:
      "Contains OS data © Crown copyright and database right; ONS and Royal Mail " +
      "copyright acknowledgements required.",
    updateFrequency: "Quarterly, following the ONS Postcode Directory",
    schedule: null,
    requiredEnvVars: [],
    defaultStatus: "NOT_CONFIGURED",
  },
  {
    key: "datamapwales",
    name: "DataMapWales",
    organisation: "Welsh Government",
    category: "GEOSPATIAL",
    description:
      "Welsh Government geospatial platform publishing OGC services (WMS/WFS) " +
      "and GeoJSON for Welsh administrative and planning-related datasets.",
    homepageUrl: "https://datamap.gov.wales/",
    licence: "Varies per dataset — each layer carries its own licence",
    licenceUrl: "https://datamap.gov.wales/",
    usageRestrictions:
      "Each layer must be checked individually; some datasets are not openly " +
      "licensed for redistribution. Only openly licensed layers are ingested.",
    updateFrequency: null,
    schedule: null,
    requiredEnvVars: [],
    defaultStatus: "NOT_CONFIGURED",
    statusMessage:
      "Layer-by-layer configuration required. Add a layer in admin with its " +
      "service URL and confirmed licence before it will be ingested.",
  },
  {
    key: "planning_wales",
    name: "Welsh planning applications",
    organisation: "Welsh planning authorities (25 separate publishers)",
    category: "PLANNING",
    description:
      "Planning application registers. Wales has 25 planning authorities (22 " +
      "unitary authorities and 3 national park authorities), each publishing " +
      "independently. Each authority is configured as its own connector.",
    homepageUrl: "https://gov.wales/planning",
    licence: "Varies per authority",
    updateFrequency: null,
    schedule: "0 4 * * *",
    requiredEnvVars: [],
    defaultStatus: "UNAVAILABLE",
    statusMessage:
      "No single Welsh planning API exists. Each authority must be enabled " +
      "individually in Admin → Sources → Planning once a structured feed " +
      "(API, GeoJSON, CSV or ArcGIS FeatureServer) has been identified and its " +
      "licence confirmed. Authorities without a usable feed stay unavailable; " +
      "no planning data is generated for them.",
  },
  {
    key: "funding_wales",
    name: "Welsh business funding opportunities",
    organisation: "Multiple public funders",
    category: "FUNDING",
    description:
      "Grant, loan and support schemes open to Welsh businesses, aggregated " +
      "from public funders that publish a structured feed.",
    homepageUrl: "https://businesswales.gov.wales/funding",
    licence: "Varies per funder",
    updateFrequency: null,
    schedule: "0 5 * * *",
    requiredEnvVars: [],
    defaultStatus: "UNAVAILABLE",
    statusMessage:
      "Each funder is enabled individually once a structured feed (API, RSS, " +
      "Atom, CSV or JSON) has been identified and its terms permit automated " +
      "access. Funders are never scraped from HTML in breach of their terms.",
  },
];

/**
 * Welsh planning authorities, registered so the admin screen can show the true
 * connected/total count. `connectorKey` names the parser to use once a feed is
 * configured; `null` means no feed has been identified yet.
 *
 * Common Welsh planning portal software families are Idox Public Access,
 * Ocella and ArcGIS-hosted layers. Parsers exist for these shapes, but a
 * parser is not a feed: an authority is only marked CONNECTED once its
 * specific endpoint and licence have been verified and set in admin.
 */
export type PlanningAuthoritySeed = {
  name: string;
  slug: string;
  localAuthoritySlug: string | null;
  connectorKey: string | null;
  portalUrl: string | null;
  status: Extract<DataSourceStatus, "UNAVAILABLE" | "NOT_CONFIGURED">;
  statusMessage: string;
};

const NEEDS_FEED =
  "No structured feed configured. Add an endpoint and confirm its licence in " +
  "Admin → Sources → Planning to enable ingestion for this authority.";

export const PLANNING_AUTHORITY_SEEDS: PlanningAuthoritySeed[] = [
  { name: "Isle of Anglesey County Council", slug: "isle-of-anglesey", localAuthoritySlug: "isle-of-anglesey", connectorKey: null, portalUrl: null, status: "UNAVAILABLE", statusMessage: NEEDS_FEED },
  { name: "Gwynedd Council", slug: "gwynedd", localAuthoritySlug: "gwynedd", connectorKey: null, portalUrl: null, status: "UNAVAILABLE", statusMessage: NEEDS_FEED },
  { name: "Conwy County Borough Council", slug: "conwy", localAuthoritySlug: "conwy", connectorKey: null, portalUrl: null, status: "UNAVAILABLE", statusMessage: NEEDS_FEED },
  { name: "Denbighshire County Council", slug: "denbighshire", localAuthoritySlug: "denbighshire", connectorKey: null, portalUrl: null, status: "UNAVAILABLE", statusMessage: NEEDS_FEED },
  { name: "Flintshire County Council", slug: "flintshire", localAuthoritySlug: "flintshire", connectorKey: null, portalUrl: null, status: "UNAVAILABLE", statusMessage: NEEDS_FEED },
  { name: "Wrexham County Borough Council", slug: "wrexham", localAuthoritySlug: "wrexham", connectorKey: null, portalUrl: null, status: "UNAVAILABLE", statusMessage: NEEDS_FEED },
  { name: "Ceredigion County Council", slug: "ceredigion", localAuthoritySlug: "ceredigion", connectorKey: null, portalUrl: null, status: "UNAVAILABLE", statusMessage: NEEDS_FEED },
  { name: "Powys County Council", slug: "powys", localAuthoritySlug: "powys", connectorKey: null, portalUrl: null, status: "UNAVAILABLE", statusMessage: NEEDS_FEED },
  { name: "Pembrokeshire County Council", slug: "pembrokeshire", localAuthoritySlug: "pembrokeshire", connectorKey: null, portalUrl: null, status: "UNAVAILABLE", statusMessage: NEEDS_FEED },
  { name: "Carmarthenshire County Council", slug: "carmarthenshire", localAuthoritySlug: "carmarthenshire", connectorKey: null, portalUrl: null, status: "UNAVAILABLE", statusMessage: NEEDS_FEED },
  { name: "Swansea Council", slug: "swansea", localAuthoritySlug: "swansea", connectorKey: null, portalUrl: null, status: "UNAVAILABLE", statusMessage: NEEDS_FEED },
  { name: "Neath Port Talbot Council", slug: "neath-port-talbot", localAuthoritySlug: "neath-port-talbot", connectorKey: null, portalUrl: null, status: "UNAVAILABLE", statusMessage: NEEDS_FEED },
  { name: "Bridgend County Borough Council", slug: "bridgend", localAuthoritySlug: "bridgend", connectorKey: null, portalUrl: null, status: "UNAVAILABLE", statusMessage: NEEDS_FEED },
  { name: "Vale of Glamorgan Council", slug: "vale-of-glamorgan", localAuthoritySlug: "vale-of-glamorgan", connectorKey: null, portalUrl: null, status: "UNAVAILABLE", statusMessage: NEEDS_FEED },
  { name: "Cardiff Council", slug: "cardiff", localAuthoritySlug: "cardiff", connectorKey: null, portalUrl: null, status: "UNAVAILABLE", statusMessage: NEEDS_FEED },
  { name: "Rhondda Cynon Taf County Borough Council", slug: "rhondda-cynon-taf", localAuthoritySlug: "rhondda-cynon-taf", connectorKey: null, portalUrl: null, status: "UNAVAILABLE", statusMessage: NEEDS_FEED },
  { name: "Merthyr Tydfil County Borough Council", slug: "merthyr-tydfil", localAuthoritySlug: "merthyr-tydfil", connectorKey: null, portalUrl: null, status: "UNAVAILABLE", statusMessage: NEEDS_FEED },
  { name: "Caerphilly County Borough Council", slug: "caerphilly", localAuthoritySlug: "caerphilly", connectorKey: null, portalUrl: null, status: "UNAVAILABLE", statusMessage: NEEDS_FEED },
  { name: "Blaenau Gwent County Borough Council", slug: "blaenau-gwent", localAuthoritySlug: "blaenau-gwent", connectorKey: null, portalUrl: null, status: "UNAVAILABLE", statusMessage: NEEDS_FEED },
  { name: "Torfaen County Borough Council", slug: "torfaen", localAuthoritySlug: "torfaen", connectorKey: null, portalUrl: null, status: "UNAVAILABLE", statusMessage: NEEDS_FEED },
  { name: "Monmouthshire County Council", slug: "monmouthshire", localAuthoritySlug: "monmouthshire", connectorKey: null, portalUrl: null, status: "UNAVAILABLE", statusMessage: NEEDS_FEED },
  { name: "Newport City Council", slug: "newport", localAuthoritySlug: "newport", connectorKey: null, portalUrl: null, status: "UNAVAILABLE", statusMessage: NEEDS_FEED },
  { name: "Snowdonia National Park Authority", slug: "snowdonia-national-park", localAuthoritySlug: null, connectorKey: null, portalUrl: null, status: "UNAVAILABLE", statusMessage: NEEDS_FEED },
  { name: "Pembrokeshire Coast National Park Authority", slug: "pembrokeshire-coast-national-park", localAuthoritySlug: null, connectorKey: null, portalUrl: null, status: "UNAVAILABLE", statusMessage: NEEDS_FEED },
  { name: "Brecon Beacons National Park Authority", slug: "brecon-beacons-national-park", localAuthoritySlug: null, connectorKey: null, portalUrl: null, status: "UNAVAILABLE", statusMessage: NEEDS_FEED },
];

export function findSourceDefinition(key: string): SourceDefinition | undefined {
  return SOURCE_DEFINITIONS.find((source) => source.key === key);
}
