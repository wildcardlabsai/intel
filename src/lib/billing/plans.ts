import "server-only";

import { cache } from "react";

import type { PlanCode, UsageKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import type { SessionUser } from "@/lib/auth/session";
import { DEFAULT_LIMITS, type PlanLimits } from "@/lib/billing/plan-definitions";

export * from "@/lib/billing/plan-definitions";

/**
 * Plan entitlements.
 *
 * Plans and their limits live in the database so pricing can change without a
 * deploy, and Stripe price IDs are attached per environment. `DEFAULT_PLANS`
 * is the seed used to create them on first setup — it is the starting point,
 * not a hard-coded source of truth for a running system.
 *
 * A limit of -1 means unlimited.
 */

export type Entitlements = {
  planCode: PlanCode;
  planName: string;
  limits: PlanLimits;
  status: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  /** True when Stripe is unconfigured, so nothing could have been purchased. */
  billingUnavailable: boolean;
};

function parseLimits(raw: unknown): PlanLimits {
  if (!raw || typeof raw !== "object") return DEFAULT_LIMITS;
  const value = raw as Partial<PlanLimits>;
  return {
    searchesPerMonth: numberOr(value.searchesPerMonth, DEFAULT_LIMITS.searchesPerMonth),
    savedCompanies: numberOr(value.savedCompanies, DEFAULT_LIMITS.savedCompanies),
    alerts: numberOr(value.alerts, DEFAULT_LIMITS.alerts),
    exportsPerMonth: numberOr(value.exportsPerMonth, DEFAULT_LIMITS.exportsPerMonth),
    reportsPerMonth: numberOr(value.reportsPerMonth, DEFAULT_LIMITS.reportsPerMonth),
    seats: numberOr(value.seats, DEFAULT_LIMITS.seats),
    apiAccess: value.apiAccess ?? DEFAULT_LIMITS.apiAccess,
    apiRequestsPerMonth: numberOr(value.apiRequestsPerMonth, DEFAULT_LIMITS.apiRequestsPerMonth),
    advancedFilters: value.advancedFilters ?? DEFAULT_LIMITS.advancedFilters,
    bulkExport: value.bulkExport ?? DEFAULT_LIMITS.bulkExport,
  };
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Statuses that grant access to paid features. */
const ACTIVE_STATUSES = new Set(["ACTIVE", "TRIALING", "PAST_DUE"]);

/**
 * Resolves a user's entitlements from the database. Never trusts the client.
 * Falls back to the Free plan whenever no active subscription exists.
 */
export const getEntitlements = cache(async (user: SessionUser): Promise<Entitlements> => {
  const subscription = await prisma.subscription.findFirst({
    where: {
      OR: [
        ...(user.organisationId ? [{ organisationId: user.organisationId }] : []),
        { userId: user.id },
      ],
      status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] },
    },
    orderBy: { createdAt: "desc" },
    include: { plan: true },
  });

  const billingUnavailable = !process.env.STRIPE_SECRET_KEY;

  if (subscription && ACTIVE_STATUSES.has(subscription.status)) {
    return {
      planCode: subscription.plan.code,
      planName: subscription.plan.name,
      limits: parseLimits(subscription.plan.limits),
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      billingUnavailable,
    };
  }

  const freePlan = await prisma.plan.findUnique({ where: { code: "FREE" } });

  return {
    planCode: "FREE",
    planName: freePlan?.name ?? "Free",
    limits: freePlan ? parseLimits(freePlan.limits) : DEFAULT_LIMITS,
    status: "ACTIVE",
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    billingUnavailable,
  };
});

export type UsageCheck = {
  allowed: boolean;
  used: number;
  limit: number;
  /** Null when the limit is unlimited. */
  remaining: number | null;
  reason?: string;
};

const USAGE_LIMIT_FIELD: Partial<Record<UsageKind, keyof PlanLimits>> = {
  SEARCH: "searchesPerMonth",
  EXPORT: "exportsPerMonth",
  REPORT: "reportsPerMonth",
  API_CALL: "apiRequestsPerMonth",
};

function startOfMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Checks a metered action against the plan limit for the current calendar
 * month. Admins are exempt so support staff are never blocked.
 */
export async function checkUsage(
  user: SessionUser,
  kind: UsageKind
): Promise<UsageCheck> {
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
    return { allowed: true, used: 0, limit: -1, remaining: null };
  }

  const entitlements = await getEntitlements(user);
  const field = USAGE_LIMIT_FIELD[kind];
  if (!field) return { allowed: true, used: 0, limit: -1, remaining: null };

  const limit = entitlements.limits[field];
  if (typeof limit !== "number") return { allowed: true, used: 0, limit: -1, remaining: null };
  if (limit === -1) return { allowed: true, used: 0, limit: -1, remaining: null };

  const used = await prisma.usageEvent.count({
    where: {
      kind,
      createdAt: { gte: startOfMonth() },
      OR: [
        ...(user.organisationId ? [{ organisationId: user.organisationId }] : []),
        { userId: user.id },
      ],
    },
  });

  const allowed = used < limit;
  return {
    allowed,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    reason: allowed
      ? undefined
      : `Your ${entitlements.planName} plan includes ${limit} ${kind
          .toLowerCase()
          .replace("_", " ")}s per month. Upgrade to continue.`,
  };
}

/** Counts a metered action. Called after the action succeeds. */
export async function recordUsage(
  user: Pick<SessionUser, "id" | "organisationId">,
  kind: UsageKind,
  metadata: Record<string, unknown> = {},
  apiKeyId?: string
): Promise<void> {
  await prisma.usageEvent.create({
    data: {
      userId: user.id,
      organisationId: user.organisationId,
      apiKeyId: apiKeyId ?? null,
      kind,
      metadata: metadata as never,
    },
  });
}

/** Checks a non-metered cap such as "how many alerts may exist at once". */
export async function checkCountLimit(
  user: SessionUser,
  field: "savedCompanies" | "alerts",
  currentCount: number
): Promise<UsageCheck> {
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") {
    return { allowed: true, used: currentCount, limit: -1, remaining: null };
  }

  const entitlements = await getEntitlements(user);
  const limit = entitlements.limits[field];
  if (limit === -1) return { allowed: true, used: currentCount, limit: -1, remaining: null };

  const allowed = currentCount < limit;
  return {
    allowed,
    used: currentCount,
    limit,
    remaining: Math.max(0, limit - currentCount),
    reason: allowed
      ? undefined
      : `Your ${entitlements.planName} plan includes ${limit} ${
          field === "savedCompanies" ? "saved companies" : "alerts"
        }. Upgrade for more.`,
  };
}
