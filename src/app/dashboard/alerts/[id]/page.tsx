import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Pagination } from "@/components/dashboard/pagination";
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
import { prisma } from "@/lib/db/prisma";
import { formatDateTime, formatNumber, formatRelative, humanise } from "@/lib/utils";

export const metadata: Metadata = { title: "Alert | Cymru Intelligence" };
export const dynamic = "force-dynamic";

const PER_PAGE = 25;

export default async function AlertDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requireUser(`/dashboard/alerts/${id}`);
  const page = Math.max(1, Number(query.page ?? 1) || 1);

  const alert = await prisma.alert.findUnique({ where: { id } });

  // Ownership check: an alert id alone must not grant access.
  if (!alert || alert.userId !== user.id) notFound();

  const [events, total] = await Promise.all([
    prisma.alertEvent.findMany({
      where: { alertId: alert.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.alertEvent.count({ where: { alertId: alert.id } }),
  ]);

  const filters = alert.filters as Record<string, unknown>;

  return (
    <>
      <PageHeader
        eyebrow="Alert"
        title={alert.name}
        description={`Watching ${humanise(alert.entityType).toLowerCase()} · checked ${humanise(
          alert.frequency
        ).toLowerCase()}`}
        actions={
          <Link href="/dashboard/alerts" className="text-sm font-semibold text-accent-green hover:underline">
            All alerts
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={alert.isActive ? "positive" : "neutral"}>
          {alert.isActive ? "Active" : "Paused"}
        </Badge>
        {alert.query && <Badge tone="neutral">“{alert.query}”</Badge>}
        {Object.entries(filters).map(([key, value]) => (
          <Badge key={key} tone="neutral">
            {humanise(key)}: {String(value)}
          </Badge>
        ))}
        <Badge tone="neutral">
          {alert.emailEnabled ? "Email enabled" : "In-app only"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Field label="Last run" value={alert.lastRunAt ? formatRelative(alert.lastRunAt) : "Never"} />
          <Field label="Next run" value={alert.nextRunAt ? formatRelative(alert.nextRunAt) : "—"} />
          <Field label="Total matches" value={formatNumber(alert.matchCount)} />
          <Field
            label="Only records after"
            value={alert.watermark ? formatDateTime(alert.watermark) : "—"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Matches ({formatNumber(total)})</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <EmptyState
              title="No matches yet"
              description="This alert has not matched any records since it was created. It only reports records first seen after it was set up, so it never floods you with the back catalogue."
            />
          ) : (
            <ul className="divide-y divide-border/60">
              {events.map((event) => (
                <li key={event.id} className="py-3 first:pt-0 last:pb-0">
                  <Link href={event.url ?? "/dashboard"} className="group block">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-900 group-hover:text-accent-green">
                          {event.title}
                        </p>
                        {event.summary && (
                          <p className="mt-0.5 truncate text-xs text-muted">{event.summary}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-muted">{formatRelative(event.createdAt)}</p>
                        {event.notifiedAt && (
                          <p className="text-[11px] text-emerald-700">Emailed</p>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Pagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / PER_PAGE))}
        params={query}
      />
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-ink-900">{value}</p>
    </div>
  );
}
