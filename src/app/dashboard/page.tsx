import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Database, Search } from "lucide-react";

import { SourceFooter } from "@/components/source-attribution";
import { Button } from "@/components/ui/button";
import {
  Badge,
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
import {
  getDashboardSummary,
  getRecentActivity,
  getTopLocations,
  getTopSectors,
} from "@/lib/services/dashboard";
import { formatNumber, formatRelative, humanise } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard | Cymru Intelligence" };

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const [summary, activity, sectors, locations, entitlements, alertCount, savedCount] =
    await Promise.all([
      getDashboardSummary(),
      getRecentActivity(10),
      getTopSectors(),
      getTopLocations(),
      getEntitlements(user),
      prisma.alert.count({ where: { userId: user.id, isActive: true } }),
      prisma.savedCompany.count({ where: { userId: user.id } }),
    ]);

  const firstName = user.name?.split(" ")[0] ?? null;

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title={firstName ? `Croeso, ${firstName}` : "Welcome"}
        description="Activity across Wales, drawn from connected public data sources."
        actions={
          <Button asChild>
            <Link href="/dashboard/companies">
              <Search className="h-4 w-4" />
              Search Wales
            </Link>
          </Button>
        }
      />

      {!summary.hasAnyData ? (
        <EmptyState
          icon={<Database className="h-8 w-8" strokeWidth={1.5} />}
          title="Data available after initial sync"
          description={
            `${summary.connectedSources} of ${summary.totalSources} sources are connected. ` +
            "Once a source completes its first import, live figures appear here. Until then " +
            "nothing is shown, because these numbers are never estimated."
          }
          action={
            <Button asChild variant="outline">
              <Link href="/dashboard/sources">
                Review data sources
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          }
        />
      ) : (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {summary.metrics.map((metric) => (
            <Link key={metric.key} href={metric.href} className="group">
              <Card className="h-full transition-shadow group-hover:shadow-md">
                <CardContent className="p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">
                    {metric.label}
                  </p>
                  <p className="mt-2 text-3xl font-bold tabular-nums text-ink-900">
                    {formatNumber(metric.value)}
                  </p>
                  {metric.recent !== null && metric.recent > 0 && (
                    <p className="mt-1 text-xs text-accent-green">
                      +{formatNumber(metric.recent)} in the last 30 days
                    </p>
                  )}
                  {metric.value === 0 && (
                    <p className="mt-1 text-xs text-muted">Awaiting first sync</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </section>
      )}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent activity</CardTitle>
            {summary.lastSyncAt && (
              <span className="text-xs text-muted">
                Data updated {formatRelative(summary.lastSyncAt)}
              </span>
            )}
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">
                No activity yet. Records appear here as sources sync.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {activity.map((item) => (
                  <li key={`${item.kind}-${item.id}`} className="py-3 first:pt-0 last:pb-0">
                    <Link href={item.href} className="group block">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink-900 group-hover:text-accent-green">
                            {item.title}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted">{item.subtitle}</p>
                        </div>
                        <span className="shrink-0 text-xs text-muted">
                          {formatRelative(item.occurredAt)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your workspace</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">Saved companies</span>
                <span className="font-semibold tabular-nums text-ink-900">
                  {savedCount}
                  {entitlements.limits.savedCompanies !== -1 && (
                    <span className="text-muted"> / {entitlements.limits.savedCompanies}</span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Active alerts</span>
                <span className="font-semibold tabular-nums text-ink-900">
                  {alertCount}
                  {entitlements.limits.alerts !== -1 && (
                    <span className="text-muted"> / {entitlements.limits.alerts}</span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Plan</span>
                <Badge tone={entitlements.planCode === "FREE" ? "neutral" : "info"}>
                  {entitlements.planName}
                </Badge>
              </div>
              <div className="flex gap-2 pt-2">
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link href="/dashboard/alerts">Alerts</Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link href="/dashboard/saved">Saved</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {sectors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Sector activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sectors.map((sector) => (
                  <div key={sector.sectorName} className="flex items-center justify-between text-sm">
                    <span className="truncate text-muted">{humanise(sector.sectorName)}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-ink-900">
                      {formatNumber(sector.count)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {locations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top locations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {locations.map((location) => (
                  <Link
                    key={location.slug}
                    href={`/dashboard/companies?localAuthority=${location.slug}`}
                    className="flex items-center justify-between text-sm hover:text-accent-green"
                  >
                    <span className="truncate text-muted">{location.name}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-ink-900">
                      {formatNumber(location.count)}
                    </span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <SourceFooter
        sources={["companies_house", "sell2wales"]}
        dataAsOf={summary.lastSyncAt}
      />
    </>
  );
}
