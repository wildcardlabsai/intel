import "server-only";

import { HttpClient } from "@/lib/http/client";
import { getEnv, IntegrationNotConfiguredError } from "@/lib/env";
import type {
  ChAdvancedSearchResponse,
  ChChargeList,
  ChCompanyProfile,
  ChFilingHistory,
  ChOfficerList,
  ChPscList,
  ChSearchResponse,
} from "@/lib/sources/companies-house/types";

/**
 * Companies House Public Data API client.
 *
 * Authentication is HTTP Basic with the API key as the username and an empty
 * password. The key is read from the server environment and never reaches the
 * browser — all calls go through server components, server actions or route
 * handlers.
 *
 * Rate limiting: Companies House documents 600 requests per five minutes per
 * key and returns 429 when exceeded. The shared sliding-window limiter keeps us
 * under that proactively, and the HTTP client honours Retry-After if we are
 * throttled anyway.
 */

let cachedClient: HttpClient | null = null;
let cachedKey: string | null = null;

export function getCompaniesHouseClient(): HttpClient {
  const env = getEnv();

  if (!env.COMPANIES_HOUSE_API_KEY) {
    throw new IntegrationNotConfiguredError("companies_house", ["COMPANIES_HOUSE_API_KEY"]);
  }

  if (cachedClient && cachedKey === env.COMPANIES_HOUSE_API_KEY) {
    return cachedClient;
  }

  const authorization = `Basic ${Buffer.from(`${env.COMPANIES_HOUSE_API_KEY}:`).toString("base64")}`;

  cachedClient = new HttpClient({
    name: "companies_house",
    baseUrl: env.COMPANIES_HOUSE_API_BASE,
    defaultHeaders: {
      authorization,
      accept: "application/json",
      "user-agent": "CymruIntelligence/1.0 (+https://cymru-intelligence.wales)",
    },
    rateLimit: {
      limit: env.COMPANIES_HOUSE_RATE_LIMIT,
      windowMs: env.COMPANIES_HOUSE_RATE_WINDOW_MS,
    },
    maxRetries: 4,
    timeoutMs: 30_000,
  });
  cachedKey = env.COMPANIES_HOUSE_API_KEY;

  return cachedClient;
}

/** Test seam — lets unit tests inject a client without touching the network. */
export function __setCompaniesHouseClient(client: HttpClient | null): void {
  cachedClient = client;
  cachedKey = client ? "test" : null;
}

export const companiesHouse = {
  /** Public company search. `items_per_page` is capped at 100 by the API. */
  async search(query: string, options: { itemsPerPage?: number; startIndex?: number } = {}) {
    return getCompaniesHouseClient().getJson<ChSearchResponse>("/search/companies", {
      query: {
        q: query,
        items_per_page: options.itemsPerPage ?? 50,
        start_index: options.startIndex ?? 0,
      },
    });
  },

  /**
   * Advanced search. This is the endpoint that supports filtering by location,
   * SIC code, status and incorporation date, which is what makes systematic
   * Welsh company discovery possible.
   */
  async advancedSearch(params: {
    location?: string;
    sicCodes?: string[];
    companyStatus?: string[];
    companyType?: string[];
    incorporatedFrom?: string;
    incorporatedTo?: string;
    size?: number;
    startIndex?: number;
  }) {
    const query: Record<string, string | number | undefined> = {
      location: params.location,
      incorporated_from: params.incorporatedFrom,
      incorporated_to: params.incorporatedTo,
      size: params.size ?? 100,
      start_index: params.startIndex ?? 0,
    };

    // The API takes repeated parameters for these; URLSearchParams in the
    // HttpClient only sets one value per key, so they are joined with commas,
    // which the endpoint also accepts.
    if (params.sicCodes?.length) query.sic_codes = params.sicCodes.join(",");
    if (params.companyStatus?.length) query.company_status = params.companyStatus.join(",");
    if (params.companyType?.length) query.company_type = params.companyType.join(",");

    return getCompaniesHouseClient().getJson<ChAdvancedSearchResponse>(
      "/advanced-search/companies",
      { query }
    );
  },

  async profile(companyNumber: string) {
    return getCompaniesHouseClient().getJson<ChCompanyProfile>(
      `/company/${encodeURIComponent(companyNumber)}`
    );
  },

  async officers(companyNumber: string, options: { itemsPerPage?: number; startIndex?: number } = {}) {
    return getCompaniesHouseClient().getJson<ChOfficerList>(
      `/company/${encodeURIComponent(companyNumber)}/officers`,
      { query: { items_per_page: options.itemsPerPage ?? 100, start_index: options.startIndex ?? 0 } }
    );
  },

  async pscs(companyNumber: string, options: { itemsPerPage?: number; startIndex?: number } = {}) {
    return getCompaniesHouseClient().getJson<ChPscList>(
      `/company/${encodeURIComponent(companyNumber)}/persons-with-significant-control`,
      { query: { items_per_page: options.itemsPerPage ?? 100, start_index: options.startIndex ?? 0 } }
    );
  },

  async filingHistory(
    companyNumber: string,
    options: { itemsPerPage?: number; startIndex?: number; category?: string } = {}
  ) {
    return getCompaniesHouseClient().getJson<ChFilingHistory>(
      `/company/${encodeURIComponent(companyNumber)}/filing-history`,
      {
        query: {
          items_per_page: options.itemsPerPage ?? 100,
          start_index: options.startIndex ?? 0,
          category: options.category,
        },
      }
    );
  },

  async charges(companyNumber: string) {
    return getCompaniesHouseClient().getJson<ChChargeList>(
      `/company/${encodeURIComponent(companyNumber)}/charges`
    );
  },
};

/** Public URL for a company on the Companies House website. */
export function companiesHouseWebUrl(companyNumber: string): string {
  return `https://find-and-update.company-information.service.gov.uk/company/${encodeURIComponent(
    companyNumber
  )}`;
}
