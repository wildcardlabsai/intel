/**
 * Seeds reference data only: Welsh local authorities, planning authorities,
 * sector taxonomy, subscription plans and the data source registry.
 *
 * This is NOT sample data. It contains no companies, no planning
 * applications, no contracts and no funding schemes — those only ever enter
 * the database through a connector reading a real publisher feed. Running this
 * against production is expected and safe; it is idempotent.
 *
 *   npm run db:seed:reference
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";

import { PrismaClient } from "../src/generated/prisma/client";
import { DEFAULT_PLANS } from "../src/lib/billing/plan-definitions";
import {
  PLANNING_AUTHORITY_SEEDS,
  SOURCE_DEFINITIONS,
} from "../src/lib/ingestion/source-registry";
import {
  WELSH_LOCAL_AUTHORITIES,
} from "../src/lib/wales/local-authorities";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local first.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/**
 * A minimal sector taxonomy mapped from SIC 2007 section letters. Kept small
 * and explicit: every mapping here is a documented SIC division range, not a
 * guess.
 */
const SECTORS: Array<{ code: string; name: string; slug: string; sicPrefixes: string[] }> = [
  { code: "A", name: "Agriculture, forestry and fishing", slug: "agriculture", sicPrefixes: ["01", "02", "03"] },
  { code: "B", name: "Mining and quarrying", slug: "mining", sicPrefixes: ["05", "06", "07", "08", "09"] },
  { code: "C", name: "Manufacturing", slug: "manufacturing", sicPrefixes: ["10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33"] },
  { code: "D", name: "Energy supply", slug: "energy", sicPrefixes: ["35"] },
  { code: "E", name: "Water and waste", slug: "water-waste", sicPrefixes: ["36", "37", "38", "39"] },
  { code: "F", name: "Construction", slug: "construction", sicPrefixes: ["41", "42", "43"] },
  { code: "G", name: "Wholesale and retail", slug: "retail", sicPrefixes: ["45", "46", "47"] },
  { code: "H", name: "Transport and storage", slug: "transport", sicPrefixes: ["49", "50", "51", "52", "53"] },
  { code: "I", name: "Accommodation and food", slug: "hospitality", sicPrefixes: ["55", "56"] },
  { code: "J", name: "Information and communication", slug: "technology", sicPrefixes: ["58", "59", "60", "61", "62", "63"] },
  { code: "K", name: "Finance and insurance", slug: "finance", sicPrefixes: ["64", "65", "66"] },
  { code: "L", name: "Real estate", slug: "real-estate", sicPrefixes: ["68"] },
  { code: "M", name: "Professional and technical", slug: "professional-services", sicPrefixes: ["69", "70", "71", "72", "73", "74", "75"] },
  { code: "N", name: "Administrative and support", slug: "administrative", sicPrefixes: ["77", "78", "79", "80", "81", "82"] },
  { code: "O", name: "Public administration", slug: "public-administration", sicPrefixes: ["84"] },
  { code: "P", name: "Education", slug: "education", sicPrefixes: ["85"] },
  { code: "Q", name: "Health and social work", slug: "health", sicPrefixes: ["86", "87", "88"] },
  { code: "R", name: "Arts and recreation", slug: "arts-recreation", sicPrefixes: ["90", "91", "92", "93"] },
  { code: "S", name: "Other services", slug: "other-services", sicPrefixes: ["94", "95", "96"] },
];

async function seedLocalAuthorities(): Promise<void> {
  for (const authority of WELSH_LOCAL_AUTHORITIES) {
    await prisma.localAuthority.upsert({
      where: { gssCode: authority.gssCode },
      create: {
        name: authority.name,
        welshName: authority.welshName,
        slug: authority.slug,
        gssCode: authority.gssCode,
        region: authority.region,
        centroidLat: authority.centroidLat,
        centroidLng: authority.centroidLng,
      },
      update: {
        name: authority.name,
        welshName: authority.welshName,
        region: authority.region,
        centroidLat: authority.centroidLat,
        centroidLng: authority.centroidLng,
      },
    });
  }
  console.log(`✓ ${WELSH_LOCAL_AUTHORITIES.length} Welsh local authorities`);
}

async function seedSectors(): Promise<void> {
  for (const sector of SECTORS) {
    await prisma.sector.upsert({
      where: { code: sector.code },
      create: { code: sector.code, name: sector.name, slug: sector.slug },
      update: { name: sector.name, slug: sector.slug },
    });
  }
  console.log(`✓ ${SECTORS.length} sectors`);
}

