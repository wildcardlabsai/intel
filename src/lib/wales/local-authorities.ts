import type { WelshRegion } from "@/generated/prisma/enums";

/**
 * The 22 Welsh unitary (principal) authorities, with their ONS GSS codes.
 *
 * Region grouping note: "North/Mid/West/South/South East Wales" is a product
 * grouping used for filtering, not an official statistical geography. ONS does
 * not divide Wales this way, so the mapping is declared explicitly here rather
 * than implied anywhere in the codebase.
 */

export type LocalAuthoritySeed = {
  name: string;
  welshName: string;
  slug: string;
  gssCode: string;
  region: WelshRegion;
  /** Approximate administrative centre, used to centre the map on selection. */
  centroidLat: number;
  centroidLng: number;
};

export const WELSH_LOCAL_AUTHORITIES: LocalAuthoritySeed[] = [
  // --- North Wales ---------------------------------------------------------
  { name: "Isle of Anglesey", welshName: "Ynys Môn", slug: "isle-of-anglesey", gssCode: "W06000001", region: "NORTH_WALES", centroidLat: 53.2707, centroidLng: -4.3409 },
  { name: "Gwynedd", welshName: "Gwynedd", slug: "gwynedd", gssCode: "W06000002", region: "NORTH_WALES", centroidLat: 52.9277, centroidLng: -4.1332 },
  { name: "Conwy", welshName: "Conwy", slug: "conwy", gssCode: "W06000003", region: "NORTH_WALES", centroidLat: 53.2820, centroidLng: -3.8300 },
  { name: "Denbighshire", welshName: "Sir Ddinbych", slug: "denbighshire", gssCode: "W06000004", region: "NORTH_WALES", centroidLat: 53.1836, centroidLng: -3.4200 },
  { name: "Flintshire", welshName: "Sir y Fflint", slug: "flintshire", gssCode: "W06000005", region: "NORTH_WALES", centroidLat: 53.1667, centroidLng: -3.1333 },
  { name: "Wrexham", welshName: "Wrecsam", slug: "wrexham", gssCode: "W06000006", region: "NORTH_WALES", centroidLat: 53.0430, centroidLng: -2.9925 },

  // --- Mid Wales -----------------------------------------------------------
  { name: "Ceredigion", welshName: "Ceredigion", slug: "ceredigion", gssCode: "W06000008", region: "MID_WALES", centroidLat: 52.2180, centroidLng: -4.0000 },
  { name: "Powys", welshName: "Powys", slug: "powys", gssCode: "W06000023", region: "MID_WALES", centroidLat: 52.3000, centroidLng: -3.4000 },

  // --- West Wales ----------------------------------------------------------
  { name: "Pembrokeshire", welshName: "Sir Benfro", slug: "pembrokeshire", gssCode: "W06000009", region: "WEST_WALES", centroidLat: 51.8000, centroidLng: -4.9000 },
  { name: "Carmarthenshire", welshName: "Sir Gaerfyrddin", slug: "carmarthenshire", gssCode: "W06000010", region: "WEST_WALES", centroidLat: 51.8556, centroidLng: -4.3100 },
  { name: "Swansea", welshName: "Abertawe", slug: "swansea", gssCode: "W06000011", region: "WEST_WALES", centroidLat: 51.6214, centroidLng: -3.9436 },
  { name: "Neath Port Talbot", welshName: "Castell-nedd Port Talbot", slug: "neath-port-talbot", gssCode: "W06000012", region: "WEST_WALES", centroidLat: 51.6600, centroidLng: -3.8000 },

  // --- South Wales ---------------------------------------------------------
  { name: "Bridgend", welshName: "Pen-y-bont ar Ogwr", slug: "bridgend", gssCode: "W06000013", region: "SOUTH_WALES", centroidLat: 51.5045, centroidLng: -3.5766 },
  { name: "Vale of Glamorgan", welshName: "Bro Morgannwg", slug: "vale-of-glamorgan", gssCode: "W06000014", region: "SOUTH_WALES", centroidLat: 51.4400, centroidLng: -3.4200 },
  { name: "Cardiff", welshName: "Caerdydd", slug: "cardiff", gssCode: "W06000015", region: "SOUTH_WALES", centroidLat: 51.4816, centroidLng: -3.1791 },
  { name: "Rhondda Cynon Taf", welshName: "Rhondda Cynon Taf", slug: "rhondda-cynon-taf", gssCode: "W06000016", region: "SOUTH_WALES", centroidLat: 51.6500, centroidLng: -3.4000 },
  { name: "Merthyr Tydfil", welshName: "Merthyr Tudful", slug: "merthyr-tydfil", gssCode: "W06000024", region: "SOUTH_WALES", centroidLat: 51.7430, centroidLng: -3.3780 },

  // --- South East Wales ----------------------------------------------------
  { name: "Caerphilly", welshName: "Caerffili", slug: "caerphilly", gssCode: "W06000018", region: "SOUTH_EAST_WALES", centroidLat: 51.5786, centroidLng: -3.2180 },
  { name: "Blaenau Gwent", welshName: "Blaenau Gwent", slug: "blaenau-gwent", gssCode: "W06000019", region: "SOUTH_EAST_WALES", centroidLat: 51.7800, centroidLng: -3.2000 },
  { name: "Torfaen", welshName: "Torfaen", slug: "torfaen", gssCode: "W06000020", region: "SOUTH_EAST_WALES", centroidLat: 51.7000, centroidLng: -3.0500 },
  { name: "Monmouthshire", welshName: "Sir Fynwy", slug: "monmouthshire", gssCode: "W06000021", region: "SOUTH_EAST_WALES", centroidLat: 51.7500, centroidLng: -2.8000 },
  { name: "Newport", welshName: "Casnewydd", slug: "newport", gssCode: "W06000022", region: "SOUTH_EAST_WALES", centroidLat: 51.5842, centroidLng: -2.9977 },
];

