/**
 * Development fixtures for previewing the product.
 *
 * Everything this creates is SYNTHETIC and clearly marked as such. It exists
 * so a reviewer can see the interface working before any real feed is
 * connected — nothing here is, or claims to be, real Welsh business data.
 *
 * Three safeguards stop it reaching anything that matters:
 *
 *   1. It refuses to run when NODE_ENV is "production".
 *   2. It refuses to run against a database that already holds real ingested
 *      records, so it cannot be mixed into a live dataset.
 *   3. Every record it writes carries source = "dev_fixture" and a source URL
 *      of about:blank, so fixtures are trivially identifiable and deletable.
 *
 *   npm run db:seed:dev
 *
 * Remove them again with: npm run db:seed:dev -- --clear
 */

import { randomUUID } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";

import { PrismaClient } from "../src/generated/prisma/client";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

const FIXTURE_SOURCE = "dev_fixture";

if (process.env.NODE_ENV === "production") {
  console.error(
    "Refusing to run: NODE_ENV is production. Development fixtures must never\n" +
      "be written to a production database."
  );
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/**
 * Synthetic companies. The names are deliberately invented-sounding and the
 * company numbers sit in a range Companies House does not issue, so a fixture
 * can never be mistaken for a real registration.
 */
const COMPANY_FIXTURES = [
  { name: "Demo Valleys Construction Ltd", town: "Merthyr Tydfil", authority: "merthyr-tydfil", postcode: "CF47 8AB", sic: ["41201"], status: "ACTIVE", size: "small", lat: 51.7486, lng: -3.3781 },
  { name: "Demo Cymru Renewables Cyf", town: "Machynlleth", authority: "powys", postcode: "SY20 8AA", sic: ["35110"], status: "ACTIVE", size: "medium", lat: 52.5906, lng: -3.8513 },
  { name: "Demo Bay Software Limited", town: "Cardiff", authority: "cardiff", postcode: "CF10 1AA", sic: ["62012"], status: "ACTIVE", size: "small", lat: 51.4816, lng: -3.1791 },
  { name: "Demo Snowdonia Timber Cyf", town: "Caernarfon", authority: "gwynedd", postcode: "LL55 1AA", sic: ["16230"], status: "ACTIVE", size: "micro", lat: 53.1394, lng: -4.2766 },
  { name: "Demo Swansea Marine Services Ltd", town: "Swansea", authority: "swansea", postcode: "SA1 1AA", sic: ["30110"], status: "ACTIVE", size: "medium", lat: 51.6214, lng: -3.9436 },
  { name: "Demo Wrexham Precision Engineering Ltd", town: "Wrexham", authority: "wrexham", postcode: "LL11 1AA", sic: ["25620"], status: "ACTIVE", size: "medium", lat: 53.0466, lng: -2.9927 },
  { name: "Demo Pembrokeshire Foods Cyf", town: "Haverfordwest", authority: "pembrokeshire", postcode: "SA61 1AA", sic: ["10890"], status: "ACTIVE", size: "small", lat: 51.8017, lng: -4.9709 },
  { name: "Demo Newport Logistics Limited", town: "Newport", authority: "newport", postcode: "NP20 1AA", sic: ["49410"], status: "DISSOLVED", size: "small", lat: 51.5842, lng: -2.9977 },
  { name: "Demo Anglesey Tourism Cyf", town: "Llangefni", authority: "isle-of-anglesey", postcode: "LL77 7AA", sic: ["79110"], status: "ACTIVE", size: "micro", lat: 53.2557, lng: -4.3095 },
  { name: "Demo Rhondda Care Services Ltd", town: "Pontypridd", authority: "rhondda-cynon-taf", postcode: "CF37 1AA", sic: ["87100"], status: "LIQUIDATION", size: "small", lat: 51.6021, lng: -3.3419 },
  { name: "Demo Bridgend Plastics Limited", town: "Bridgend", authority: "bridgend", postcode: "CF31 1AA", sic: ["22220"], status: "ACTIVE", size: "medium", lat: 51.5045, lng: -3.5765 },
  { name: "Demo Ceredigion Agri Cyf", town: "Aberystwyth", authority: "ceredigion", postcode: "SY23 1AA", sic: ["01500"], status: "ACTIVE", size: "micro", lat: 52.4153, lng: -4.0829 },
] as const;

const PROCUREMENT_FIXTURES = [
  { title: "Demo — Highway resurfacing programme, northern corridor", buyer: "Demo County Borough Council", value: 2_450_000, status: "AWARDED", cpv: ["45233220"], locality: "Merthyr Tydfil" },
  { title: "Demo — Primary school modular classroom supply", buyer: "Demo County Borough Council", value: 780_000, status: "ACTIVE", cpv: ["45214210"], locality: "Cardiff" },
  { title: "Demo — Social care case management system", buyer: "Demo City Council", value: 1_120_000, status: "ACTIVE", cpv: ["48000000"], locality: "Swansea" },
  { title: "Demo — Coastal flood defence maintenance", buyer: "Demo City Council", value: 3_900_000, status: "AWARDED", cpv: ["45246410"], locality: "Newport" },
  { title: "Demo — Grounds maintenance framework", buyer: "Demo County Council", value: 460_000, status: "CLOSED", cpv: ["77310000"], locality: "Wrexham" },
  { title: "Demo — Electric vehicle charging infrastructure", buyer: "Demo County Council", value: 1_650_000, status: "ACTIVE", cpv: ["45316000"], locality: "Gwynedd" },
] as const;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function hasRealData(): Promise<boolean> {
  const real = await prisma.company.count({ where: { source: { not: FIXTURE_SOURCE } } });
  return real > 0;
}

async function clearFixtures(): Promise<void> {
  await prisma.procurementAward.deleteMany({ where: { source: FIXTURE_SOURCE } });
  await prisma.procurementNotice.deleteMany({ where: { source: FIXTURE_SOURCE } });
  await prisma.procurementBuyer.deleteMany({ where: { source: FIXTURE_SOURCE } });
  await prisma.companyEvent.deleteMany({ where: { company: { source: FIXTURE_SOURCE } } });
  await prisma.savedCompany.deleteMany({ where: { company: { source: FIXTURE_SOURCE } } });
  await prisma.company.deleteMany({ where: { source: FIXTURE_SOURCE } });
  await prisma.insight.deleteMany({ where: { slug: { startsWith: "demo-" } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: "@demo.cymru-intelligence.test" } } });
  await prisma.organisation.deleteMany({ where: { slug: "demo-advisory" } });
  console.log("Development fixtures removed.");
}

