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
import { getDataQualityReport } from "@/lib/services/admin-stats";
import { formatNumber, formatRelative } from "@/lib/utils";

export const metadata: Metadata = { title: "Data quality | Admin" };
export const dynamic = "force-dynamic";

export default async function AdminQualityPage() {
  await requireAdmin();

  const [report, duplicateGroups, ambiguousSuppliers, staleSources] = await Promise.all([
    getDataQualityReport(),
    prisma.$queryRaw<Array<{ normalised_name: string; count: bigint; numbers: string[] }>>`
      SELECT normalised_name, COUNT(*)::bigint AS count,
             ARRAY_AGG(company_number ORDER BY company_number) AS numbers
      FROM companies
      WHERE is_welsh = true
      GROUP BY normalised_name
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT 25
    `,
    prisma.procurementSupplier.findMany({
      where: { resolvedCompanyId: null },
      orderBy: { lastSeenAt: "desc" },
      take: 25,
      select: { id: true, name: true, companyNumber: true, postcode: true, lastSeenAt: true },
    }),
    prisma.dataSource.findMany({
      where: { status: "CONNECTED" },
      select: { key: true, name: true, lastSuccessAt: true, updateFrequency: true },
      orderBy: { lastSuccessAt: "asc" },
    }),
  ]);

  const percentage = (value: number) =>
    report.totalCompanies > 0 ? `${Math.round((value / report.totalCompanies) * 100)}%` : "—";

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Data quality"
        description="Duplicates, gaps and unresolved links. Nothing here is hidden — bad data is only fixable once it is visible."
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric label="Companies" value={formatNumber(report.totalCompanies)} />
        <Metric
          label="Missing coordinates"
          value={formatNumber(report.missingLocation)}
          detail={percentage(report.missingLocation)}
          warn={report.missingLocation > 0}
        />
        <Metric
          label="Missing postcode"
          value={formatNumber(report.missingPostcode)}
          detail={percentage(report.missingPostcode)}
          warn={report.missingPostcode > 0}
        />
        <Metric
          label="Welsh status unknown"
          value={formatNumber(report.unknownWelshStatus)}
          warn={report.unknownWelshStatus > 0}
        />
        <Metric
          label="Duplicate name groups"
          value={formatNumber(report.duplicateNameGroups)}
          warn={report.duplicateNameGroups > 0}
        />
        <Metric
          label="Unresolved suppliers"
          value={formatNumber(report.unresolvedSuppliers)}
          warn={report.unresolvedSuppliers > 0}
        />
        <Metric
          label="Unresolved applicants"
          value={formatNumber(report.unresolvedPlanningApplicants)}
          warn={report.unresolvedPlanningApplicants > 0}
        />
        <Metric
          label="Low-confidence links"
          value={formatNumber(report.lowConfidenceLinks)}
          detail="below 0.8"
          warn={report.lowConfidenceLinks > 0}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Source freshness</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {staleSources.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted">No source has completed a sync yet.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Source</Th>
                  <Th>Last successful sync</Th>
                  <Th>Publisher cadence</Th>
                </tr>
              </thead>
              <tbody>
                {staleSources.map((source) => (
                  <tr key={source.key}>
                    <Td className="font-medium text-ink-900">{source.name}</Td>
                    <Td className="text-muted">{formatRelative(source.lastSuccessAt)}</Td>
                    <Td className="text-muted">{source.updateFrequency ?? "Not published"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Companies sharing a normalised name</CardTitle>
          <p className="mt-1 text-sm text-muted">
            These are not necessarily duplicates — distinct companies can share a name. They are
            listed so they can be checked, and merged only where genuinely the same entity.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {duplicateGroups.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted">No name collisions found.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Normalised name</Th>
                  <Th>Count</Th>
                  <Th>Company numbers</Th>
                </tr>
              </thead>
              <tbody>
                {duplicateGroups.map((group) => (
                  <tr key={group.normalised_name}>
                    <Td className="font-mono text-xs text-ink-900">{group.normalised_name}</Td>
                    <Td>
                      <Badge tone="warning">{Number(group.count)}</Badge>
                    </Td>
                    <Td className="font-mono text-xs text-muted">{group.numbers.join(", ")}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Unresolved procurement suppliers</CardTitle>
          <p className="mt-1 text-sm text-muted">
            Suppliers that could not be matched to a company in the register, either because the
            publisher gave no company number or because the match was ambiguous.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {ambiguousSuppliers.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted">Every supplier has been resolved.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Supplier</Th>
                  <Th>Company number given</Th>
                  <Th>Postcode</Th>
                  <Th>Last seen</Th>
                </tr>
              </thead>
              <tbody>
                {ambiguousSuppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <Td className="font-medium text-ink-900">{supplier.name}</Td>
                    <Td className="font-mono text-xs text-muted">
                      {supplier.companyNumber ?? "none"}
                    </Td>
                    <Td className="text-muted">{supplier.postcode ?? "—"}</Td>
                    <Td className="whitespace-nowrap text-muted">
                      {formatRelative(supplier.lastSeenAt)}
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

function Metric({
  label,
  value,
  detail,
  warn,
}: {
  label: string;
  value: string;
  detail?: string;
  warn?: boolean;
}) {
  return (
    <Card className={warn ? "border-amber-300" : undefined}>
      <CardContent className="p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
        <p className="mt-2 text-2xl font-bold tabular-nums text-ink-900">{value}</p>
        {detail && <p className="mt-1 text-xs text-muted">{detail}</p>}
      </CardContent>
    </Card>
  );
}
