import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";

import { AwaitingSync, NotConfigured, SourceFooter } from "@/components/source-attribution";
import { SearchFilterBar } from "@/components/dashboard/search-filter-bar";
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
import { requireUser } from "@/lib/auth/session";
import { checkUsage, recordUsage } from "@/lib/billing/plans";
import { prisma } from "@/lib/db/prisma";
import { getIntegrationStatuses } from "@/lib/env";
import { searchProcurement } from "@/lib/search/procurement";
import { paginationSchema, procurementFilterSchema } from "@/lib/search/types";
import { formatCurrency, formatDate, formatNumber, humanise } from "@/lib/utils";

export const metadata: Metadata = { title: "Procurement | Cymru Intelligence" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function asArray(value: string | string[] | undefined): string[] | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value : [value];
}

export default async function ProcurementPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser("/dashboard/procurement");
  const params = await searchParams;

  const filters = procurementFilterSchema.parse({
    q: params.q,
    status: asArray(params.status),
    type: asArray(params.type),
    minValue: params.minValue,
    maxValue: params.maxValue,
    cpvPrefix: params.cpv,
    localAuthority: params.localAuthority,
    publishedFrom: params.publishedFrom,
    publishedTo: params.publishedTo,
    sort: params.sort ?? "newest",
  });

  const pagination = paginationSchema.parse({ page: params.page, perPage: params.perPage });

  const sell2wales = getIntegrationStatuses().find((s) => s.key === "sell2wales");
  const total = await prisma.procurementNotice.count();

  const hasSearch = Boolean(filters.q || filters.status?.length || filters.minValue);
  const usage = hasSearch ? await checkUsage(user, "SEARCH") : null;

  if (usage && !usage.allowed) {
    return (
      <>
        <PageHeader eyebrow="Procurement" title="Public contracts" />
        <EmptyState
          title="Monthly search limit reached"
          description={usage.reason ?? "Upgrade your plan to continue searching."}
        />
      </>
    );
  }

  const results = total > 0 ? await searchProcurement(filters, pagination) : null;
  if (hasSearch) await recordUsage(user, "SEARCH", { entity: "procurement", query: filters.q ?? null });

  const localAuthorities = await prisma.localAuthority.findMany({
    select: { name: true, slug: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader
        eyebrow="Procurement"
        title="Public contracts"
        description="Tender notices and awards published by Welsh public sector buyers."
      />

      {!sell2wales?.configured && total === 0 ? (
        <NotConfigured
          title="Sell2Wales is not connected"
          integration="procurement data"
          missingEnvVars={sell2wales?.missingEnvVars ?? []}
          impact={sell2wales?.impact ?? "No procurement notices can be ingested."}
          docsUrl={sell2wales?.docsUrl}
        />
      ) : total === 0 ? (
        <AwaitingSync what="contract notices" sourceName="Sell2Wales" />
      ) : (
        results && (
          <>
            <SearchFilterBar
              basePath="/dashboard/procurement"
            saveEntityType="PROCUREMENT"
              searchPlaceholder="Contract title, description or CPV"
              current={{ q: filters.q ?? "", sort: filters.sort }}
              selects={[
                {
                  name: "status",
                  label: "Status",
                  value: filters.status?.[0] ?? "",
                  options: [
                    { value: "", label: "Any status" },
                    { value: "ACTIVE", label: "Open" },
                    { value: "AWARDED", label: "Awarded" },
                    { value: "CLOSED", label: "Closed" },
                    { value: "CANCELLED", label: "Cancelled" },
                  ],
                },
                {
                  name: "localAuthority",
                  label: "Local authority",
                  value: filters.localAuthority ?? "",
                  options: [
                    { value: "", label: "All authorities" },
                    ...localAuthorities.map((la) => ({ value: la.slug, label: la.name })),
                  ],
                },
                {
                  name: "minValue",
                  label: "Minimum value",
                  value: params.minValue?.toString() ?? "",
                  options: [
                    { value: "", label: "Any value" },
                    { value: "25000", label: "£25,000+" },
                    { value: "100000", label: "£100,000+" },
                    { value: "500000", label: "£500,000+" },
                    { value: "1000000", label: "£1m+" },
                  ],
                },
              ]}
              sortOptions={[
                { value: "newest", label: "Newest first" },
                { value: "value_desc", label: "Highest value" },
                { value: "value_asc", label: "Lowest value" },
                { value: "relevance", label: "Most relevant" },
              ]}
            />

            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm text-muted">
                <span className="font-semibold text-ink-900">{formatNumber(results.total)}</span>{" "}
                {results.total === 1 ? "notice" : "notices"}
              </p>
              <p className="text-xs text-muted">Search took {results.tookMs}ms</p>
            </div>

            {results.items.length === 0 ? (
              <EmptyState
                icon={<FileText className="h-8 w-8" strokeWidth={1.5} />}
                title="No contracts match those filters"
                description="Try a broader value range or remove a filter. Results only ever come from ingested notices."
              />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <thead>
                      <tr>
                        <Th>Contract</Th>
                        <Th className="hidden md:table-cell">Buyer</Th>
                        <Th>Value</Th>
                        <Th className="hidden sm:table-cell">Published</Th>
                        <Th>Status</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.items.map((notice) => (
                        <tr key={notice.id} className="hover:bg-cream/60">
                          <Td>
                            <Link
                              href={`/dashboard/procurement/${notice.id}`}
                              className="font-semibold text-ink-900 hover:text-accent-green"
                            >
                              {notice.title}
                            </Link>
                            <p className="mt-0.5 text-xs text-muted">
                              {humanise(notice.type)}
                              {notice.deliveryLocality ? ` · ${notice.deliveryLocality}` : ""}
                            </p>
                            {notice.supplierNames.length > 0 && (
                              <p className="mt-0.5 text-xs text-accent-green">
                                Awarded to {notice.supplierNames.join(", ")}
                              </p>
                            )}
                          </Td>
                          <Td className="hidden md:table-cell text-muted">
                            {notice.buyerName ?? "—"}
                          </Td>
                          <Td className="whitespace-nowrap tabular-nums">
                            {formatCurrency(notice.valueAmount, notice.valueCurrency, {
                              compact: true,
                            })}
                          </Td>
                          <Td className="hidden sm:table-cell whitespace-nowrap text-muted">
                            {formatDate(notice.publishedAt)}
                          </Td>
                          <Td>
                            <Badge
                              tone={
                                notice.status === "ACTIVE"
                                  ? "positive"
                                  : notice.status === "AWARDED"
                                    ? "info"
                                    : "neutral"
                              }
                            >
                              {humanise(notice.status)}
                            </Badge>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </CardContent>
              </Card>
            )}

            <Pagination page={results.page} totalPages={results.totalPages} params={params} />
          </>
        )
      )}

      <SourceFooter sources={["sell2wales"]} />
    </>
  );
}
