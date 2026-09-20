import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";

import { AlertList, CreateAlertForm } from "@/app/dashboard/alerts/alert-ui";
import { NotConfigured } from "@/components/source-attribution";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
} from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/session";
import { getEntitlements } from "@/lib/billing/plans";
import { prisma } from "@/lib/db/prisma";
import { getIntegrationStatuses } from "@/lib/env";

export const metadata: Metadata = { title: "Alerts | Cymru Intelligence" };
export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const user = await requireUser("/dashboard/alerts");

  const [alerts, entitlements, localAuthorities, recentEvents] = await Promise.all([
    prisma.alert.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { events: true } } },
    }),
    getEntitlements(user),
    prisma.localAuthority.findMany({ select: { name: true, slug: true }, orderBy: { name: "asc" } }),
    prisma.alertEvent.findMany({
      where: { alert: { userId: user.id } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { alert: { select: { name: true } } },
    }),
  ]);

  const activeCount = alerts.filter((alert) => alert.isActive).length;
  const resend = getIntegrationStatuses().find((s) => s.key === "resend");

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Alerts"
        description="Get told when new records match a saved search. Alerts run on a schedule and never notify you twice about the same record."
      />

      {!resend?.configured && (
        <NotConfigured
          title="Email delivery is not configured"
          integration="alert emails"
          missingEnvVars={resend?.missingEnvVars ?? []}
          impact="Alerts still run and matches appear in your dashboard, but no email is sent."
          docsUrl={resend?.docsUrl}
        />
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr]">
        <CreateAlertForm
          localAuthorities={localAuthorities}
          atLimit={
            entitlements.limits.alerts !== -1 && activeCount >= entitlements.limits.alerts
          }
          limit={entitlements.limits.alerts}
          planName={entitlements.planName}
        />

        <div className="min-w-0 space-y-6">
          {alerts.length === 0 ? (
            <EmptyState
              icon={<Bell className="h-8 w-8" strokeWidth={1.5} />}
              title="No alerts yet"
              description="Create your first alert to be told when new Welsh companies, contracts, planning applications or funding schemes match what you care about."
            />
          ) : (
            <AlertList alerts={alerts.map(serialiseAlert)} />
          )}

          <Card>
            <CardHeader>
              <CardTitle>Recent matches</CardTitle>
            </CardHeader>
            <CardContent>
              {recentEvents.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">
                  No matches yet. Matches appear here after an alert runs.
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {recentEvents.map((event) => (
                    <li key={event.id} className="py-3 first:pt-0 last:pb-0">
                      <Link href={event.url ?? "/dashboard"} className="group block">
                        <p className="text-sm font-semibold text-ink-900 group-hover:text-accent-green">
                          {event.title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {event.alert.name}
                          {event.summary ? ` · ${event.summary}` : ""}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function serialiseAlert(alert: {
  id: string;
  name: string;
  entityType: string;
  query: string | null;
  frequency: string;
  isActive: boolean;
  emailEnabled: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  matchCount: number;
  _count: { events: number };
}) {
  return {
    id: alert.id,
    name: alert.name,
    entityType: alert.entityType,
    query: alert.query,
    frequency: alert.frequency,
    isActive: alert.isActive,
    emailEnabled: alert.emailEnabled,
    lastRunAt: alert.lastRunAt,
    nextRunAt: alert.nextRunAt,
    eventCount: alert._count.events,
  };
}
