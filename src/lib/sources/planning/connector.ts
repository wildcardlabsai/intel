import "server-only";

import type { PlanningAuthority } from "@/generated/prisma/client";
import { resolveCompany, linkEntities } from "@/lib/entity-resolution/resolve-company";
import { prisma } from "@/lib/db/prisma";
import { recordChanges } from "@/lib/ingestion/runner";
import type {
  Connector,
  ConnectorContext,
  FetchedRecord,
  StoreContext,
  StoreOutcome,
  ValidationResult,
} from "@/lib/ingestion/types";
import { lookupPostcode } from "@/lib/geo/postcodes";
import { getPlanningAdapter, MAX_PAGES } from "@/lib/sources/planning/adapters";
import { readPlanningConfig, type PlanningConnectorConfig } from "@/lib/sources/planning/config";
import {
  normalisePlanningRecord,
  readString,
  type NormalisedPlanningApplication,
  type RawPlanningRecord,
} from "@/lib/sources/planning/normalise";

/**
 * Planning connector, one instance per authority.
 *
 * There is no national Welsh planning feed. Each of the 25 authorities
 * publishes separately, in its own shape, or not at all — so a connector is
 * built from the authority's stored configuration rather than written as code.
 * Connecting an authority means filling in its adapter, endpoint and field map;
 * no deploy is involved.
 *
 * An authority with no usable configuration is reported as not connected, with
 * the specific reason. It is never treated as an authority with no planning
 * applications, and it is never filled in with anything.
 */

export const PLANNING_CONNECTOR_PREFIX = "planning:";

export type PlanningConnector = Connector<RawPlanningRecord, NormalisedPlanningApplication>;

export function planningConnectorKey(slug: string): string {
  return `${PLANNING_CONNECTOR_PREFIX}${slug}`;
}

export function createPlanningConnector(authority: PlanningAuthority): PlanningConnector {
  const check = readPlanningConfig(authority.connectorKey, authority.connectorConfig);

  return {
    key: planningConnectorKey(authority.slug),
    // Every authority reports against the one planning data source in the
    // registry, so the admin screens show planning as a single dataset with a
    // per-authority breakdown.
    dataSourceKey: "planning_wales",
    label: `Planning — ${authority.name}`,

    readiness() {
      return check.ok
        ? { ready: true }
        : { ready: false, reason: check.reason, missingEnvVars: [] };
    },

    async *fetch(context: ConnectorContext) {
      if (!check.ok) return null;
      const config = check.config;

      const adapter = getPlanningAdapter(config.adapter);
      if (!adapter) {
        throw new Error(`No adapter implementation for “${config.adapter}”.`);
      }

      // The cursor is the offset reached by the previous run, so a daily run
      // continues rather than re-reading the whole feed.
      let offset = Number(context.cursor ?? 0);
      if (!Number.isFinite(offset) || offset < 0) offset = 0;

      let emitted = 0;

      for (let page = 0; page < MAX_PAGES; page += 1) {
        if (context.signal?.aborted) break;

        const result = await adapter(config, offset, context.signal);

        for (const raw of result.records) {
          const reference = readString(raw, config.fieldMap.reference);
          if (!reference) continue;

          const record: FetchedRecord<RawPlanningRecord> = {
            // Scoped by authority so two councils using the same reference
            // format cannot collide.
            sourceRecordId: `${authority.slug}:${reference}`,
            sourceUrl: readString(raw, config.fieldMap.url),
            raw,
          };

          yield record;
          emitted += 1;
          if (emitted >= context.limit) return String(offset);
        }

        if (result.nextOffset === null) {
          // Feed exhausted. Start again from the beginning next time so
          // amended applications are picked up.
          return "0";
        }
        offset = result.nextOffset;
      }

      return String(offset);
    },

    validate(record: FetchedRecord<RawPlanningRecord>): ValidationResult<RawPlanningRecord> {
      if (!check.ok) return { ok: false, reason: check.reason };

      const reference = readString(record.raw, check.config.fieldMap.reference);
      if (!reference) {
        return { ok: false, reason: "Record has no application reference." };
      }
      return { ok: true, value: record };
    },

    normalise(record: FetchedRecord<RawPlanningRecord>): NormalisedPlanningApplication {
      if (!check.ok) throw new Error(check.reason);
      const normalised = normalisePlanningRecord(record.raw, check.config);
      if (!normalised) throw new Error("Record could not be normalised.");
      return normalised;
    },

    async store(
      normalised: NormalisedPlanningApplication,
      context: StoreContext
    ): Promise<StoreOutcome> {
      return storePlanningApplication(authority, normalised, context, check.ok ? check.config : null);
    },
  };
}

