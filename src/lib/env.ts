import "server-only";

import { z } from "zod";

/**
 * Environment configuration.
 *
 * Only DATABASE_URL and the Supabase keys are hard requirements — without them
 * the application cannot boot. Every external data source and third-party
 * integration is optional at boot time: when its variables are missing the
 * relevant feature reports itself as "Not configured" in the UI and the
 * connector refuses to run. Nothing is ever substituted with mock data.
 */

const optionalString = z.string().trim().min(1).optional();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),

  // --- Required: database -------------------------------------------------
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  // --- Required in production: Supabase Auth ------------------------------
  NEXT_PUBLIC_SUPABASE_URL: optionalString,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,

  // --- Data sources -------------------------------------------------------
  COMPANIES_HOUSE_API_KEY: optionalString,
  COMPANIES_HOUSE_API_BASE: z
    .string()
    .url()
    .default("https://api.company-information.service.gov.uk"),
  /// Companies House publishes a documented rate limit of 600 requests per
  /// five minutes per key. Configurable so it can be lowered when sharing.
  COMPANIES_HOUSE_RATE_LIMIT: z.coerce.number().int().positive().default(600),
  COMPANIES_HOUSE_RATE_WINDOW_MS: z.coerce.number().int().positive().default(300_000),

  SELL2WALES_API_BASE: z
    .string()
    .url()
    .default("https://www.sell2wales.gov.wales/api"),
  SELL2WALES_OCDS_BASE: optionalString,

  DATAMAPWALES_BASE: z.string().url().default("https://datamap.gov.wales"),

  // --- Stripe -------------------------------------------------------------
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optionalString,

  // --- Email --------------------------------------------------------------
  RESEND_API_KEY: optionalString,
  EMAIL_FROM: z.string().default("Cymru Intelligence <hello@cymru-intelligence.wales>"),

  // --- Maps ---------------------------------------------------------------
  /// MapLibre works without a token against an open style; a MapTiler or
  /// Mapbox key is only needed for their hosted styles.
  NEXT_PUBLIC_MAP_STYLE_URL: optionalString,
  NEXT_PUBLIC_MAPBOX_TOKEN: optionalString,
  MAPBOX_TOKEN: optionalString,

  // --- Geocoding ----------------------------------------------------------
  /// postcodes.io is free and needs no key; set to "none" to disable.
  GEOCODER_PROVIDER: z.enum(["postcodes_io", "none"]).default("postcodes_io"),
  POSTCODES_IO_BASE: z.string().url().default("https://api.postcodes.io"),

  // --- AI layer (optional, strictly non-generative for facts) -------------
  OPENAI_API_KEY: optionalString,
  ANTHROPIC_API_KEY: optionalString,

  // --- Operations ---------------------------------------------------------
  CRON_SECRET: optionalString,
  ADMIN_BOOTSTRAP_EMAIL: optionalString,
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration:\n${issues}\n\n` +
        `Copy .env.example to .env.local and fill in the required values.`
    );
  }

  cached = parsed.data;
  return cached;
}

/** Integration keys used across the app to describe configuration state. */
export const INTEGRATIONS = {
  supabase: "supabase",
  companiesHouse: "companies_house",
  sell2wales: "sell2wales",
  stripe: "stripe",
  resend: "resend",
  maps: "maps",
  geocoder: "geocoder",
  ai: "ai",
} as const;

export type IntegrationKey = (typeof INTEGRATIONS)[keyof typeof INTEGRATIONS];

export type IntegrationStatus = {
  key: IntegrationKey;
  label: string;
  configured: boolean;
  /** Environment variables that must be set for this integration to work. */
  requiredEnvVars: string[];
  missingEnvVars: string[];
  /** What stops working while this is unconfigured. */
  impact: string;
  docsUrl?: string;
};

function check(
  key: IntegrationKey,
  label: string,
  requiredEnvVars: string[],
  impact: string,
  docsUrl?: string
): IntegrationStatus {
  const missingEnvVars = requiredEnvVars.filter((name) => {
    const value = process.env[name];
    return !value || value.trim().length === 0;
  });
  return {
    key,
    label,
    configured: missingEnvVars.length === 0,
    requiredEnvVars,
    missingEnvVars,
    impact,
    docsUrl,
  };
}

/**
 * Reports which integrations are usable in this environment. The admin
 * "Sources" screen and every empty state read from this so the product never
 * implies data exists when the integration behind it is unconfigured.
 */
export function getIntegrationStatuses(): IntegrationStatus[] {
  return [
    check(
      INTEGRATIONS.supabase,
      "Supabase Auth",
      ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
      "Sign-up, sign-in and every authenticated page are unavailable.",
      "https://supabase.com/docs/guides/auth"
    ),
    check(
      INTEGRATIONS.companiesHouse,
      "Companies House API",
      ["COMPANIES_HOUSE_API_KEY"],
      "No company records can be ingested or refreshed.",
      "https://developer.company-information.service.gov.uk/"
    ),
    check(
      INTEGRATIONS.sell2wales,
      "Sell2Wales (OCDS)",
      ["SELL2WALES_OCDS_BASE"],
      "No procurement notices or awards can be ingested.",
      "https://www.sell2wales.gov.wales/"
    ),
    check(
      INTEGRATIONS.stripe,
      "Stripe",
      ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"],
      "Paid plans cannot be purchased or managed; everyone stays on Free.",
      "https://stripe.com/docs"
    ),
    check(
      INTEGRATIONS.resend,
      "Resend",
      ["RESEND_API_KEY"],
      "Alert emails, digests and transactional email are not sent.",
      "https://resend.com/docs"
    ),
    check(
      INTEGRATIONS.maps,
      "Map tiles",
      ["NEXT_PUBLIC_MAP_STYLE_URL"],
      "The interactive map falls back to a plain background with markers only.",
      "https://maplibre.org/"
    ),
    check(
      INTEGRATIONS.geocoder,
      "Geocoding (postcodes.io)",
      [],
      "Postcodes cannot be converted to coordinates, so map and radius search are limited.",
      "https://postcodes.io/"
    ),
    check(
      INTEGRATIONS.ai,
      "AI query interpretation",
      ["ANTHROPIC_API_KEY"],
      "Natural-language search falls back to structured keyword search.",
      "https://docs.anthropic.com/"
    ),
  ];
}

export function isConfigured(key: IntegrationKey): boolean {
  return getIntegrationStatuses().find((s) => s.key === key)?.configured ?? false;
}

/**
 * Thrown when application code reaches an integration that has no credentials.
 * Callers surface this to the user as "Not configured" plus the variable name —
 * never as an empty result set that could be mistaken for "no data".
 */
export class IntegrationNotConfiguredError extends Error {
  readonly integration: IntegrationKey;
  readonly missingEnvVars: string[];

  constructor(integration: IntegrationKey, missingEnvVars: string[]) {
    super(
      `Integration "${integration}" is not configured. Missing environment ` +
        `variable(s): ${missingEnvVars.join(", ")}.`
    );
    this.name = "IntegrationNotConfiguredError";
    this.integration = integration;
    this.missingEnvVars = missingEnvVars;
  }
}

export function requireIntegration(key: IntegrationKey): void {
  const status = getIntegrationStatuses().find((s) => s.key === key);
  if (!status || !status.configured) {
    throw new IntegrationNotConfiguredError(key, status?.missingEnvVars ?? []);
  }
}
