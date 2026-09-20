import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3 } from "lucide-react";

import { GenerateReportForm } from "@/app/dashboard/reports/report-ui";
import { SourceFooter } from "@/components/source-attribution";
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
import { formatDate, formatRelative, humanise } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports | Cymru Intelligence" };
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = await requireUser("/dashboard/reports");

  const [reports, entitlements, localAuthorities, hasData] = await Promise.all([
    prisma.report.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    getEntitlements(user),
    prisma.localAuthority.findMany({ select: { name: true, slug: true }, orderBy: { name: "asc" } }),
    prisma.company.count({ where: { isWelsh: true } }).then((count) => count > 0),
  ]);

  const included = entitlements.limits.reportsPerMonth !== 0;

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Reports"
        description="Generate a regional or sector report from the data currently held. Every figure is a live count with its sources and date recorded."
      />

      {!included ? (
        <Card>
          <CardContent className="p-6">
            <Badge tone="warning">Not included in your plan</Badge>
            <h3 className="mt-3 text-base font-bold text-ink-900">
              Reports are available on Pro and above
            </h3>
            <p className="mt-2 text-sm text-muted">
              Upgrade to generate regional and sector reports.
            </p>
            <Link
              href="/dashboard/billing"
              className="mt-4 inline-block text-sm font-semibold text-accent-green hover:underline"
            >
              View plans
            </Link>
          </CardContent>
        </Card>
      ) : !hasData ? (
        <EmptyState
          icon={<BarChart3 className="h-8 w-8" strokeWidth={1.5} />}
          title="Nothing to report on yet"
          description="Reports are built from ingested records. Once a source has completed its first sync, you can generate a report here. No report is ever produced from estimated figures."
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
          <GenerateReportForm localAuthorities={localAuthorities} />

          <div className="min-w-0">
            <Card>
              <CardHeader>
                <CardTitle>Your reports</CardTitle>
              </CardHeader>
              <CardContent>
                {reports.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted">
                    No reports generated yet.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {reports.map((report) => (
                      <li key={report.id} className="py-3 first:pt-0 last:pb-0">
                        <Link
                          href={`/dashboard/reports/${report.id}`}
                          className="group flex items-start justify-between gap-4"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink-900 group-hover:text-accent-green">
                              {report.title}
                            </p>
                            <p className="mt-0.5 text-xs text-muted">
                              {humanise(report.type)} ·{" "}
                              {report.dataAsOf
                                ? `data as of ${formatDate(report.dataAsOf)}`
                                : "no data window recorded"}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge
                              tone={
                                report.status === "READY"
                                  ? "positive"
                                  : report.status === "FAILED"
                                    ? "critical"
                                    : "neutral"
                              }
                            >
                              {humanise(report.status)}
                            </Badge>
                            <span className="text-xs text-muted">
                              {formatRelative(report.createdAt)}
                            </span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <SourceFooter sources={["companies_house", "sell2wales"]} />
    </>
  );
}
