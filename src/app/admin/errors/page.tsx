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
import { formatDateTime, humanise } from "@/lib/utils";

export const metadata: Metadata = { title: "Import errors | Admin" };
export const dynamic = "force-dynamic";

const PER_PAGE = 40;

export default async function AdminErrorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const stage = typeof params.stage === "string" ? params.stage : undefined;

  const where = stage ? { stage: stage as never } : {};

  const [errors, total, byStage] = await Promise.all([
    prisma.dataImportError.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: {
        run: { select: { connectorKey: true, dataSource: { select: { name: true } } } },
      },
    }),
    prisma.dataImportError.count({ where }),
    prisma.dataImportError.groupBy({ by: ["stage"], _count: true }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Import errors"
        description="Per-record failures. A rejected record never aborts a run — it is recorded here and the run continues."
      />

      {byStage.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {byStage.map((entry) => (
            <Badge key={entry.stage} tone="warning">
              {humanise(entry.stage)}: {entry._count}
            </Badge>
          ))}
        </div>
      )}

      {errors.length === 0 ? (
        <EmptyState
          title="No import errors"
          description="Nothing has been rejected during ingestion. Records that fail validation or storage would be listed here with the stage that rejected them."
        />
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Source</Th>
                    <Th>Stage</Th>
                    <Th>Record</Th>
                    <Th>Message</Th>
                    <Th className="hidden md:table-cell">When</Th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((error) => (
                    <tr key={error.id}>
                      <Td>
                        <p className="font-medium text-ink-900">{error.run.dataSource.name}</p>
                        <p className="font-mono text-xs text-muted">{error.run.connectorKey}</p>
                      </Td>
                      <Td>
                        <Badge tone="neutral">{humanise(error.stage)}</Badge>
                      </Td>
                      <Td className="font-mono text-xs text-muted">
                        {error.sourceRecordId ?? "—"}
                      </Td>
                      <Td className="max-w-md text-xs text-red-900">{error.message}</Td>
                      <Td className="hidden md:table-cell whitespace-nowrap text-muted">
                        {formatDateTime(error.createdAt)}
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
