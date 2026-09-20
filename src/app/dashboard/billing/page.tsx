import type { Metadata } from "next";
import { Check } from "lucide-react";

import { CheckoutButton, PortalButton } from "@/app/dashboard/billing/buttons";
import { NotConfigured } from "@/components/source-attribution";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
} from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/session";
import { getEntitlements } from "@/lib/billing/plans";
import { prisma } from "@/lib/db/prisma";
import { getIntegrationStatuses } from "@/lib/env";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Billing | Cymru Intelligence" };
export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const user = await requireUser("/dashboard/billing");
  const params = await searchParams;

  const [entitlements, plans, usage] = await Promise.all([
    getEntitlements(user),
    prisma.plan.findMany({ where: { isActive: true, isPublic: true }, orderBy: { sortOrder: "asc" } }),
    getCurrentMonthUsage(user.id, user.organisationId),
  ]);

  const stripe = getIntegrationStatuses().find((s) => s.key === "stripe");

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Plan and billing"
        description="Your current plan, this month's usage, and the plans available."
        actions={entitlements.planCode !== "FREE" ? <PortalButton /> : undefined}
      />

      {params.checkout === "success" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          Thank you — your subscription is being activated. It may take a few seconds for your new
          limits to appear.
        </div>
      )}
      {params.checkout === "cancelled" && (
        <div className="rounded-md border border-border bg-cream p-4 text-sm text-muted">
          Checkout was cancelled. Nothing has been charged.
        </div>
      )}

      {!stripe?.configured && (
        <NotConfigured
          title="Payments are not configured"
          integration="subscriptions"
          missingEnvVars={stripe?.missingEnvVars ?? []}
          impact="Plans cannot be purchased or managed on this deployment. Every account stays on the Free plan."
          docsUrl={stripe?.docsUrl}
        />
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Current plan</CardTitle>
            <p className="mt-1 text-sm text-muted">
              {entitlements.planName}
              {entitlements.currentPeriodEnd && (
                <>
                  {" · "}
                  {entitlements.cancelAtPeriodEnd ? "ends" : "renews"}{" "}
                  {formatDate(entitlements.currentPeriodEnd)}
                </>
              )}
            </p>
          </div>
          <Badge tone={entitlements.planCode === "FREE" ? "neutral" : "info"}>
            {entitlements.status.toLowerCase()}
          </Badge>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <UsageStat
            label="Searches"
            used={usage.searches}
            limit={entitlements.limits.searchesPerMonth}
          />
          <UsageStat
            label="Saved companies"
            used={usage.savedCompanies}
            limit={entitlements.limits.savedCompanies}
          />
          <UsageStat label="Alerts" used={usage.alerts} limit={entitlements.limits.alerts} />
          <UsageStat
            label="Exports"
            used={usage.exports}
            limit={entitlements.limits.exportsPerMonth}
          />
        </CardContent>
      </Card>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => {
          const isCurrent = plan.code === entitlements.planCode;
          const priceConfigured = Boolean(plan.stripePriceIdMonthly);

          return (
            <Card key={plan.id} className={isCurrent ? "border-green-900" : undefined}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  {isCurrent && <Badge tone="dark">Current</Badge>}
                </div>
                <p className="mt-1 text-2xl font-bold text-ink-900">
                  {plan.priceMonthlyPence === null
                    ? "Custom"
                    : plan.priceMonthlyPence === 0
                      ? "Free"
                      : formatCurrency(plan.priceMonthlyPence / 100, plan.currency)}
                  {plan.priceMonthlyPence !== null && plan.priceMonthlyPence > 0 && (
                    <span className="text-sm font-normal text-muted">/month</span>
                  )}
                </p>
                <p className="mt-1 text-sm text-muted">{plan.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-1.5 text-sm text-muted">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-green" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {plan.code === "ENTERPRISE" ? (
                  <a
                    href="mailto:hello@cymru-intelligence.wales?subject=Enterprise%20enquiry"
                    className="block w-full rounded-md border border-border bg-white px-4 py-2 text-center text-sm font-semibold text-ink-900 hover:bg-cream"
                  >
                    Contact us
                  </a>
                ) : isCurrent ? (
                  <p className="text-center text-sm text-muted">Your current plan</p>
                ) : plan.priceMonthlyPence === 0 ? null : !stripe?.configured ? (
                  <p className="text-center text-xs text-muted">
                    Requires Stripe configuration
                  </p>
                ) : !priceConfigured ? (
                  <p className="text-center text-xs text-amber-700">
                    No Stripe price configured for this plan yet
                  </p>
                ) : (
                  <CheckoutButton planCode={plan.code} planName={plan.name} />
                )}
              </CardContent>
            </Card>
          );
        })}
      </section>
    </>
  );
}

function UsageStat({ label, used, limit }: { label: string; used: number; limit: number }) {
  const unlimited = limit === -1;
  const percentage = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-ink-900">
        {formatNumber(used)}
        <span className="text-sm font-normal text-muted">
          {unlimited ? " / unlimited" : ` / ${formatNumber(limit)}`}
        </span>
      </p>
      {!unlimited && (
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div
            className={`h-full rounded-full ${percentage >= 90 ? "bg-amber-500" : "bg-green-900"}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}

async function getCurrentMonthUsage(userId: string, organisationId: string | null) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const scope = organisationId
    ? { OR: [{ organisationId }, { userId }] }
    : { userId };

  const [searches, exports, savedCompanies, alerts] = await Promise.all([
    prisma.usageEvent.count({ where: { ...scope, kind: "SEARCH", createdAt: { gte: monthStart } } }),
    prisma.usageEvent.count({ where: { ...scope, kind: "EXPORT", createdAt: { gte: monthStart } } }),
    prisma.savedCompany.count({ where: { userId } }),
    prisma.alert.count({ where: { userId, isActive: true } }),
  ]);

  return { searches, exports, savedCompanies, alerts };
}
