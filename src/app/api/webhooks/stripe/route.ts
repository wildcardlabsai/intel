import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { getStripe, isStripeConfigured } from "@/lib/billing/stripe";
import {
  markSubscriptionDeleted,
  syncSubscriptionFromStripe,
} from "@/lib/billing/subscriptions";
import { prisma } from "@/lib/db/prisma";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Stripe webhook receiver.
 *
 * Every event is signature-verified against STRIPE_WEBHOOK_SECRET before it is
 * read — an unverified body is never parsed as truth. Events are persisted
 * before processing, keyed on the Stripe event id, so a redelivery is a
 * no-op and a failed handler can be replayed.
 */

export const dynamic = "force-dynamic";

const HANDLED_EVENTS = new Set<string>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
  "invoice.payment_succeeded",
]);

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "not_configured", message: "Stripe is not configured on this deployment." },
      { status: 503 }
    );
  }

  const env = getEnv();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  // The raw body is required for signature verification; parsing it first
  // would invalidate the signature.
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      payload,
      signature,
      env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (error) {
    logger.warn("stripe webhook signature verification failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  // Idempotency: if we have already processed this event, acknowledge and stop.
  const existing = await prisma.billingEvent.findUnique({
    where: { stripeEventId: event.id },
    select: { id: true, processedAt: true },
  });

  if (existing?.processedAt) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const record =
    existing ??
    (await prisma.billingEvent.create({
      data: {
        stripeEventId: event.id,
        type: event.type,
        payload: event as unknown as never,
      },
      select: { id: true, processedAt: true },
    }));

  if (!HANDLED_EVENTS.has(event.type)) {
    await prisma.billingEvent.update({
      where: { id: record.id },
      data: { processedAt: new Date(), error: "Event type not handled" },
    });
    return NextResponse.json({ received: true, handled: false });
  }

  try {
    await handleEvent(event);
    await prisma.billingEvent.update({
      where: { id: record.id },
      data: { processedAt: new Date(), error: null },
    });
    return NextResponse.json({ received: true, handled: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("stripe webhook handler failed", error, { eventId: event.id, type: event.type });
    await prisma.billingEvent.update({
      where: { id: record.id },
      data: { error: message.slice(0, 2_000) },
    });
    // 500 tells Stripe to retry, which is what we want for a transient failure.
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  const stripe = getStripe();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (!session.subscription) return;

      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      // Carry the app's user id from checkout metadata onto the subscription
      // so later subscription events can be attributed without the session.
      if (session.metadata?.userId && !subscription.metadata?.userId) {
        await stripe.subscriptions.update(subscriptionId, {
          metadata: { ...subscription.metadata, userId: session.metadata.userId },
        });
        subscription.metadata = { ...subscription.metadata, userId: session.metadata.userId };
      }

      await syncSubscriptionFromStripe(subscription);
      return;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      await syncSubscriptionFromStripe(event.data.object as Stripe.Subscription);
      return;
    }

    case "customer.subscription.deleted": {
      await markSubscriptionDeleted((event.data.object as Stripe.Subscription).id);
      return;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (!customerId) return;

      const subscription = await prisma.subscription.findFirst({
        where: { stripeCustomerId: customerId },
        select: { id: true, userId: true },
      });
      if (!subscription) return;

      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "PAST_DUE" },
      });

      if (subscription.userId) {
        await prisma.notification.create({
          data: {
            userId: subscription.userId,
            type: "BILLING",
            title: "Payment failed",
            body: "We could not take payment for your subscription. Update your card to keep access.",
            link: "/dashboard/billing",
          },
        });
      }
      return;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (!customerId) return;

      await prisma.subscription.updateMany({
        where: { stripeCustomerId: customerId, status: "PAST_DUE" },
        data: { status: "ACTIVE" },
      });
      return;
    }
  }
}
