import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, CircleSlash, PauseCircle, XCircle } from "lucide-react";

import { RunConnectorButton } from "@/app/admin/sources/run-button";
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
import type { DataSourceStatus } from "@/generated/prisma/enums";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getIntegrationStatuses } from "@/lib/env";
import { getConnectorsForSource } from "@/lib/ingestion/connectors";
import { formatNumber, formatRelative, humanise } from "@/lib/utils";

export const metadata: Metadata = { title: "Data sources | Admin" };
export const dynamic = "force-dynamic";

const STATUS_PRESENTATION: Record<
  DataSourceStatus,
  { tone: "positive" | "warning" | "critical" | "neutral"; icon: typeof CheckCircle2; label: string }
> = {
  CONNECTED: { tone: "positive", icon: CheckCircle2, label: "Connected" },
  NOT_CONFIGURED: { tone: "warning", icon: AlertTriangle, label: "Not configured" },
  UNAVAILABLE: { tone: "neutral", icon: CircleSlash, label: "Unavailable" },
  DISABLED: { tone: "neutral", icon: PauseCircle, label: "Disabled" },
  ERROR: { tone: "critical", icon: XCircle, label: "Error" },
};

export default async function AdminSourcesPage() {
  await requireAdmin();

  const [sources, planningAuthorities, integrations] = await Promise.all([
    prisma.dataSource.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { importRuns: true } },
        importRuns: {
          orderBy: { startedAt: "desc" },
          take: 1,
          select: {
            status: true,
            startedAt: true,
            recordsCreated: true,
            recordsUpdated: true,
            recordsRejected: true,
          },
        },
      },
    }),
    prisma.planningAuthority.findMany({ orderBy: { name: "asc" } }),
    Promise.resolve(getIntegrationStatuses()),
  ]);

  const connectedPlanning = planningAuthorities.filter((a) => a.status === "CONNECTED").length;

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Data sources"
        description="Every dataset this platform can ingest, its licence, and whether it is genuinely connected. Sources with no usable structured feed are shown as unavailable rather than hidden."
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Connected</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-ink-900">
              {sources.filter((s) => s.status === "CONNECTED").length}
              <span className="text-lg text-muted"> / {sources.length}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">
              Planning authorities
            </p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-ink-900">
              {connectedPlanning}
              <span className="text-lg text-muted"> / {planningAuthorities.length}</span>
            </p>
            <p className="mt-1 text-xs text-muted">with a configured feed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Records ingested</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-ink-900">
              {formatNumber(sources.reduce((total, source) => total + source.totalRecords, 0))}
            </p>
          </CardContent>
        </Card>
      </section>

      <div className="space-y-4">
        {sources.map((source) => {
          const presentation = STATUS_PRESENTATION[source.status];
          const Icon = presentation.icon;
          const lastRun = source.importRuns[0];
          const connectors = getConnectorsForSource(source.key);

          return (
            <Card key={source.id}>
              <CardHeader className="flex-row items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>{source.name}</CardTitle>
                    <Badge tone={presentation.tone}>
                      <Icon className="h-3 w-3" />
                      {presentation.label}
                    </Badge>
                    <Badge tone="neutral">{humanise(source.category)}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted">{source.organisation}</p>
                  {source.description && (
                    <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">
                      {source.description}
                    </p>
                  )}
                  {source.statusMessage && (
                    <p className="mt-2 max-w-3xl rounded-md bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                      {source.statusMessage}
                    </p>
                  )}
                  {source.lastError && source.status === "ERROR" && (
                    <p className="mt-2 max-w-3xl rounded-md bg-red-50 p-3 font-mono text-xs leading-relaxed text-red-900">
                      {source.lastError}
                    </p>
                  )}
                </div>

                {connectors.length > 0 && (
                  <div className="flex shrink-0 flex-col gap-2">
                    {connectors.map((connector) => (
                      <RunConnectorButton
                        key={connector.key}
                        connectorKey={connector.key}
                        label={connectors.length > 1 ? connector.label : "Run sync"}
                        disabled={source.status === "NOT_CONFIGURED" || source.status === "DISABLED"}
                      />
                    ))}
                  </div>
                )}
              </CardHeader>

              <CardContent className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
                <Field label="Last successful sync" value={formatRelative(source.lastSuccessAt)} />
                <Field
                  label="Publisher update frequency"
                  value={source.updateFrequency ?? "Not published"}
                />
                <Field label="Our schedule" value={source.schedule ?? "Manual only"} />
                <Field label="Records" value={formatNumber(source.totalRecords)} />
                <Field label="Licence" value={source.licence ?? "Not stated"} />
                <Field label="Import runs" value={formatNumber(source._count.importRuns)} />
                {lastRun && (
                  <>
                    <Field
                      label="Last run"
                      value={`${humanise(lastRun.status)} · ${formatRelative(lastRun.startedAt)}`}
                    />
                    <Field
                      label="Last run records"
                      value={`${lastRun.recordsCreated} new, ${lastRun.recordsUpdated} updated, ${lastRun.recordsRejected} rejected`}
                    />
                  </>
                )}
                {source.requiredEnvVars.length > 0 && (
                  <div className="col-span-2 sm:col-span-4">
                    <p className="font-semibold uppercase tracking-wider text-muted">
                      Required environment variables
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {source.requiredEnvVars.map((name) => {
                        const configured = integrations.every(
                          (integration) => !integration.missingEnvVars.includes(name)
                        );
                        return (
                          <code
                            key={name}
                            className={`rounded px-2 py-1 font-mono text-[11px] ${
                              configured ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"
                            }`}
                          >
                            {name}
                            {configured ? " ✓" : " — missing"}
                          </code>
                        );
                      })}
                    </div>
                  </div>
                )}
                {source.usageRestrictions && (
                  <div className="col-span-2 sm:col-span-4">
                    <p className="font-semibold uppercase tracking-wider text-muted">
                      Usage restrictions
                    </p>
                    <p className="mt-1 leading-relaxed text-muted">{source.usageRestrictions}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Planning authorities ({connectedPlanning} of {planningAuthorities.length} connected)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Authority</Th>
                <Th>Status</Th>
                <Th>Connector</Th>
                <Th>Notes</Th>
              </tr>
            </thead>
            <tbody>
              {planningAuthorities.map((authority) => {
                const presentation = STATUS_PRESENTATION[authority.status];
                return (
                  <tr key={authority.id}>
                    <Td className="font-medium text-ink-900">{authority.name}</Td>
                    <Td>
                      <Badge tone={presentation.tone}>{presentation.label}</Badge>
                    </Td>
                    <Td className="text-muted">{authority.connectorKey ?? "—"}</Td>
                    <Td className="max-w-md text-xs text-muted">{authority.statusMessage}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-0.5 text-ink-900">{value}</p>
    </div>
  );
}
