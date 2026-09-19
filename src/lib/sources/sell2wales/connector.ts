import "server-only";

import { prisma } from "@/lib/db/prisma";
import { getEnv } from "@/lib/env";
import { HttpClient } from "@/lib/http/client";
import { recordChanges } from "@/lib/ingestion/runner";
import type {
  Connector,
  ConnectorContext,
  FetchedRecord,
  StoreContext,
  StoreOutcome,
  ValidationResult,
} from "@/lib/ingestion/types";
import { resolveCompany, recordAlias, linkEntities } from "@/lib/entity-resolution/resolve-company";
import { lookupPostcode } from "@/lib/geo/postcodes";
import {
  normaliseRelease,
  type NormalisedNotice,
  type NormalisedOrganisation,
} from "@/lib/sources/sell2wales/normalise";
import type { OcdsRelease, OcdsReleasePackage } from "@/lib/sources/sell2wales/types";
import { findLocalAuthorityByName } from "@/lib/wales/local-authorities";

/**
 * Sell2Wales procurement connector.
 *
 * Consumes Open Contracting Data Standard release packages. Paging follows the
 * `links.next` cursor that the OCDS package format defines, so the connector
 * works against any conforming publisher endpoint without change.
 *
 * Backfill: point the connector at the publisher's full archive and run with a
 * BACKFILL trigger and a high limit. Incremental: the stored cursor is the
 * last `links.next` we consumed, so daily runs only read new pages.
 */

let client: HttpClient | null = null;

function getClient(): HttpClient {
  if (client) return client;
  const env = getEnv();
  if (!env.SELL2WALES_OCDS_BASE) {
    throw new Error("SELL2WALES_OCDS_BASE is not set");
  }
  client = new HttpClient({
    name: "sell2wales",
    baseUrl: env.SELL2WALES_OCDS_BASE,
    defaultHeaders: {
      accept: "application/json",
      "user-agent": "CymruIntelligence/1.0 (+https://cymru-intelligence.wales)",
    },
    // No published limit; this is a conservative self-imposed ceiling.
    rateLimit: { limit: 120, windowMs: 60_000 },
    maxRetries: 4,
    timeoutMs: 60_000,
  });
  return client;
}

/** Test seam. */
export function __setSell2WalesClient(next: HttpClient | null): void {
  client = next;
}

export const sell2walesConnector: Connector<OcdsRelease, NormalisedNotice> = {
  key: "sell2wales_ocds",
  dataSourceKey: "sell2wales",
  label: "Sell2Wales — procurement notices (OCDS)",

  readiness() {
    const env = getEnv();
    if (!env.SELL2WALES_OCDS_BASE) {
      return {
        ready: false,
        reason:
          "SELL2WALES_OCDS_BASE is not set. Point it at the Sell2Wales OCDS " +
          "release-package endpoint; the connector reads standard OCDS and needs " +
          "no further configuration.",
        missingEnvVars: ["SELL2WALES_OCDS_BASE"],
      };
    }
    return { ready: true };
  },

  async *fetch(context: ConnectorContext) {
    let nextUrl: string | null = context.cursor;
    let emitted = 0;

    for (;;) {
      if (context.signal?.aborted) return nextUrl;

      const packageResponse: OcdsReleasePackage | null = await getClient().getJson<OcdsReleasePackage>(
        nextUrl ?? "/"
      );

      if (!packageResponse) {
        context.logger.warn("empty OCDS package", { url: nextUrl });
        return nextUrl;
      }

      const releases = packageResponse.releases ?? [];
      context.logger.debug("ocds package", {
        url: nextUrl,
        releases: releases.length,
        next: packageResponse.links?.next,
      });

      for (const release of releases) {
        if (!release.ocid) continue;

        yield {
          sourceRecordId: `${release.ocid}:${release.id ?? ""}`,
          sourceUrl: buildNoticeUrl(release),
          sourceUpdatedAt: release.date ? new Date(release.date) : null,
          raw: release,
        } satisfies FetchedRecord<OcdsRelease>;

        emitted += 1;
      }

      const next = packageResponse.links?.next ?? null;

      // Stop when the publisher says there is no next page, or when this run
      // has consumed its budget. Either way the cursor points at the page to
      // read next time.
      if (!next || emitted >= context.limit) {
        return next ?? nextUrl;
      }

      nextUrl = next;
    }
  },

  validate(record): ValidationResult<OcdsRelease> {
    const release = record.raw;
    if (!release.ocid) return { ok: false, reason: "Release has no ocid" };
    if (!release.tender?.title && !release.awards?.[0]?.title) {
      return { ok: false, reason: `Release ${release.ocid} has no tender or award title` };
    }
    return { ok: true, value: record };
  },

  normalise(record) {
    return normaliseRelease(record.raw);
  },

  async store(notice, context) {
    return storeNotice(notice, context);
  },
};

