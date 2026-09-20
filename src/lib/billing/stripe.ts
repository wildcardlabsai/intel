import "server-only";

import Stripe from "stripe";

import { getEnv, IntegrationNotConfiguredError, isConfigured } from "@/lib/env";

/**
 * Stripe client.
 *
 * Stripe is optional: without keys the app runs with everyone on the Free
 * plan and the billing screens say so plainly. Nothing simulates a purchase.
 */

let client: Stripe | null = null;

export function getStripe(): Stripe {
  const env = getEnv();
  if (!env.STRIPE_SECRET_KEY) {
    throw new IntegrationNotConfiguredError("stripe", ["STRIPE_SECRET_KEY"]);
  }
  client ??= new Stripe(env.STRIPE_SECRET_KEY, {
    // Pinning the version means a Stripe-side upgrade cannot silently change
    // the shapes this code parses.
    apiVersion: "2026-08-26.dahlia",
    appInfo: { name: "Cymru Intelligence", version: "1.0.0" },
  });
  return client;
}

export function isStripeConfigured(): boolean {
  return isConfigured("stripe");
}

/** Test seam. */
export function __setStripeClient(next: Stripe | null): void {
  client = next;
}

/**
 * Maps a Stripe subscription status onto our enum. Unknown statuses become
 * INCOMPLETE rather than silently granting access.
 */
export function mapStripeStatus(status: Stripe.Subscription.Status):
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELED"
  | "INCOMPLETE"
  | "INCOMPLETE_EXPIRED"
  | "UNPAID"
  | "PAUSED" {
  switch (status) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
      return "CANCELED";
    case "incomplete":
      return "INCOMPLETE";
    case "incomplete_expired":
      return "INCOMPLETE_EXPIRED";
    case "unpaid":
      return "UNPAID";
    case "paused":
      return "PAUSED";
    default:
      return "INCOMPLETE";
  }
}

export function toDate(seconds: number | null | undefined): Date | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000);
}
