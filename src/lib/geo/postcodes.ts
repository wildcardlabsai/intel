import "server-only";

import { createHash } from "node:crypto";

import { prisma } from "@/lib/db/prisma";
import { getEnv } from "@/lib/env";
import { HttpClient } from "@/lib/http/client";
import { logger } from "@/lib/logger";
import { normalisePostcode } from "@/lib/wales/classification";

/**
 * Postcode lookup via postcodes.io (open ONS/OS derived data, no API key).
 *
 * This is the authoritative source for two things we must not guess:
 *   - whether an address is actually in Wales;
 *   - which unitary authority it belongs to.
 *
 * Results are cached in the database permanently: postcode geography changes
 * only when ONS republishes, and the cache keeps us well inside the
 * publisher's fair-use expectations during bulk ingestion.
 */

export type PostcodeLookup = {
  postcode: string;
  country: string | null;
  localAuthority: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
};

let client: HttpClient | null = null;

function getClient(): HttpClient {
  if (client) return client;
  const env = getEnv();
  client = new HttpClient({
    name: "postcodes_io",
    baseUrl: env.POSTCODES_IO_BASE,
    defaultHeaders: {
      accept: "application/json",
      "user-agent": "CymruIntelligence/1.0 (+https://cymru-intelligence.wales)",
    },
    // postcodes.io publishes no hard limit but asks for reasonable use.
    rateLimit: { limit: 300, windowMs: 60_000 },
    maxRetries: 3,
    timeoutMs: 15_000,
  });
  return client;
}

/** Test seam. */
export function __setPostcodesClient(next: HttpClient | null): void {
  client = next;
}

type PostcodesIoResult = {
  postcode?: string;
  country?: string;
  admin_district?: string;
  region?: string;
  latitude?: number | null;
  longitude?: number | null;
};

function cacheKeyFor(postcode: string): string {
  return createHash("sha256").update(`postcodes_io:${postcode}`).digest("hex");
}

export async function lookupPostcode(rawPostcode: string | null | undefined): Promise<PostcodeLookup | null> {
  const env = getEnv();
  if (env.GEOCODER_PROVIDER === "none") return null;

  const postcode = normalisePostcode(rawPostcode);
  if (!postcode) return null;

  const queryHash = cacheKeyFor(postcode);

  const cached = await prisma.geocodeCache.findUnique({ where: { queryHash } });
  if (cached) {
    if (!cached.hit) return null;
    const [country, localAuthority] = (cached.precision ?? "|").split("|");
    return {
      postcode,
      country: country || null,
      localAuthority: localAuthority || null,
      region: null,
      latitude: cached.latitude,
      longitude: cached.longitude,
    };
  }

  let result: PostcodesIoResult | null = null;
  try {
    const response = await getClient().getJson<{ status: number; result: PostcodesIoResult | null }>(
      `/postcodes/${encodeURIComponent(postcode)}`
    );
    result = response?.result ?? null;
  } catch (error) {
    // A lookup failure must not fail ingestion. The record is stored without
    // coordinates and picked up by the next geocoding pass.
    logger.warn("postcode lookup failed", {
      postcode,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  if (!result) {
    await prisma.geocodeCache.upsert({
      where: { queryHash },
      create: { queryHash, query: postcode, provider: "postcodes_io", hit: false },
      update: { hit: false },
    });
    return null;
  }

  const lookup: PostcodeLookup = {
    postcode,
    country: result.country ?? null,
    localAuthority: result.admin_district ?? null,
    region: result.region ?? null,
    latitude: result.latitude ?? null,
    longitude: result.longitude ?? null,
  };

  await prisma.geocodeCache.upsert({
    where: { queryHash },
    create: {
      queryHash,
      query: postcode,
      latitude: lookup.latitude,
      longitude: lookup.longitude,
      provider: "postcodes_io",
      // Country and authority are packed into `precision` so the cache stays a
      // single generic table rather than gaining provider-specific columns.
      precision: `${lookup.country ?? ""}|${lookup.localAuthority ?? ""}`,
      hit: true,
    },
    update: {
      latitude: lookup.latitude,
      longitude: lookup.longitude,
      precision: `${lookup.country ?? ""}|${lookup.localAuthority ?? ""}`,
      hit: true,
    },
  });

  return lookup;
}

/** Straight-line distance in kilometres, used for radius search. */
export function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6_371;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Bounding box for a radius search. Used to narrow the SQL before the exact
 * haversine filter, so the lat/lng index does the heavy lifting.
 */
export function boundingBox(
  centre: { latitude: number; longitude: number },
  radiusKm: number
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.cos(toRadians(centre.latitude)) || 1);
  return {
    minLat: centre.latitude - latDelta,
    maxLat: centre.latitude + latDelta,
    minLng: centre.longitude - lngDelta,
    maxLng: centre.longitude + lngDelta,
  };
}