async function seedPlans(): Promise<void> {
  for (const plan of DEFAULT_PLANS) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      create: {
        code: plan.code,
        name: plan.name,
        description: plan.description,
        priceMonthlyPence: plan.priceMonthlyPence,
        priceYearlyPence: plan.priceYearlyPence,
        sortOrder: plan.sortOrder,
        features: plan.features,
        limits: plan.limits as never,
      },
      // Price and Stripe IDs are managed in admin after the first seed, so
      // re-running never overwrites a configured price.
      update: {
        name: plan.name,
        description: plan.description,
        features: plan.features,
        limits: plan.limits as never,
        sortOrder: plan.sortOrder,
      },
    });
  }
  console.log(`✓ ${DEFAULT_PLANS.length} subscription plans`);
}

async function seedDataSources(): Promise<void> {
  for (const source of SOURCE_DEFINITIONS) {
    const missingEnvVars = source.requiredEnvVars.filter((name) => !process.env[name]);
    const status =
      source.defaultStatus === "UNAVAILABLE"
        ? "UNAVAILABLE"
        : missingEnvVars.length > 0
          ? "NOT_CONFIGURED"
          : "CONNECTED";

    await prisma.dataSource.upsert({
      where: { key: source.key },
      create: {
        key: source.key,
        name: source.name,
        organisation: source.organisation,
        category: source.category,
        description: source.description,
        homepageUrl: source.homepageUrl,
        docsUrl: source.docsUrl,
        licence: source.licence,
        licenceUrl: source.licenceUrl,
        usageRestrictions: source.usageRestrictions,
        updateFrequency: source.updateFrequency,
        schedule: source.schedule,
        requiredEnvVars: source.requiredEnvVars,
        status,
        statusMessage: missingEnvVars.length > 0 ? source.statusMessage : null,
      },
      update: {
        name: source.name,
        organisation: source.organisation,
        description: source.description,
        homepageUrl: source.homepageUrl,
        docsUrl: source.docsUrl,
        licence: source.licence,
        licenceUrl: source.licenceUrl,
        usageRestrictions: source.usageRestrictions,
        updateFrequency: source.updateFrequency,
        schedule: source.schedule,
        requiredEnvVars: source.requiredEnvVars,
        // Never downgrade a source that has successfully synced just because
        // this process cannot see the environment variable.
        ...(status === "CONNECTED" ? {} : { status, statusMessage: source.statusMessage }),
      },
    });
  }
  console.log(`✓ ${SOURCE_DEFINITIONS.length} data sources`);
}

async function seedPlanningAuthorities(): Promise<void> {
  const planningSource = await prisma.dataSource.findUnique({ where: { key: "planning_wales" } });

  for (const authority of PLANNING_AUTHORITY_SEEDS) {
    const localAuthority = authority.localAuthoritySlug
      ? await prisma.localAuthority.findUnique({
          where: { slug: authority.localAuthoritySlug },
          select: { id: true },
        })
      : null;

    await prisma.planningAuthority.upsert({
      where: { slug: authority.slug },
      create: {
        name: authority.name,
        slug: authority.slug,
        localAuthorityId: localAuthority?.id ?? null,
        dataSourceId: planningSource?.id ?? null,
        connectorKey: authority.connectorKey,
        portalUrl: authority.portalUrl,
        status: authority.status,
        statusMessage: authority.statusMessage,
      },
      update: {
        name: authority.name,
        localAuthorityId: localAuthority?.id ?? null,
        dataSourceId: planningSource?.id ?? null,
      },
    });
  }

  const connected = await prisma.planningAuthority.count({ where: { status: "CONNECTED" } });
  console.log(
    `✓ ${PLANNING_AUTHORITY_SEEDS.length} planning authorities (${connected} with a configured feed)`
  );
}

async function main(): Promise<void> {
  console.log("Seeding reference data (no sample records are created)…\n");

  await seedLocalAuthorities();
  await seedSectors();
  await seedPlans();
  await seedDataSources();
  await seedPlanningAuthorities();

  console.log("\nReference data seeded.");
  console.log(
    "Companies, contracts, planning applications and funding schemes are only " +
      "created by connectors reading real publisher feeds."
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
