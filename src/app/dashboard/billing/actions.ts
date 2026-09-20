"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { getStripe, isStripeConfigured } from "@/lib/billing/stripe";
import { prisma } from "@/lib/db/prisma";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

export type BillingActionResult = { error: string } | void;

/**
 * Starts a Stripe Checkout session for a plan.
 *
 * The price is read from the database, never from the request, so a user
 * cannot check out at a price of their choosing.
 */
export async function startCheckout(
  planCode: string,
  interval: "monthly" | "yearly"
): Promise<BillingActionResult> {
  const user = await requireUser("/dashboard/billing");

  if (!isStripeConfigured()) {
    return {
      error:
        "Stripe is not configured on this deployment, so plans cannot be purchased. " +
        "Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.",
    };
  }

  const plan = await prisma.plan.findFirst({
    where: { code: planCode as never, isActive: true },
  });

  if (!plan) return { error: "That plan is not available." };

  const priceId = interval === "yearly" ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly;
  if (!priceId) {
    return {
      error:
        `The ${plan.name} plan has no Stripe price configured for ${interval} billing. ` +
        `An administrator must set it in Admin → Subscriptions.`,
    };
  }

  const env = getEnv();
  const stripe = getStripe();

  // Reuse the organisation's Stripe customer when there is one, so team
  // billing stays on a single customer record.
  let customerId: string | undefined;
  if (user.organisationId) {
    const organisation = await prisma.organisation.findUnique({
      where: { id: user.organisationId },
      select: { stripeCustomerId: true, billingEmail: true, name: true },
    });
    customerId = organisation?.stripeCustomerId ?? undefined;

    if (!customerId && organisation) {
      const customer = await stripe.customers.create({
        email: organisation.billingEmail ?? user.email,
        name: organisation.name,
        metadata: { organisationId: user.organisationId, userId: user.id },
      });
      customerId = customer.id;
      await prisma.organisation.update({
        where: { id: user.organisationId },
        data: { stripeCustomerId: customer.id },
      });
    }
  }

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      ...(customerId ? { customer: customerId } : { customer_email: user.email }),
      client_reference_id: user.id,
      metadata: { userId: user.id, planCode: plan.code },
      subscription_data: {
        metadata: { userId: user.id, planCode: plan.code },
        ...(plan.trialDays > 0 ? { trial_period_days: plan.trialDays } : {}),
      },
      success_url: `${env.APP_URL}/dashboard/billing?checkout=success`,
      cancel_url: `${env.APP_URL}/dashboard/billing?checkout=cancelled`,
      allow_promotion_codes: true,
    });
  } catch (error) {
    logger.error("stripe checkout session failed", error, { userId: user.id, planCode });
    return { error: "Could not start checkout. Please try again." };
  }

  if (!session.url) return { error: "Stripe did not return a checkout URL." };

  redirect(session.url);
}

/** Opens the Stripe customer portal so users manage their own billing. */
export async function openBillingPortal(): Promise<BillingActionResult> {
  const user = await requireUser("/dashboard/billing");

  if (!isStripeConfigured()) {
    return { error: "Stripe is not configured on this deployment." };
  }

  const subscription = await prisma.subscription.findFirst({
    where: {
      OR: [
        ...(user.organisationId ? [{ organisationId: user.organisationId }] : []),
        { userId: user.id },
      ],
      stripeCustomerId: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: { stripeCustomerId: true },
  });

  if (!subscription?.stripeCustomerId) {
    return { error: "You do not have a billing account yet. Choose a plan first." };
  }

  const env = getEnv();

  let portal;
  try {
    portal = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${env.APP_URL}/dashboard/billing`,
    });
  } catch (error) {
    logger.error("stripe portal session failed", error, { userId: user.id });
    return {
      error:
        "Could not open the billing portal. If this is a new Stripe account, enable the " +
        "customer portal in Stripe → Settings → Billing → Customer portal.",
    };
  }

  redirect(portal.url);
}
