import type { Metadata } from "next";

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getIntegrationStatuses } from "@/lib/env";
import { formatCurrency, formatDate, formatNumber, humanise } from "@/lib/utils";

export const metadata: Metadata = { title: "Subscriptions | Admin" };
export const dynamic = "force-dynamic";

export default async function AdminSubscriptionsPage() {
  await requireAdmin();

  const [plans, subscriptions, recentEvents] = await Promise.all([
    prisma.plan.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { subscriptions: true } } },
    }),
    prisma.subscription.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        plan: { select: { name: true, code: true } },
        user: { select: { email: true } },
        organisation: { select: { name: true } },
      },
    }),
    prisma.billingEvent.findMany({ orderBy: { receivedAt: "desc" }, take: 15 }),
  ]);

  const stripe = getIntegrationStatuses().find((s) => s.key === "stripe");

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Subscriptions"
        description="Plans, their Stripe price configuration, and live subscriptions."
      />

      {!stripe?.configured && (
        <Card className="border-amber-300">
          <CardContent className="p-5">
            <Badge tone="warning">Stripe not configured</Badge>
            <p className="mt-2 text-sm text-muted">
              Missing: <code className="font-mono text-xs">{stripe?.missingEnvVars.join(", ")}</code>.
              Plans exist in the database but cannot be purchased until Stripe is configured.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Plans</CardTitle>
          <p className="mt-1 text-sm text-muted">
            Prices and limits live in the database. Stripe price IDs must be set here before a plan
            can be purchased.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Plan</Th>
                <Th>Price</Th>
                <Th>Stripe price ID</Th>
                <Th>Subscribers</Th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id}>
                  <Td>
                    <p className="font-medium text-ink-900">{plan.name}</p>
                    <p className="font-mono text-xs text-muted">{plan.code}</p>
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums">
                    {plan.priceMonthlyPence === null
                      ? "Custom"
                      : plan.priceMonthlyPence === 0
                        ? "Free"
                        : `${formatCurrency(plan.priceMonthlyPence / 100, plan.currency)}/mo`}
                  </Td>
                  <Td>
                    {plan.stripePriceIdMonthly ? (
                      <code className="font-mono text-xs text-muted">
                        {plan.stripePriceIdMonthly}
                      </code>
                    ) : plan.priceMonthlyPence === 0 || plan.priceMonthlyPence === null ? (
                      <span className="text-xs text-muted">Not required</span>
                    ) : (
                      <Badge tone="warning">Not set</Badge>
                    )}
                  </Td>
                  <Td className="tabular-nums">{formatNumber(plan._count.subscriptions)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscriptions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {subscriptions.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted">No subscriptions yet.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Customer</Th>
                  <Th>Plan</Th>
                  <Th>Status</Th>
                  <Th className="hidden md:table-cell">Renews</Th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((subscription) => (
                  <tr key={subscription.id}>
                    <Td className="text-ink-900">
                      {subscription.organisation?.name ?? subscription.user?.email ?? "—"}
                    </Td>
                    <Td className="text-muted">{subscription.plan.name}</Td>
                    <Td>
                      <Badge
                        tone={
                          subscription.status === "ACTIVE" || subscription.status === "TRIALING"
                            ? "positive"
                            : subscription.status === "PAST_DUE"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {humanise(subscription.status)}
                      </Badge>
                    </Td>
                    <Td className="hidden md:table-cell whitespace-nowrap text-muted">
                      {formatDate(subscription.currentPeriodEnd)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Stripe webhooks</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentEvents.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted">No webhook events received yet.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Event</Th>
                  <Th>Received</Th>
                  <Th>Processed</Th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((event) => (
                  <tr key={event.id}>
                    <Td>
                      <p className="font-mono text-xs text-ink-900">{event.type}</p>
                      {event.error && (
                        <p className="mt-0.5 text-xs text-red-700">{event.error.slice(0, 120)}</p>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-muted">{formatDate(event.receivedAt)}</Td>
                    <Td>
                      {event.processedAt ? (
                        <Badge tone="positive">Processed</Badge>
                      ) : (
                        <Badge tone="warning">Pending</Badge>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
