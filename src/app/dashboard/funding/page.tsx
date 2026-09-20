import type { Metadata } from "next";
import { Coins, ExternalLink } from "lucide-react";

import { Pagination } from "@/components/dashboard/pagination";
import { SearchFilterBar } from "@/components/dashboard/search-filter-bar";
import { SourceBadge, SourceFooter } from "@/components/source-attribution";
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
import { fundingFilterSchema, paginationSchema } from "@/lib/search/types";
import { formatCurrency, formatDate, formatNumber, humanise } from "@/lib/utils";

export const metadata: Metadata = { title: "Funding | Cymru Intelligence" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function FundingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireUser("/dashboard/funding");
  const params = await searchParams;

  const filters = fundingFilterSchema.parse({
    q: params.q,
    status: Array.isArray(params.status) ? params.status : params.status ? [params.status] : undefined,
    minAmount: params.minAmount,
    sort: params.sort ?? "newest",
  });
  const pagination = paginationSchema.parse({ page: params.page, perPage: params.perPage });

  const [source, total] = await Promise.all([
    prisma.dataSource.findUnique({ where: { key: "funding_wales" } }),
    prisma.fundingOpportunity.count(),
  ]);

  const where = {
    ...(filters.q
      ? {
          OR: [
            { title: { contains: filters.q, mode: "insensitive" as const } },
            { summary: { contains: filters.q, mode: "insensitive" as const } },
            { description: { contains: filters.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(filters.status?.length ? { status: { in: filters.status as never[] } } : {}),
    ...(filters.minAmount !== undefined ? { amountMax: { gte: filters.minAmount } } : {}),
  };

  const [opportunities, matching] =
    total > 0
      ? await Promise.all([
          prisma.fundingOpportunity.findMany({
            where,
            orderBy: filters.sort === "oldest" ? { closesAt: "asc" } : { closesAt: "desc" },
            skip: (pagination.page - 1) * pagination.perPage,
            take: pagination.perPage,
          }),
          prisma.fundingOpportunity.count({ where }),
        ])
      : [[], 0];

  const totalPages = Math.max(1, Math.ceil(matching / pagination.perPage));

  return (
    <>
      <PageHeader
        eyebrow="Funding"
        title="Funding opportunities"
        description="Grant, loan and support schemes open to Welsh businesses."
      />

      {total === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No funders connected yet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted">
            <Badge tone="warning">Unavailable</Badge>
            <p>
              {source?.statusMessage ??
                "Each funder is enabled individually once a structured feed has been identified and its terms permit automated access."}
            </p>
            <p>
              Funders are never scraped from HTML in breach of their terms, and no funding scheme is
              ever invented to fill this page. Once a funder is connected, its schemes appear here
              with a link back to the original listing.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <SearchFilterBar
            basePath="/dashboard/funding"
            saveEntityType="FUNDING"
            searchPlaceholder="Scheme name or purpose"
            current={{ q: filters.q ?? "", sort: filters.sort }}
            selects={[
              {
                name: "status",
                label: "Status",
                value: filters.status?.[0] ?? "",
                options: [
                  { value: "", label: "Any status" },
                  { value: "OPEN", label: "Open" },
                  { value: "CLOSING_SOON", label: "Closing soon" },
                  { value: "UPCOMING", label: "Upcoming" },
                  { value: "CLOSED", label: "Closed" },
                ],
              },
              {
                name: "minAmount",
                label: "Minimum award",
                value: params.minAmount?.toString() ?? "",
                options: [
                  { value: "", label: "Any amount" },
                  { value: "10000", label: "£10,000+" },
                  { value: "50000", label: "£50,000+" },
                  { value: "250000", label: "£250,000+" },
                ],
              },
            ]}
            sortOptions={[
              { value: "newest", label: "Closing latest" },
              { value: "oldest", label: "Closing soonest" },
            ]}
          />

          <p className="text-sm text-muted">
            <span className="font-semibold text-ink-900">{formatNumber(matching)}</span>{" "}
            {matching === 1 ? "scheme" : "schemes"}
          </p>

          {opportunities.length === 0 ? (
            <EmptyState
              icon={<Coins className="h-8 w-8" strokeWidth={1.5} />}
              title="No schemes match those filters"
              description="Try a broader amount range or clear the status filter."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {opportunities.map((opportunity) => (
                <Card key={opportunity.id}>
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-base font-bold text-ink-900">{opportunity.title}</h3>
                      <Badge
                        tone={
                          opportunity.status === "OPEN"
                            ? "positive"
                            : opportunity.status === "CLOSING_SOON"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {humanise(opportunity.status)}
                      </Badge>
                    </div>

                    {opportunity.organisationName && (
                      <p className="text-sm text-muted">{opportunity.organisationName}</p>
                    )}

                    {opportunity.summary && (
                      <p className="line-clamp-3 text-sm leading-relaxed text-muted">
                        {opportunity.summary}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                      {(opportunity.amountMin || opportunity.amountMax) && (
                        <span className="text-ink-900">
                          {formatCurrency(opportunity.amountMin?.toString() ?? null, opportunity.currency)}
                          {opportunity.amountMax
                            ? ` – ${formatCurrency(opportunity.amountMax.toString(), opportunity.currency)}`
                            : ""}
                        </span>
                      )}
                      {opportunity.closesAt && (
                        <span className="text-muted">Closes {formatDate(opportunity.closesAt)}</span>
                      )}
                    </div>

                    {opportunity.applicationUrl && (
                      <a
                        href={opportunity.applicationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-green hover:underline"
                      >
                        Apply at source
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}

                    <SourceBadge
                      source={opportunity.source}
                      sourceUrl={opportunity.sourceUrl}
                      lastSeenAt={opportunity.lastCheckedAt ?? opportunity.lastSeenAt}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Pagination page={pagination.page} totalPages={totalPages} params={params} />
        </>
      )}

      <SourceFooter sources={total > 0 ? ["funding_wales"] : []} />
    </>
  );
}
