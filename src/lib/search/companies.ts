import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { CompanyStatus, WelshRegion } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { boundingBox, haversineKm } from "@/lib/geo/postcodes";
import { toSearchQuery, type CompanyFilters, type Pagination, type SearchResult } from "@/lib/search/types";
import { normalisePostcode } from "@/lib/wales/classification";

/**
 * Company search against PostgreSQL full-text search.
 *
 * The tsvector expression here must stay identical to the one in the
 * `20260101000001_search_indexes` migration, otherwise the GIN index is not
 * used and the query degrades to a sequential scan.
 */

export type CompanySearchRow = {
  id: string;
  companyNumber: string;
  name: string;
  status: CompanyStatus;
  town: string | null;
  postcode: string | null;
  region: WelshRegion | null;
  localAuthorityName: string | null;
  incorporatedOn: Date | null;
  sicCodes: string[];
  sizeBand: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
  source: string;
  sourceUrl: string | null;
  lastUpdatedAt: Date;
};

const SEARCH_VECTOR = Prisma.sql`(
  setweight(to_tsvector('english', coalesce(c.name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(c.company_number, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(c.town, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(c.postcode, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(immutable_array_to_string(c.previous_names, ' '), '')), 'C')
)`;

function buildConditions(filters: CompanyFilters): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];

  if (filters.welshOnly) {
    conditions.push(Prisma.sql`c.is_welsh = true`);
  }

  const query = toSearchQuery(filters.q);
  if (query) {
    conditions.push(Prisma.sql`${SEARCH_VECTOR} @@ websearch_to_tsquery('english', ${query})`);
  }

  if (filters.status?.length) {
    conditions.push(
      Prisma.sql`c.status = ANY(${filters.status}::text[]::"CompanyStatus"[])`
    );
  }

  if (filters.sicCodes?.length) {
    // Array overlap: the company has at least one of the requested SIC codes.
    conditions.push(Prisma.sql`c.sic_codes && ${filters.sicCodes}::text[]`);
  }

  if (filters.sectorSlug) {
    conditions.push(
      Prisma.sql`c.primary_sector_id = (SELECT id FROM sectors WHERE slug = ${filters.sectorSlug})`
    );
  }

  if (filters.region) {
    conditions.push(Prisma.sql`c.region = ${filters.region}::"WelshRegion"`);
  }

  if (filters.localAuthority) {
    conditions.push(
      Prisma.sql`c.local_authority_id = (SELECT id FROM local_authorities WHERE slug = ${filters.localAuthority})`
    );
  }

  if (filters.postcode) {
    const full = normalisePostcode(filters.postcode);
    if (full) {
      conditions.push(Prisma.sql`c.postcode = ${full}`);
    } else {
      // Partial postcode (district or area) — prefix match.
      const prefix = filters.postcode.toUpperCase().replace(/\s+/g, "");
      conditions.push(Prisma.sql`replace(c.postcode, ' ', '') LIKE ${`${prefix}%`}`);
    }
  }

  if (filters.town) {
    conditions.push(Prisma.sql`c.town ILIKE ${filters.town}`);
  }

  if (filters.incorporatedFrom) {
    conditions.push(Prisma.sql`c.incorporated_on >= ${new Date(filters.incorporatedFrom)}`);
  }

  if (filters.incorporatedTo) {
    conditions.push(Prisma.sql`c.incorporated_on <= ${new Date(filters.incorporatedTo)}`);
  }

  if (filters.sizeBand?.length) {
    conditions.push(Prisma.sql`c.size_band = ANY(${filters.sizeBand}::text[])`);
  }

  if (filters.hasCharges !== undefined) {
    conditions.push(Prisma.sql`c.has_charges = ${filters.hasCharges}`);
  }

  if (filters.radius) {
    // Narrow with the lat/lng index first; the exact haversine filter is
    // applied afterwards in JavaScript on the much smaller candidate set.
    const box = boundingBox(
      { latitude: filters.radius.latitude, longitude: filters.radius.longitude },
      filters.radius.radiusKm
    );
    conditions.push(
      Prisma.sql`c.latitude BETWEEN ${box.minLat} AND ${box.maxLat}`,
      Prisma.sql`c.longitude BETWEEN ${box.minLng} AND ${box.maxLng}`
    );
  }

  return conditions;
}

function buildOrderBy(filters: CompanyFilters, hasQuery: boolean): Prisma.Sql {
  switch (filters.sort) {
    case "newest":
      return Prisma.sql`ORDER BY c.incorporated_on DESC NULLS LAST`;
    case "oldest":
      return Prisma.sql`ORDER BY c.incorporated_on ASC NULLS LAST`;
    case "name":
      return Prisma.sql`ORDER BY c.name ASC`;
    case "relevance":
    default:
      return hasQuery
        ? Prisma.sql`ORDER BY rank DESC, c.name ASC`
        : Prisma.sql`ORDER BY c.incorporated_on DESC NULLS LAST`;
  }
}

