import "server-only";

import type { Alert, EntityType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { searchCompanies } from "@/lib/search/companies";
import { companyFilterSchema, type CompanyFilters } from "@/lib/search/types";

/**
 * Alert processing.
 *
 * An alert is a saved search plus a delivery schedule. Processing re-runs the
 * saved filters, restricted to records first seen since the alert's watermark,
 * and records one AlertEvent per newly matching record.
 *
 * The watermark and the unique constraint on (alertId, entityType, entityId)
 * together guarantee a user is never notified twice about the same record,
 * even if a run is retried.
 */

export type AlertMatch = {
  entityType: EntityType;
  entityId: string;
  title: string;
  summary: string | null;
  url: string;
  occurredAt: Date;
};

const MAX_MATCHES_PER_RUN = 50;

export async function findAlertMatches(alert: Alert): Promise<AlertMatch[]> {
  const since = alert.watermark ?? alert.createdAt;

  switch (alert.entityType) {
    case "COMPANY":
      return findCompanyMatches(alert, since);
    case "PROCUREMENT":
      return findProcurementMatches(alert, since);
    case "PLANNING":
      return findPlanningMatches(alert, since);
    case "FUNDING":
      return findFundingMatches(alert, since);
    default:
      return [];
  }
}

async function findCompanyMatches(alert: Alert, since: Date): Promise<AlertMatch[]> {
  const parsed = companyFilterSchema.safeParse({
    ...(alert.filters as Record<string, unknown>),
    q: alert.query ?? undefined,
  });
  if (!parsed.success) {
    logger.warn("alert has invalid company filters", { alertId: alert.id });
    return [];
  }

  const filters: CompanyFilters = parsed.data;
  const results = await searchCompanies(filters, { page: 1, perPage: MAX_MATCHES_PER_RUN });

  // The search layer orders by relevance, so the "new since" restriction is
  // applied here against the ingestion timestamp.
  const companies = await prisma.company.findMany({
    where: {
      id: { in: results.items.map((item) => item.id) },
      firstSeenAt: { gt: since },
    },
    select: { id: true, companyNumber: true, name: true, town: true, firstSeenAt: true, status: true },
  });

  return companies.map((company) => ({
    entityType: "COMPANY" as const,
    entityId: company.id,
    title: company.name,
    summary: [company.town, company.status.toLowerCase()].filter(Boolean).join(" · "),
    url: `/dashboard/companies/${company.companyNumber}`,
    occurredAt: company.firstSeenAt,
  }));
}

async function findProcurementMatches(alert: Alert, since: Date): Promise<AlertMatch[]> {
  const filters = alert.filters as {
    minValue?: number;
    maxValue?: number;
    status?: string[];
    localAuthority?: string;
  };

  const notices = await prisma.procurementNotice.findMany({
    where: {
      firstSeenAt: { gt: since },
      ...(filters.minValue ? { valueAmount: { gte: filters.minValue } } : {}),
      ...(filters.maxValue ? { valueAmount: { lte: filters.maxValue } } : {}),
      ...(alert.query
        ? {
            OR: [
              { title: { contains: alert.query, mode: "insensitive" } },
              { description: { contains: alert.query, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(filters.localAuthority
        ? { localAuthority: { slug: filters.localAuthority } }
        : {}),
    },
    orderBy: { firstSeenAt: "desc" },
    take: MAX_MATCHES_PER_RUN,
    select: {
      id: true,
      title: true,
      valueAmount: true,
      valueCurrency: true,
      firstSeenAt: true,
      publishedAt: true,
      buyer: { select: { name: true } },
    },
  });

  return notices.map((notice) => ({
    entityType: "PROCUREMENT" as const,
    entityId: notice.id,
    title: notice.title,
    summary: notice.buyer?.name ?? null,
    url: `/dashboard/procurement/${notice.id}`,
    occurredAt: notice.publishedAt ?? notice.firstSeenAt,
  }));
}

async function findPlanningMatches(alert: Alert, since: Date): Promise<AlertMatch[]> {
  const filters = alert.filters as { localAuthority?: string; status?: string[] };

  const applications = await prisma.planningApplication.findMany({
    where: {
      firstSeenAt: { gt: since },
      ...(alert.query
        ? {
            OR: [
              { description: { contains: alert.query, mode: "insensitive" } },
              { siteAddress: { contains: alert.query, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(filters.localAuthority ? { localAuthority: { slug: filters.localAuthority } } : {}),
    },
    orderBy: { firstSeenAt: "desc" },
    take: MAX_MATCHES_PER_RUN,
    select: {
      id: true,
      reference: true,
      description: true,
      siteAddress: true,
      firstSeenAt: true,
      submittedOn: true,
    },
  });

  return applications.map((application) => ({
    entityType: "PLANNING" as const,
    entityId: application.id,
    title: application.description ?? application.reference,
    summary: application.siteAddress,
    url: `/dashboard/planning/${application.id}`,
    occurredAt: application.submittedOn ?? application.firstSeenAt,
  }));
}

async function findFundingMatches(alert: Alert, since: Date): Promise<AlertMatch[]> {
  const opportunities = await prisma.fundingOpportunity.findMany({
    where: {
      firstSeenAt: { gt: since },
      ...(alert.query
        ? {
            OR: [
              { title: { contains: alert.query, mode: "insensitive" } },
              { summary: { contains: alert.query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { firstSeenAt: "desc" },
    take: MAX_MATCHES_PER_RUN,
    select: {
      id: true,
      title: true,
      organisationName: true,
      closesAt: true,
      firstSeenAt: true,
    },
  });

  return opportunities.map((opportunity) => ({
    entityType: "FUNDING" as const,
    entityId: opportunity.id,
    title: opportunity.title,
    summary: opportunity.organisationName,
    url: `/dashboard/funding/${opportunity.id}`,
    occurredAt: opportunity.firstSeenAt,
  }));
}

export type AlertRunResult = {
  alertId: string;
  matches: number;
  notified: boolean;
};

/**
 * Runs one alert: finds matches, records events, creates an in-app
 * notification and (when email is configured) queues an email.
 */
export async function processAlert(alert: Alert): Promise<AlertRunResult> {
  const matches = await findAlertMatches(alert);
  const now = new Date();

  if (matches.length === 0) {
    await prisma.alert.update({
      where: { id: alert.id },
      data: { lastRunAt: now, nextRunAt: nextRunFor(alert.frequency, now) },
    });
    return { alertId: alert.id, matches: 0, notified: false };
  }

  // createMany with skipDuplicates makes a retried run idempotent.
  const created = await prisma.alertEvent.createMany({
    data: matches.map((match) => ({
      alertId: alert.id,
      entityType: match.entityType,
      entityId: match.entityId,
      title: match.title,
      summary: match.summary,
      url: match.url,
    })),
    skipDuplicates: true,
  });

  const watermark = matches.reduce(
    (latest, match) => (match.occurredAt > latest ? match.occurredAt : latest),
    alert.watermark ?? alert.createdAt
  );

  await prisma.alert.update({
    where: { id: alert.id },
    data: {
      lastRunAt: now,
      nextRunAt: nextRunFor(alert.frequency, now),
      watermark,
      matchCount: { increment: created.count },
    },
  });

  if (created.count > 0 && alert.inAppEnabled) {
    await prisma.notification.create({
      data: {
        userId: alert.userId,
        type: "ALERT",
        title: `${created.count} new ${created.count === 1 ? "match" : "matches"} for “${alert.name}”`,
        body: matches
          .slice(0, 3)
          .map((match) => match.title)
          .join(", "),
        link: `/dashboard/alerts/${alert.id}`,
        metadata: { alertId: alert.id, matchCount: created.count },
      },
    });
  }

  return { alertId: alert.id, matches: created.count, notified: created.count > 0 };
}

export function nextRunFor(frequency: Alert["frequency"], from: Date): Date {
  const next = new Date(from);
  switch (frequency) {
    case "IMMEDIATE":
      next.setUTCHours(next.getUTCHours() + 1);
      break;
    case "DAILY":
      next.setUTCDate(next.getUTCDate() + 1);
      break;
    case "WEEKLY":
      next.setUTCDate(next.getUTCDate() + 7);
      break;
  }
  return next;
}

/** Alerts that are active and due. */
export async function getDueAlerts(limit = 100): Promise<Alert[]> {
  return prisma.alert.findMany({
    where: {
      isActive: true,
      OR: [{ nextRunAt: null }, { nextRunAt: { lte: new Date() } }],
    },
    orderBy: { nextRunAt: { sort: "asc", nulls: "first" } },
    take: limit,
  });
}