function buildNoticeUrl(release: OcdsRelease): string | null {
  const documentUrl = release.tender?.documents?.find((doc) => doc.documentType === "notice")?.url;
  return documentUrl ?? release.tender?.documents?.[0]?.url ?? null;
}

async function storeNotice(notice: NormalisedNotice, context: StoreContext): Promise<StoreOutcome> {
  const sourceId = `${notice.ocid}:${notice.noticeId}`;

  const buyer = notice.buyer ? await upsertBuyer(notice.buyer) : null;

  // Resolve location. Buyer postcodes are common even when the delivery
  // address is absent, so both are tried before giving up.
  const lookup = await lookupPostcode(notice.postcode ?? notice.buyer?.postcode ?? null);
  const localAuthority = await findLocalAuthorityId(
    lookup?.localAuthority ?? notice.deliveryLocality ?? null
  );

  const existing = await prisma.procurementNotice.findUnique({
    where: { source_sourceId: { source: "sell2wales", sourceId } },
  });

  const now = new Date();
  const data = {
    ocid: notice.ocid,
    noticeId: notice.noticeId,
    type: notice.type,
    status: notice.status,
    title: notice.title,
    description: notice.description,
    buyerId: buyer?.id ?? null,
    valueAmount: notice.valueAmount,
    valueCurrency: notice.valueCurrency,
    valueAmountMin: notice.valueAmountMin,
    publishedAt: notice.publishedAt,
    deadlineAt: notice.deadlineAt,
    contractStartAt: notice.contractStartAt,
    contractEndAt: notice.contractEndAt,
    cpvCodes: notice.cpvCodes,
    categories: notice.categories,
    procurementMethod: notice.procurementMethod,
    deliveryLocality: notice.deliveryLocality,
    postcode: notice.postcode,
    localAuthorityId: localAuthority?.id ?? null,
    region: localAuthority?.region ?? null,
    latitude: notice.latitude ?? lookup?.latitude ?? null,
    longitude: notice.longitude ?? lookup?.longitude ?? null,
    rawRecordId: context.rawRecordId,
    lastSeenAt: now,
    lastUpdatedAt: now,
    sourceUpdatedAt: notice.publishedAt,
  };

  let noticeId: string;
  let outcome: StoreOutcome;

  if (!existing) {
    const created = await prisma.procurementNotice.create({
      data: { source: "sell2wales", sourceId, firstSeenAt: now, ...data },
    });
    noticeId = created.id;
    outcome = "created";
  } else {
    const changed = await recordChanges({
      entityType: "procurement_notice",
      entityId: existing.id,
      before: existing as unknown as Record<string, unknown>,
      after: data as unknown as Record<string, unknown>,
      fields: ["status", "valueAmount", "deadlineAt", "title", "type"],
      dataSourceId: context.dataSourceId,
      runId: context.runId,
    });

    await prisma.procurementNotice.update({ where: { id: existing.id }, data });
    noticeId = existing.id;
    outcome = changed.length > 0 ? "updated" : "skipped";
  }

  // --- Awards and suppliers -----------------------------------------------
  for (const award of notice.awards) {
    const supplier = award.suppliers[0] ? await upsertSupplier(award.suppliers[0]) : null;

    await prisma.procurementAward.upsert({
      where: { noticeId_awardId: { noticeId, awardId: award.awardId } },
      create: {
        noticeId,
        awardId: award.awardId,
        supplierId: supplier?.id ?? null,
        title: award.title,
        description: award.description,
        status: award.status,
        valueAmount: award.valueAmount,
        valueCurrency: award.valueCurrency,
        awardedAt: award.awardedAt,
        contractStartAt: award.contractStartAt,
        contractEndAt: award.contractEndAt,
        source: "sell2wales",
        sourceUrl: buildAwardUrl(notice),
      },
      update: {
        supplierId: supplier?.id ?? null,
        status: award.status,
        valueAmount: award.valueAmount,
        awardedAt: award.awardedAt,
        lastSeenAt: now,
        lastUpdatedAt: now,
      },
    });

    // When the supplier resolves to a company, write the graph edge and add a
    // timeline entry on that company's profile.
    if (supplier?.resolvedCompanyId) {
      await linkEntities({
        fromType: "company",
        fromId: supplier.resolvedCompanyId,
        toType: "procurement_notice",
        toId: noticeId,
        relation: "SUPPLIER_ON",
        confidence: supplier.resolutionConfidence ?? 0.5,
        method: supplier.resolutionMethod,
        evidence: { supplierName: award.suppliers[0]?.name, ocid: notice.ocid },
      });

      if (award.awardedAt) {
        await prisma.companyEvent.upsert({
          where: {
            companyId_type_occurredAt_sourceEntityId: {
              companyId: supplier.resolvedCompanyId,
              type: "CONTRACT_AWARDED",
              occurredAt: award.awardedAt,
              sourceEntityId: `${notice.ocid}:${award.awardId}`,
            },
          },
          create: {
            companyId: supplier.resolvedCompanyId,
            type: "CONTRACT_AWARDED",
            title: `Public contract awarded: ${notice.title}`,
            description: formatAwardDescription(award.valueAmount, award.valueCurrency, notice.buyer?.name),
            occurredAt: award.awardedAt,
            sourceEntityType: "procurement_award",
            sourceEntityId: `${notice.ocid}:${award.awardId}`,
            source: "sell2wales",
            sourceUrl: buildAwardUrl(notice),
            metadata: { ocid: notice.ocid, noticeId },
          },
          update: {},
        });
      }
    }
  }

  // --- Documents -----------------------------------------------------------
  for (const doc of notice.documents) {
    await prisma.procurementDocument.upsert({
      where: { noticeId_documentId: { noticeId, documentId: doc.documentId } },
      create: {
        noticeId,
        documentId: doc.documentId,
        title: doc.title,
        description: doc.description,
        documentType: doc.documentType,
        url: doc.url,
        format: doc.format,
        publishedAt: doc.publishedAt,
        source: "sell2wales",
      },
      update: { lastSeenAt: now, url: doc.url },
    });
  }

  if (buyer?.resolvedCompanyId) {
    await linkEntities({
      fromType: "company",
      fromId: buyer.resolvedCompanyId,
      toType: "procurement_notice",
      toId: noticeId,
      relation: "BUYER_ON",
      confidence: buyer.resolutionConfidence ?? 0.5,
      method: buyer.resolutionMethod,
      evidence: { buyerName: notice.buyer?.name, ocid: notice.ocid },
    });
  }

  return outcome;
}