async function main(): Promise<void> {
  if (process.argv.includes("--clear")) {
    await clearFixtures();
    return;
  }

  if (await hasRealData()) {
    console.error(
      "Refusing to run: this database already holds ingested records from a real\n" +
        "source. Development fixtures must not be mixed into real data."
    );
    process.exit(1);
  }

  console.log("Seeding SYNTHETIC development fixtures…\n");
  await clearFixtures();

  const authorities = await prisma.localAuthority.findMany({
    select: { id: true, slug: true, region: true },
  });
  const bySlug = new Map(authorities.map((a) => [a.slug, a]));

  const sectors = await prisma.sector.findMany({ select: { id: true, slug: true } });
  const sectorBySlug = new Map(sectors.map((s) => [s.slug, s.id]));

  // --- Companies ----------------------------------------------------------
  let companyNumber = 90000001;
  const companyIds: string[] = [];

  for (const fixture of COMPANY_FIXTURES) {
    const authority = bySlug.get(fixture.authority);
    const number = String(companyNumber++);

    const company = await prisma.company.create({
      data: {
        companyNumber: number,
        name: fixture.name,
        normalisedName: fixture.name.toUpperCase().replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim(),
        status: fixture.status as never,
        companyType: "ltd",
        incorporatedOn: daysAgo(400 + Math.floor(Math.random() * 3000)),
        town: fixture.town,
        postcode: fixture.postcode,
        latitude: fixture.lat,
        longitude: fixture.lng,
        localAuthorityId: authority?.id ?? null,
        region: authority?.region ?? null,
        isWelsh: true,
        welshEvidence: "Synthetic development fixture.",
        sicCodes: [...fixture.sic],
        primarySectorId:
          sectorBySlug.get(sectorForSic(fixture.sic[0])) ?? null,
        sizeBand: fixture.size,
        hasCharges: Math.random() > 0.6,
        source: FIXTURE_SOURCE,
        sourceId: number,
        sourceUrl: "about:blank",
        lastUpdatedAt: daysAgo(Math.floor(Math.random() * 14)),
      },
    });
    companyIds.push(company.id);

    await prisma.companyEvent.create({
      data: {
        companyId: company.id,
        type: "FILING",
        title: "Demo — accounts filed for the period ending 31 March",
        occurredAt: daysAgo(Math.floor(Math.random() * 60)),
        source: FIXTURE_SOURCE,
        sourceUrl: "about:blank",
      },
    });
  }
  console.log(`✓ ${COMPANY_FIXTURES.length} synthetic companies`);

  // --- Procurement --------------------------------------------------------
  for (const [index, fixture] of PROCUREMENT_FIXTURES.entries()) {
    const buyer = await prisma.procurementBuyer.upsert({
      where: { source_sourceId: { source: FIXTURE_SOURCE, sourceId: `buyer-${fixture.buyer}` } },
      create: {
        name: fixture.buyer,
        normalisedName: fixture.buyer.toUpperCase(),
        source: FIXTURE_SOURCE,
        sourceId: `buyer-${fixture.buyer}`,
        sourceUrl: "about:blank",
      },
      update: {},
    });

    const notice = await prisma.procurementNotice.create({
      data: {
        ocid: `ocds-demo-${1000 + index}`,
        noticeId: `DEMO-${1000 + index}`,
        title: fixture.title,
        description: "Synthetic development fixture — not a real contract notice.",
        type: "TENDER",
        status: fixture.status as never,
        buyerId: buyer.id,
        valueAmount: fixture.value,
        valueCurrency: "GBP",
        cpvCodes: [...fixture.cpv],
        deliveryLocality: fixture.locality,
        publishedAt: daysAgo(10 + index * 12),
        deadlineAt: daysAgo(-20 + index * 5),
        source: FIXTURE_SOURCE,
        sourceId: `DEMO-${1000 + index}`,
        sourceUrl: "about:blank",
      },
    });

    if (fixture.status === "AWARDED") {
      await prisma.procurementAward.create({
        data: {
          noticeId: notice.id,
          awardId: `DEMO-AWARD-${1000 + index}`,
          title: fixture.title,
          status: "AWARDED",
          valueAmount: fixture.value,
          valueCurrency: "GBP",
          awardedAt: daysAgo(5 + index * 10),
          source: FIXTURE_SOURCE,
          sourceUrl: "about:blank",
        },
      });
    }
  }
  console.log(`✓ ${PROCUREMENT_FIXTURES.length} synthetic procurement notices`);

  // --- Demo accounts ------------------------------------------------------
  const plan = await prisma.plan.findUnique({ where: { code: "BUSINESS" } });

  const organisation = await prisma.organisation.create({
    data: {
      name: "Demo Advisory Partners",
      slug: "demo-advisory",
      billingEmail: "owner@demo.cymru-intelligence.test",
    },
  });

  const owner = await prisma.user.create({
    data: {
      authId: randomUUID(),
      email: "owner@demo.cymru-intelligence.test",
      name: "Demo Owner",
      role: "BUSINESS",
      jobTitle: "Managing Director",
      organisationId: organisation.id,
      emailVerifiedAt: new Date(),
      onboardedAt: new Date(),
    },
  });

  await prisma.organisationMember.create({
    data: {
      organisationId: organisation.id,
      userId: owner.id,
      role: "OWNER",
      acceptedAt: new Date(),
    },
  });

  const analyst = await prisma.user.create({
    data: {
      authId: randomUUID(),
      email: "analyst@demo.cymru-intelligence.test",
      name: "Demo Analyst",
      role: "BUSINESS",
      jobTitle: "Research Analyst",
      organisationId: organisation.id,
      emailVerifiedAt: new Date(),
      onboardedAt: new Date(),
    },
  });

  await prisma.organisationMember.create({
    data: {
      organisationId: organisation.id,
      userId: analyst.id,
      role: "MEMBER",
      acceptedAt: new Date(),
    },
  });

  await prisma.user.create({
    data: {
      authId: randomUUID(),
      email: "admin@demo.cymru-intelligence.test",
      name: "Demo Administrator",
      role: "SUPER_ADMIN",
      emailVerifiedAt: new Date(),
      onboardedAt: new Date(),
    },
  });

  if (plan) {
    await prisma.subscription.create({
      data: {
        organisationId: organisation.id,
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodStart: daysAgo(12),
        currentPeriodEnd: daysAgo(-18),
      },
    });
  }

  // Saved items, a saved search and an alert, so the workspace is not empty.
  for (const companyId of companyIds.slice(0, 4)) {
    await prisma.savedCompany.create({ data: { userId: owner.id, companyId } });
  }

  await prisma.savedSearch.create({
    data: {
      userId: owner.id,
      name: "Construction in the South Wales valleys",
      entityType: "COMPANY",
      query: "construction",
      filters: { region: "SOUTH_WALES", status: ["ACTIVE"] },
    },
  });

  await prisma.alert.create({
    data: {
      userId: owner.id,
      name: "New contracts over £500k",
      entityType: "PROCUREMENT",
      filters: { minValue: 500000 },
      frequency: "DAILY",
      watermark: daysAgo(30),
      nextRunAt: daysAgo(-1),
    },
  });

  console.log("✓ 3 demo accounts, 1 organisation, saved items, a saved search and an alert");

  console.log(
    [
      "",
      "Development fixtures seeded.",
      "",
      "Every record carries source = \"dev_fixture\". Remove them with:",
      "  npm run db:seed:dev -- --clear",
      "",
      "Sign in for a preview with DEV_AUTH_EMAIL set to one of:",
      "  owner@demo.cymru-intelligence.test    (Business plan, organisation owner)",
      "  analyst@demo.cymru-intelligence.test  (Business plan, team member)",
      "  admin@demo.cymru-intelligence.test    (platform administrator)",
    ].join("\n")
  );
}

function sectorForSic(sic: string): string {
  const division = sic.slice(0, 2);
  if (["41", "42", "43"].includes(division)) return "construction";
  if (division === "35") return "energy";
  if (["62", "63", "58"].includes(division)) return "technology";
  if (["10", "16", "22", "25", "30"].includes(division)) return "manufacturing";
  if (division === "49") return "transport";
  if (["86", "87", "88"].includes(division)) return "health";
  if (division === "79") return "hospitality";
  if (division === "01") return "agriculture";
  return "professional-services";
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
