import "server-only";

import { HttpClient } from "@/lib/http/client";
import type { PlanningConnectorConfig } from "@/lib/sources/planning/config";
import type { RawPlanningRecord } from "@/lib/sources/planning/normalise";

/**
 * Adapters for the machine-readable formats Welsh planning authorities
 * actually publish in.
 *
 * Each adapter yields pages of raw records; interpreting their fields is the
 * normaliser's job. Pagination differs per format, which is the whole reason
 * these are separate.
 *
 * Every adapter is polite: modest page sizes, a conservative rate limit, and a
 * hard cap on pages so a misbehaving endpoint cannot make us hammer a council.
 */

const MAX_PAGES = 200;
const RATE_LIMIT = { limit: 30, windowMs: 60_000 };

export type AdapterPage = {
  records: RawPlanningRecord[];
  /** Offset to resume from, or null when the feed is exhausted. */
  nextOffset: number | null;
};

export type PlanningAdapter = (
  config: PlanningConnectorConfig,
  offset: number,
  signal?: AbortSignal
) => Promise<AdapterPage>;

function clientFor(config: PlanningConnectorConfig, name: string): HttpClient {
  const url = new URL(config.endpoint);
  return new HttpClient({
    name,
    baseUrl: `${url.protocol}//${url.host}`,
    rateLimit: RATE_LIMIT,
    defaultHeaders: { accept: "application/json" },
  });
}

/**
 * ArcGIS FeatureServer / MapServer.
 *
 * The most common way a Welsh authority publishes planning data as open data.
 * `exceededTransferLimit` is the server telling us there is more; when it is
 * absent the page is the last one.
 */
type ArcGisResponse = {
  features?: Array<{ attributes?: Record<string, unknown>; geometry?: Record<string, unknown> }>;
  exceededTransferLimit?: boolean;
  error?: { message?: string };
};

const arcgisAdapter: PlanningAdapter = async (config, offset, signal) => {
  const client = clientFor(config, "arcgis");
  const response = await client.getJson<ArcGisResponse>(config.endpoint, {
    query: {
      where: "1=1",
      outFields: "*",
      returnGeometry: "true",
      outSR: "4326",
      f: "json",
      resultOffset: offset,
      resultRecordCount: config.pageSize,
    },
    signal,
  });

  if (!response) return { records: [], nextOffset: null };
  if (response.error) {
    throw new Error(`ArcGIS error: ${response.error.message ?? "unknown"}`);
  }

  const features = response.features ?? [];
  // Attributes and geometry are flattened together so a field map can address
  // either, e.g. "REF" or "geometry.x".
  const records: RawPlanningRecord[] = features.map((feature) => ({
    ...(feature.attributes ?? {}),
    geometry: feature.geometry ?? null,
  }));

  const more = response.exceededTransferLimit === true && features.length > 0;
  return { records, nextOffset: more ? offset + features.length : null };
};

/** CKAN datastore — the shape used by most UK open-data portals. */
type CkanResponse = {
  success?: boolean;
  error?: { message?: string };
  result?: { records?: RawPlanningRecord[]; total?: number };
};

const ckanAdapter: PlanningAdapter = async (config, offset, signal) => {
  const client = clientFor(config, "ckan");
  const response = await client.getJson<CkanResponse>(config.endpoint, {
    query: {
      resource_id: config.resourceId,
      limit: config.pageSize,
      offset,
    },
    signal,
  });

  if (!response || response.success === false) {
    throw new Error(`CKAN error: ${response?.error?.message ?? "request failed"}`);
  }

  const records = response.result?.records ?? [];
  const total = response.result?.total ?? 0;
  const consumed = offset + records.length;

  return {
    records,
    nextOffset: records.length > 0 && consumed < total ? consumed : null,
  };
};

/**
 * A GeoJSON FeatureCollection.
 *
 * Usually a single file rather than a paginated API, so it is read once and
 * sliced locally — the whole document has to be fetched either way.
 */
type GeoJsonResponse = {
  features?: Array<{
    properties?: Record<string, unknown>;
    geometry?: { type?: string; coordinates?: unknown };
  }>;
};

const geojsonAdapter: PlanningAdapter = async (config, offset, signal) => {
  const client = clientFor(config, "geojson");
  const response = await client.getJson<GeoJsonResponse>(config.endpoint, { signal });

  const features = response?.features ?? [];
  const page = features.slice(offset, offset + config.pageSize);

  const records: RawPlanningRecord[] = page.map((feature) => {
    const coordinates = feature.geometry?.coordinates;
    // GeoJSON positions are [longitude, latitude], in that order.
    const point = Array.isArray(coordinates) && typeof coordinates[0] === "number"
      ? { longitude: coordinates[0] as number, latitude: coordinates[1] as number }
      : {};
    return { ...(feature.properties ?? {}), ...point };
  });

  const consumed = offset + page.length;
  return { records, nextOffset: consumed < features.length ? consumed : null };
};

/** A plain JSON array, or an object with a records array. */
const jsonArrayAdapter: PlanningAdapter = async (config, offset, signal) => {
  const client = clientFor(config, "json");
  const response = await client.getJson<unknown>(config.endpoint, { signal });

  const all: RawPlanningRecord[] = Array.isArray(response)
    ? (response as RawPlanningRecord[])
    : Array.isArray((response as { records?: unknown })?.records)
      ? ((response as { records: RawPlanningRecord[] }).records)
      : [];

  const page = all.slice(offset, offset + config.pageSize);
  const consumed = offset + page.length;
  return { records: page, nextOffset: consumed < all.length ? consumed : null };
};

const ADAPTERS: Record<string, PlanningAdapter> = {
  arcgis_feature_server: arcgisAdapter,
  ckan_datastore: ckanAdapter,
  geojson: geojsonAdapter,
  json_array: jsonArrayAdapter,
};

export function getPlanningAdapter(key: string): PlanningAdapter | undefined {
  return ADAPTERS[key];
}

export { MAX_PAGES };
