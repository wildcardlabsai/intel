import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SourceFooter } from "@/components/source-attribution";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
} from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Report | Cymru Intelligence" };
export const dynamic = "force-dynamic";

type ReportData = {
  scope: string;
  generatedAt: string;
  companies: { total: number; active: number; incorporatedLast12Months: number };
  procurement: { notices: number; totalValue: string | null };
  planning: { applications: number };
  topSectors: Array<{ name: string; count: number }>;
  caveats: string[];
};

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/reports/${id}`);

  const report = await prisma.report.findUnique({ where: { id } });

  // Ownership check: a report id alone must not grant access.
  if (!report || report.userId !== user.id) notFound();

  const data = report.data as ReportData | null;

  return (
    <>
      <PageHeader
        eyebrow="Report"
        title={report.title}
        description={
          report.dataAsOf
            ? `Generated ${formatDate(report.createdAt)} from data held as of ${formatDate(report.dataAsOf)}.`
            : `Generated ${formatDate(report.createdAt)}.`
        }
      />

      {report.status === "FAILED" ? (
        <Card>
          <CardContent className="p-6">
            <Badge tone="critical">Failed</Badge>
            <p className="mt-3 text-sm text-muted">
              {report.error ?? "This report could not be generated."}
            </p>
          </CardContent>
        </Card>
      ) : !data ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted">
            This report is still being generated.
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Companies" value={formatNumber(data.companies.total)} />
            <Stat label="Active" value={formatNumber(data.companies.active)} />
            <Stat
              label="Incorporated (12m)"
              value={formatNumber(data.companies.incorporatedLast12Months)}
            />
            <Stat label="Contract notices" value={formatNumber(data.procurement.notices)} />
          </section>

          {data.procurement.totalValue && (
            <Card>
              <CardHeader>
                <CardTitle>Published contract value</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tabular-nums text-ink-900">
                  {formatCurrency(data.procurement.totalValue, "GBP")}
                </p>
                <p className="mt-1 text-sm text-muted">
                  Total across {formatNumber(data.procurement.notices)} notices that published a
                  value.
                </p>
              </CardContent>
            </Card>
          )}

          {data.topSectors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Companies by sector</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.topSectors.map((sector) => {
                  const share =
                    data.companies.total > 0
                      ? Math.round((sector.count / data.companies.total) * 100)
                      : 0;
                  return (
                    <div key={sector.name}>
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="text-muted">{sector.name}</span>
                        <span className="font-semibold tabular-nums text-ink-900">
                          {formatNumber(sector.count)}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full bg-green-900"
                          style={{ width: `${share}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Methodology and caveats</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm leading-relaxed text-muted">
                {data.caveats.map((caveat) => (
                  <li key={caveat} className="flex gap-2">
                    <span aria-hidden="true">·</span>
                    {caveat}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <SourceFooter sources={report.sourcesUsed} dataAsOf={report.dataAsOf} />
        </>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
        <p className="mt-2 text-2xl font-bold tabular-nums text-ink-900">{value}</p>
      </CardContent>
    </Card>
  );
}