export async function searchCompanies(
  filters: CompanyFilters,
  pagination: Pagination
): Promise<SearchResult<CompanySearchRow>> {
  const startedAt = Date.now();
  const query = toSearchQuery(filters.q);
  const conditions = buildConditions(filters);
  const where = conditions.length
    ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
    : Prisma.empty;

  const rankExpression = query
    ? Prisma.sql`ts_rank(${SEARCH_VECTOR}, websearch_to_tsquery('english', ${query}))`
    : Prisma.sql`0`;

  // A radius search pulls a wider candidate set because the exact distance
  // filter runs after the query.
  const fetchLimit = filters.radius ? pagination.perPage * 6 : pagination.perPage;
  const offset = (pagination.page - 1) * pagination.perPage;

  const [rows, countResult] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        id: string;
        company_number: string;
        name: string;
        status: CompanyStatus;
        town: string | null;
        postcode: string | null;
        region: WelshRegion | null;
        local_authority_name: string | null;
        incorporated_on: Date | null;
        sic_codes: string[];
        size_band: string | null;
        latitude: number | null;
        longitude: number | null;
        source: string;
        source_url: string | null;
        last_updated_at: Date;
        rank: number;
      }>
    >(Prisma.sql`
      SELECT c.id, c.company_number, c.name, c.status, c.town, c.postcode, c.region,
             la.name AS local_authority_name, c.incorporated_on, c.sic_codes,
             c.size_band, c.latitude, c.longitude, c.source, c.source_url,
             c.last_updated_at,
             ${rankExpression} AS rank
      FROM companies c
      LEFT JOIN local_authorities la ON la.id = c.local_authority_id
      ${where}
      ${buildOrderBy(filters, Boolean(query))}
      LIMIT ${fetchLimit} OFFSET ${filters.radius ? 0 : offset}
    `),
    prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count FROM companies c ${where}
    `),
  ]);

  let items: CompanySearchRow[] = rows.map((row) => ({
    id: row.id,
    companyNumber: row.company_number,
    name: row.name,
    status: row.status,
    town: row.town,
    postcode: row.postcode,
    region: row.region,
    localAuthorityName: row.local_authority_name,
    incorporatedOn: row.incorporated_on,
    sicCodes: row.sic_codes ?? [],
    sizeBand: row.size_band,
    latitude: row.latitude,
    longitude: row.longitude,
    distanceKm: null,
    source: row.source,
    sourceUrl: row.source_url,
    lastUpdatedAt: row.last_updated_at,
  }));

  let total = Number(countResult[0]?.count ?? 0);

  if (filters.radius) {
    const centre = { latitude: filters.radius.latitude, longitude: filters.radius.longitude };
    const withinRadius = items
      .map((item) => ({
        ...item,
        distanceKm:
          item.latitude !== null && item.longitude !== null
            ? haversineKm(centre, { latitude: item.latitude, longitude: item.longitude })
            : null,
      }))
      .filter((item) => item.distanceKm !== null && item.distanceKm <= filters.radius!.radiusKm)
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));

    total = withinRadius.length;
    items = withinRadius.slice(offset, offset + pagination.perPage);
  }

  return {
    items,
    total,
    page: pagination.page,
    perPage: pagination.perPage,
    totalPages: Math.max(1, Math.ceil(total / pagination.perPage)),
    query: filters.q ?? null,
    tookMs: Date.now() - startedAt,
  };
}

/** Facet counts shown alongside results so users can see what narrows things. */
export async function getCompanyFacets(filters: CompanyFilters): Promise<{
  regions: Array<{ value: string; count: number }>;
  statuses: Array<{ value: string; count: number }>;
}> {
  const conditions = buildConditions({ ...filters, region: undefined, status: undefined });
  const where = conditions.length
    ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
    : Prisma.empty;

  const [regions, statuses] = await Promise.all([
    prisma.$queryRaw<Array<{ value: string | null; count: bigint }>>(Prisma.sql`
      SELECT c.region::text AS value, COUNT(*)::bigint AS count
      FROM companies c ${where}
      GROUP BY c.region ORDER BY count DESC
    `),
    prisma.$queryRaw<Array<{ value: string | null; count: bigint }>>(Prisma.sql`
      SELECT c.status::text AS value, COUNT(*)::bigint AS count
      FROM companies c ${where}
      GROUP BY c.status ORDER BY count DESC LIMIT 10
    `),
  ]);

  return {
    regions: regions
      .filter((row): row is { value: string; count: bigint } => row.value !== null)
      .map((row) => ({ value: row.value, count: Number(row.count) })),
    statuses: statuses
      .filter((row): row is { value: string; count: bigint } => row.value !== null)
      .map((row) => ({ value: row.value, count: Number(row.count) })),
  };
}