async function storePlanningApplication(
  authority: PlanningAuthority,
  normalised: NormalisedPlanningApplication,
  context: StoreContext,
  config: PlanningConnectorConfig | null
): Promise<StoreOutcome> {
  void config;

  let { latitude, longitude } = normalised;

  // Where the authority published a postcode but no coordinates, fill them in
  // from the postcode lookup — that is a real published fact about the
  // postcode, not an estimate of where the site is within it.
  if ((latitude === null || longitude === null) && normalised.postcode) {
    const location = await lookupPostcode(normalised.postcode);
    if (location) {
      latitude = location.latitude;
      longitude = location.longitude;
    }
  }

  const existing = await prisma.planningApplication.findUnique({
    where: {
      authorityId_reference: {
        authorityId: authority.id,
        reference: normalised.reference,
      },
    },
  });

  const data = {
    authorityId: authority.id,
    localAuthorityId: authority.localAuthorityId,
    reference: normalised.reference,
    siteAddress: normalised.siteAddress,
    postcode: normalised.postcode,
    latitude,
    longitude,
    easting: normalised.easting,
    northing: normalised.northing,
    description: normalised.description,
    applicationType: normalised.applicationType,
    category: normalised.category,
    status: normalised.status,
    decision: normalised.decision,
    submittedOn: normalised.submittedOn,
    validatedOn: normalised.validatedOn,
    consultationEndsOn: normalised.consultationEndsOn,
    decidedOn: normalised.decidedOn,
    applicantName: normalised.applicantName,
    applicantNormalisedName: normalised.applicantNormalisedName,
    agentName: normalised.agentName,
    agentNormalisedName: normalised.agentNormalisedName,
    dwellingCount: normalised.dwellingCount,
    source: `planning:${authority.slug}`,
    sourceId: `${authority.slug}:${normalised.reference}`,
    sourceUrl: normalised.sourceUrl,
    rawRecordId: context.rawRecordId,
    lastSeenAt: new Date(),
    lastUpdatedAt: new Date(),
  };

  if (!existing) {
    const created = await prisma.planningApplication.create({ data });
    await resolveApplicant(created.id, normalised, context);
    return "created";
  }

  // A status or decision change on an application is the thing users follow,
  // so those fields are recorded as a change history rather than overwritten
  // silently.
  const changed = await recordChanges({
    entityType: "planning_application",
    entityId: existing.id,
    before: existing as unknown as Record<string, unknown>,
    after: data as unknown as Record<string, unknown>,
    fields: ["status", "decision", "decidedOn", "consultationEndsOn", "description", "dwellingCount"],
    dataSourceId: context.dataSourceId,
    runId: context.runId,
  });

  await prisma.planningApplication.update({ where: { id: existing.id }, data });
  await resolveApplicant(existing.id, normalised, context);
  return changed.length > 0 ? "updated" : "skipped";
}

/**
 * Attempts to match the named applicant to a registered company.
 *
 * A planning applicant is free text, so this is genuinely uncertain. The
 * resolver refuses ambiguous matches, and the confidence is stored with the
 * link so the interface can say how sure it is rather than presenting a guess
 * as a fact.
 */
async function resolveApplicant(
  applicationId: string,
  normalised: NormalisedPlanningApplication,
  context: StoreContext
): Promise<void> {
  if (!normalised.applicantName) return;

  const resolution = await resolveCompany({
    name: normalised.applicantName,
    postcode: normalised.postcode,
  });

  // The resolver returns no company when it is not confident, including when
  // two candidates are too close to separate. An unmatched applicant is left
  // unmatched rather than attached to the likeliest guess.
  if (!resolution.companyId) {
    if (resolution.method === "ambiguous") {
      context.logger.debug("planning applicant was ambiguous, left unmatched", {
        applicant: normalised.applicantName,
        reason: resolution.reason,
      });
    }
    return;
  }

  await prisma.planningApplication.update({
    where: { id: applicationId },
    data: {
      resolvedCompanyId: resolution.companyId,
      resolutionConfidence: resolution.confidence,
    },
  });

  await linkEntities({
    fromType: "company",
    fromId: resolution.companyId,
    toType: "planning_application",
    toId: applicationId,
    relation: "applicant",
    confidence: resolution.confidence,
    method: resolution.method,
    evidence: { reason: resolution.reason, applicant: normalised.applicantName },
  });
}

/** Builds connectors for every authority that has one configured. */
export async function listPlanningConnectors(): Promise<PlanningConnector[]> {
  const authorities = await prisma.planningAuthority.findMany({
    where: { connectorKey: { not: null } },
    orderBy: { name: "asc" },
  });
  return authorities.map(createPlanningConnector);
}

export async function getPlanningConnector(key: string): Promise<PlanningConnector | undefined> {
  if (!key.startsWith(PLANNING_CONNECTOR_PREFIX)) return undefined;
  const slug = key.slice(PLANNING_CONNECTOR_PREFIX.length);

  const authority = await prisma.planningAuthority.findUnique({ where: { slug } });
  return authority ? createPlanningConnector(authority) : undefined;
}
