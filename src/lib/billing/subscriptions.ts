import "server-only";

import type Stripe from "stripe";

import { prisma } from "@/lib/db/prisma";
import { mapStripeStatus, toDate } from "@/lib/billing/stripe";
import { logger } from "@/lib/logger";

/**
 * Applies Stripe subscription state to our database.
 *
 * Subscription state is only ever written from a verified webhook or a direct
 * API read — never from anything the browser reports. `stripeSubscriptionId`
 * is unique, so replaying a webhook is idempotent.
 */

export async function syncSubscriptionFromStripe(
  subscription: Stripe.Subscription
): Promise<void> {
  const priceId = subscription.items.data[0]?.price.id ?? null;
  const productId =
    typeof subscription.items.data[0]?.price.product === "string"
      ? subscription.items.data[0].price.product
      : (subscription.items.data[0]?.price.product as Stripe.Product | undefined)?.id ?? null;

  // Find the plan this price belongs to. If we cannot, the subscription is
  // still recorded — against the Free plan — and flagged, because dropping it
  // would silently deny access to someone who has paid.
  const plan =
    (priceId
      ? await prisma.plan.findFirst({
          where: {
            OR: [{ stripePriceIdMonthly: priceId }, { stripePriceIdYearly: priceId }],
          },
        })
      : null) ??
    (productId ? await prisma.plan.findFirst({ where: { stripeProductId: productId } }) : null);

  if (!plan) {
    logger.warn("stripe subscription has no matching plan", {
      subscriptionId: subscription.id,
      priceId,
      productId,
    });
  }

  const fallbackPlan = plan ?? (await prisma.plan.findUnique({ where: { code: "FREE" } }));
  if (!fallbackPlan) {
    throw new Error("No plans exist. Run the reference data seed before accepting payments.");
  }

  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  // Attach to whichever of organisation / user owns this Stripe customer.
  const organisation = await prisma.organisation.findUnique({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });

  const userIdFromMetadata = subscription.metadata?.userId ?? null;
  const user = userIdFromMetadata
    ? await prisma.user.findUnique({ where: { id: userIdFromMetadata }, select: { id: true } })
    : null;

  if (!organisation && !user) {
    logger.warn("stripe subscription matches no organisation or user", {
      subscriptionId: subscription.id,
      customerId,
    });
    return;
  }

  // The current period lives on the subscription item in recent API versions.
  const item = subscription.items.data[0];
  const periodStart = toDate(item?.current_period_start);
  const periodEnd = toDate(item?.current_period_end);

  const data = {
    planId: fallbackPlan.id,
    status: mapStripeStatus(subscription.status),
    stripeCustomerId: customerId,
    stripePriceId: priceId,
    quantity: item?.quantity ?? 1,
    currentPeriodStart: periodStart,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: toDate(subscription.canceled_at),
    trialEndsAt: toDate(subscription.trial_end),
    organisationId: organisation?.id ?? null,
    userId: organisation ? null : (user?.id ?? null),
  };

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: subscription.id },
    create: { stripeSubscriptionId: subscription.id, ...data },
    update: data,
  });

  // Keep the user's role aligned with what they are paying for, so
  // role-based checks and plan checks never disagree.
  const targetUserId = user?.id ?? null;
  if (targetUserId) {
    const active = ["ACTIVE", "TRIALING", "PAST_DUE"].includes(data.status);
    const role = !active
      ? "USER"
      : fallbackPlan.code === "PRO"
        ? "PRO"
        : fallbackPlan.code === "BUSINESS"
          ? "BUSINESS"
          : fallbackPlan.code === "ENTERPRISE"
            ? "ENTERPRISE"
            : "USER";

    const existing = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { role: true },
    });

    // Never demote an administrator because of a billing change.
    if (existing && existing.role !== "ADMIN" && existing.role !== "SUPER_ADMIN") {
      await prisma.user.update({ where: { id: targetUserId }, data: { role } });
    }
  }
}

/** Marks a subscription cancelled when Stripe deletes it. */
export async function markSubscriptionDeleted(subscriptionId: string): Promise<void> {
  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
    select: { id: true, userId: true },
  });
  if (!existing) return;

  await prisma.subscription.update({
    where: { id: existing.id },
    data: { status: "CANCELED", canceledAt: new Date() },
  });

  if (existing.userId) {
    const user = await prisma.user.findUnique({
      where: { id: existing.userId },
      select: { role: true },
    });
    if (user && user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      await prisma.user.update({ where: { id: existing.userId }, data: { role: "USER" } });
    }
  }
}