type UpsertedOrganisation = {
  id: string;
  resolvedCompanyId: string | null;
  resolutionConfidence: number | null;
  resolutionMethod: string;
};

async function upsertBuyer(org: NormalisedOrganisation): Promise<UpsertedOrganisation> {
  const resolution = await resolveCompany({
    name: org.name,
    companyNumber: org.companyNumber,
    postcode: org.postcode,
    locality: org.addressLocality,
  });

  const record = await prisma.procurementBuyer.upsert({
    where: { source_sourceId: { source: "sell2wales", sourceId: org.sourceId } },
    create: {
      source: "sell2wales",
      sourceId: org.sourceId,
      name: org.name,
      normalisedName: org.normalisedName,
      identifierScheme: org.identifierScheme,
      identifierId: org.identifierId,
      companyNumber: org.companyNumber,
      resolvedCompanyId: resolution.companyId,
      resolutionConfidence: resolution.confidence || null,
      contactEmail: org.contactEmail,
      website: org.website,
      addressLocality: org.addressLocality,
      postcode: org.postcode,
    },
    update: {
      name: org.name,
      normalisedName: org.normalisedName,
      resolvedCompanyId: resolution.companyId,
      resolutionConfidence: resolution.confidence || null,
      lastSeenAt: new Date(),
      lastUpdatedAt: new Date(),
    },
  });

  if (resolution.companyId && resolution.confidence >= 0.9) {
    await recordAlias(resolution.companyId, org.name, "sell2wales", resolution.confidence);
  }

  return {
    id: record.id,
    resolvedCompanyId: resolution.companyId,
    resolutionConfidence: resolution.confidence || null,
    resolutionMethod: resolution.method,
  };
}