/** Welsh national park authorities are separate planning authorities. */
export const WELSH_NATIONAL_PARK_AUTHORITIES = [
  { name: "Snowdonia National Park Authority", welshName: "Awdurdod Parc Cenedlaethol Eryri", slug: "snowdonia-national-park" },
  { name: "Pembrokeshire Coast National Park Authority", welshName: "Awdurdod Parc Cenedlaethol Arfordir Penfro", slug: "pembrokeshire-coast-national-park" },
  { name: "Brecon Beacons National Park Authority", welshName: "Awdurdod Parc Cenedlaethol Bannau Brycheiniog", slug: "brecon-beacons-national-park" },
];

const BY_SLUG = new Map(WELSH_LOCAL_AUTHORITIES.map((la) => [la.slug, la]));
const BY_GSS = new Map(WELSH_LOCAL_AUTHORITIES.map((la) => [la.gssCode, la]));

/**
 * Lookup by the authority name as published by a third party (postcodes.io,
 * a planning portal, an OCDS buyer record). Matching is case- and
 * punctuation-insensitive and covers the Welsh-language name.
 */
const BY_NAME = new Map<string, LocalAuthoritySeed>();
for (const la of WELSH_LOCAL_AUTHORITIES) {
  BY_NAME.set(normaliseAuthorityName(la.name), la);
  BY_NAME.set(normaliseAuthorityName(la.welshName), la);
}
// Aliases seen in published datasets that do not match the canonical name.
const AUTHORITY_ALIASES: Record<string, string> = {
  "anglesey": "isle-of-anglesey",
  "ynys mon": "isle-of-anglesey",
  "city and county of swansea": "swansea",
  "city of cardiff": "cardiff",
  "cardiff council": "cardiff",
  "the vale of glamorgan": "vale-of-glamorgan",
  "rhondda cynon taff": "rhondda-cynon-taf",
  "merthyr tydfil county borough": "merthyr-tydfil",
  "newport city": "newport",
  "wrexham county borough": "wrexham",
  "county borough of bridgend": "bridgend",
};
for (const [alias, slug] of Object.entries(AUTHORITY_ALIASES)) {
  const la = BY_SLUG.get(slug);
  if (la) BY_NAME.set(normaliseAuthorityName(alias), la);
}

export function normaliseAuthorityName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    // Strip diacritics so "Ynys Môn" matches "ynys mon".
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(county borough council|county council|city council|borough council|council|authority|cbc)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function findLocalAuthorityByName(name: string | null | undefined): LocalAuthoritySeed | null {
  if (!name) return null;
  return BY_NAME.get(normaliseAuthorityName(name)) ?? null;
}

export function findLocalAuthorityBySlug(slug: string): LocalAuthoritySeed | null {
  return BY_SLUG.get(slug) ?? null;
}

export function findLocalAuthorityByGssCode(code: string): LocalAuthoritySeed | null {
  return BY_GSS.get(code) ?? null;
}

export const WELSH_REGION_LABELS: Record<WelshRegion, string> = {
  NORTH_WALES: "North Wales",
  MID_WALES: "Mid Wales",
  WEST_WALES: "West Wales",
  SOUTH_WALES: "South Wales",
  SOUTH_EAST_WALES: "South East Wales",
  UNKNOWN: "Unknown",
};
