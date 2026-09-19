import type { Metadata } from "next";
import Link from "next/link";

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
import { countRecentImportErrors } from "@/lib/services/admin-stats";
import { formatNumber, formatRelative, humanise } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin overview | Cymru Intelligence" };
export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await requireAdmin();

  const [
    userCount,
    subscriptionCount,
    companyCount,
    welshCompanyCount,
    noticeCount,
    planningCount,
    fundingCount,
    recentRuns,
    recentErrors,
    sources,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.subscription.count({ where: { status: { in: ["ACTIVE", "TRIALING"] } } }),
    prisma.company.count(),
    prisma.company.count({ where: { isWelsh: true } }),
    prisma.procurementNotice.count(),
    prisma.planningApplication.count(),
    prisma.fundingOpportunity.count(),
    prisma.dataImportRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 10,
      include: { dataSource: { select: { name: true } } },
    }),
    countRecentImportErrors(24),
    prisma.dataSource.findMany({ select: { status: true } }),
  ]);

  const integrations = getIntegrationStatuses();

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="System overview"
        description="Live counts from the database and the state of every integration."
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Users" value={formatNumber(userCount)} href="/admin/users" />
        <Stat label="Active subscriptions" value={formatNumber(subscriptionCount)} href="/admin/subscriptions" />
        <Stat
          label="Companies"
          value={formatNumber(companyCount)}
          detail={`${formatNumber(welshCompanyCount)} Welsh`}
        />
        <Stat label="Procurement notices" value={formatNumber(noticeCount)} />
        <Stat label="Planning applications" value={formatNumber(planningCount)} />
        <Stat label="Funding opportunities" value={formatNumber(fundingCount)} />
        <Stat
          label="Connected sources"
          value={`${sources.filter((s) => s.status === "CONNECTED").length} / ${sources.length}`}
          href="/admin/sources"
        />
        <Stat
          label="Import errors (24h)"
          value={formatNumber(recentErrors)}
          href="/admin/errors"
          tone={recentErrors > 0 ? "warning" : undefined}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Integration status</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Integration</Th>
                <Th>Status</Th>
                <Th>Impact when unconfigured</Th>
              </tr>
            </thead>
            <tbody>
              {integrations.map((integration) => (
                <tr key={integration.key}>
                  <Td className="font-medium text-ink-900">{integration.label}</Td>
                  <Td>
                    {integration.configured ? (
                      <Badge tone="positive">Configured</Badge>
                    ) : (
                      <div>
                        <Badge tone="warning">Not configured</Badge>
                        <p className="mt-1 font-mono text-[11px] text-muted">
                          {integration.missingEnvVars.join(", ")}
                        </p>
                      </div>
                    )}
                  </Td>
                  <Td className="max-w-md text-xs text-muted">{integration.impact}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Recent import runs</CardTitle>
          <Link href="/admin/imports" className="text-sm font-semibold text-accent-green hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recentRuns.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted">
              No connector has run yet. Trigger one from Sources, or wait for the scheduled job.
            </p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Source</Th>
                  <Th>Status</Th>
                  <Th>Records</Th>
                  <Th>Started</Th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run) => (
                  <tr key={run.id}>
                    <Td>
                      <p className="font-medium text-ink-900">{run.dataSource.name}</p>
                      <p className="font-mono text-xs text-muted">{run.connectorKey}</p>
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          run.status === "SUCCESS"
                            ? "positive"
                            : run.status === "PARTIAL"
                              ? "warning"
                              : run.status === "FAILED"
                                ? "critical"
                                : "neutral"
                        }
                      >
                        {humanise(run.status)}
                      </Badge>
                    </Td>
                    <Td className="text-xs text-muted">
                      {run.recordsCreated} new · {run.recordsUpdated} updated ·{" "}
                      {run.recordsSkipped} unchanged · {run.recordsRejected} rejected
                    </Td>
                    <Td className="whitespace-nowrap text-muted">{formatRelative(run.startedAt)}</Td>
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

function Stat({
  label,
  value,
  detail,
  href,
  tone,
}: {
  label: string;
  value: string;
  detail?: string;
  href?: string;
  tone?: "warning";
}) {
  const content = (
    <Card className={tone === "warning" ? "border-amber-300" : undefined}>
      <CardContent className="p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
        <p className="mt-2 text-2xl font-bold tabular-nums text-ink-900">{value}</p>
        {detail && <p className="mt-1 text-xs text-muted">{detail}</p>}
      </CardContent>
    </Card>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