async function upsertSupplier(org: NormalisedOrganisation): Promise<UpsertedOrganisation> {
  const resolution = await resolveCompany({
    name: org.name,
    companyNumber: org.companyNumber,
    postcode: org.postcode,
    locality: org.addressLocality,
  });

  const record = await prisma.procurementSupplier.upsert({
    where: { source_sourceId: { source: "sell2wales", sourceId: org.sourceId } },
    create: {
      source: "sell2wales",
      sourceId: org.sourceId,
      name: org.name,
      normalisedName: org.normalisedName,
      identifierScheme: org.identifierScheme,
      identifierId: org.identifierId,
      companyNumber: org.companyNumber,
      resolvedCompanyId: resolution.companyId,
      resolutionConfidence: resolution.confidence || null,
      isSme: org.isSme,
      addressLocality: org.addressLocality,
      postcode: org.postcode,
      country: org.country,
    },
    update: {
      name: org.name,
      normalisedName: org.normalisedName,
      resolvedCompanyId: resolution.companyId,
      resolutionConfidence: resolution.confidence || null,
      isSme: org.isSme,
      lastSeenAt: new Date(),
      lastUpdatedAt: new Date(),
    },
  });

  if (resolution.companyId && resolution.confidence >= 0.9) {
    await recordAlias(resolution.companyId, org.name, "sell2wales", resolution.confidence);
  }

  return {
    id: record.id,
    resolvedCompanyId: resolution.companyId,
    resolutionConfidence: resolution.confidence || null,
    resolutionMethod: resolution.method,
  };
}

async function findLocalAuthorityId(
  name: string | null
): Promise<{ id: string; region: "NORTH_WALES" | "MID_WALES" | "WEST_WALES" | "SOUTH_WALES" | "SOUTH_EAST_WALES" | "UNKNOWN" } | null> {
  const seed = findLocalAuthorityByName(name);
  if (!seed) return null;

  const record = await prisma.localAuthority.findUnique({
    where: { slug: seed.slug },
    select: { id: true, region: true },
  });
  return record;
}

function buildAwardUrl(notice: NormalisedNotice): string | null {
  return notice.documents[0]?.url ?? null;
}

function formatAwardDescription(
  amount: number | null,
  currency: string | null,
  buyerName: string | undefined
): string {
  const parts: string[] = [];
  if (amount !== null) {
    const formatted = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency ?? "GBP",
      maximumFractionDigits: 0,
    }).format(amount);
    parts.push(`Value ${formatted}.`);
  }
  if (buyerName) parts.push(`Buyer: ${buyerName}.`);
  return parts.join(" ") || "Contract award published on Sell2Wales.";
}
