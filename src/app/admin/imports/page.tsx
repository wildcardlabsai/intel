import type { Metadata } from "next";

import { Pagination } from "@/components/dashboard/pagination";
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime, formatNumber, humanise } from "@/lib/utils";

export const metadata: Metadata = { title: "Import runs | Admin" };
export const dynamic = "force-dynamic";

const PER_PAGE = 30;

export default async function AdminImportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const [runs, total] = await Promise.all([
    prisma.dataImportRun.findMany({
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: {
        dataSource: { select: { name: true, key: true } },
        _count: { select: { errors: true } },
      },
    }),
    prisma.dataImportRun.count(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Import runs"
        description="Every connector execution, with its counters and resume cursor."
      />

      {runs.length === 0 ? (
        <EmptyState
          title="No import runs yet"
          description="Runs appear here once a connector has executed, whether from the schedule or triggered manually."
        />
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Source</Th>
                    <Th>Status</Th>
                    <Th>Records</Th>
                    <Th className="hidden lg:table-cell">Duration</Th>
                    <Th className="hidden md:table-cell">Started</Th>
                    <Th>Errors</Th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run) => (
                    <tr key={run.id}>
                      <Td>
                        <p className="font-medium text-ink-900">{run.dataSource.name}</p>
                        <p className="font-mono text-xs text-muted">{run.connectorKey}</p>
                        <p className="mt-0.5 text-xs text-muted">{humanise(run.trigger)}</p>
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
                        {run.error && (
                          <p className="mt-1 max-w-xs font-mono text-[11px] text-red-700">
                            {run.error.slice(0, 160)}
                          </p>
                        )}
                      </Td>
                      <Td className="text-xs text-muted">
                        <span className="block">{formatNumber(run.recordsFetched)} fetched</span>
                        <span className="block text-emerald-800">
                          {formatNumber(run.recordsCreated)} new
                        </span>
                        <span className="block">{formatNumber(run.recordsUpdated)} updated</span>
                        <span className="block">{formatNumber(run.recordsSkipped)} unchanged</span>
                      </Td>
                      <Td className="hidden lg:table-cell whitespace-nowrap text-muted">
                        {run.durationMs !== null ? `${(run.durationMs / 1000).toFixed(1)}s` : "—"}
                      </Td>
                      <Td className="hidden md:table-cell whitespace-nowrap text-muted">
                        {formatDateTime(run.startedAt)}
                      </Td>
                      <Td>
                        {run._count.errors > 0 ? (
                          <Badge tone="warning">{formatNumber(run._count.errors)}</Badge>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </CardContent>
          </Card>

          <Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil(total / PER_PAGE))}
            params={params}
          />
        </>
      )}
    </>
  );
}
