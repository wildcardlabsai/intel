import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";

import { AskBox } from "@/app/dashboard/companies/ask-box";
import { CompanyFiltersPanel } from "@/app/dashboard/companies/filters";
import { SaveSearchButton } from "@/components/dashboard/save-search-button";
import { AwaitingSync, NotConfigured, SourceFooter } from "@/components/source-attribution";
import { Button } from "@/components/ui/button";
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
import { companyFilterSchema, paginationSchema } from "@/lib/search/types";
import { searchCompanies } from "@/lib/search/companies";
import { formatDate, formatNumber, humanise } from "@/lib/utils";
import { WELSH_REGION_LABELS } from "@/lib/wales/local-authorities";

export const metadata: Metadata = { title: "Company search | Cymru Intelligence" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function asArray(value: string | string[] | undefined): string[] | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value : [value];
}

export default async function CompanySearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser("/dashboard/companies");
  const params = await searchParams;

  const filters = companyFilterSchema.parse({
    q: params.q,
    status: asArray(params.status),
    sicCodes: asArray(params.sicCodes),
    sectorSlug: params.sectorSlug,
    region: params.region,
    localAuthority: params.localAuthority,
    postcode: params.postcode,
    town: params.town,
    incorporatedFrom: params.incorporatedFrom,
    incorporatedTo: params.incorporatedTo,
    sizeBand: asArray(params.sizeBand),
    welshOnly: params.welshOnly ?? true,
    sort: params.sort ?? "relevance",
  });

  const pagination = paginationSchema.parse({ page: params.page, perPage: params.perPage });

  const companiesHouse = getIntegrationStatuses().find((s) => s.key === "companies_house");
  const totalCompanies = await prisma.company.count();

  // Metered: a search only counts against the plan when a query was actually run.
  const hasSearch = Boolean(filters.q || filters.region || filters.localAuthority || filters.sicCodes?.length);
  const usage = hasSearch ? await checkUsage(user, "SEARCH") : null;

  if (usage && !usage.allowed) {
    return (
      <>
        <PageHeader eyebrow="Companies" title="Company search" />
        <EmptyState
          title="Monthly search limit reached"
          description={usage.reason ?? "Upgrade your plan to continue searching."}
          action={
            <Button asChild>
              <Link href="/dashboard/billing">View plans</Link>
            </Button>
          }
        />
      </>
    );
  }

  const results = await searchCompanies(filters, pagination);

  if (hasSearch) {
    await recordUsage(user, "SEARCH", { entity: "company", query: filters.q ?? null });
  }

  const localAuthorities = await prisma.localAuthority.findMany({
    select: { name: true, slug: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader
        eyebrow="Companies"
        title="Company search"
        description="Every company registered at Companies House with an address in Wales, classified from address evidence."
      />

      {!companiesHouse?.configured && totalCompanies === 0 ? (
        <NotConfigured
          title="Companies House is not connected"
          integration="company data"
          missingEnvVars={companiesHouse?.missingEnvVars ?? []}
          impact={companiesHouse?.impact ?? "No company records can be ingested."}
          docsUrl={companiesHouse?.docsUrl}
        />
      ) : totalCompanies === 0 ? (
        <AwaitingSync what="companies" sourceName="Companies House" />
      ) : (
        <>
        <AskBox
          examples={[
            "Active construction firms in Gwynedd",
            "Companies in Cardiff registered since 2022",
            "Dissolved manufacturers in North Wales",
          ]}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          <CompanyFiltersPanel
            localAuthorities={localAuthorities}
            regions={Object.entries(WELSH_REGION_LABELS)
              .filter(([value]) => value !== "UNKNOWN")
              .map(([value, label]) => ({ value, label }))}
            current={{
              q: filters.q ?? "",
              region: filters.region ?? "",
              localAuthority: filters.localAuthority ?? "",
              status: filters.status ?? [],
              postcode: filters.postcode ?? "",
              sort: filters.sort,
            }}
          />

          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm text-muted">
                <span className="font-semibold text-ink-900">{formatNumber(results.total)}</span>{" "}
                {results.total === 1 ? "company" : "companies"}
                {results.query && (
                  <>
                    {" "}
                    matching <span className="font-semibold text-ink-900">“{results.query}”</span>
                  </>
                )}
              </p>
              <div className="flex items-center gap-3">
                <SaveSearchButton entityType="COMPANY" defaultName={filters.q ?? ""} />
                <p className="text-xs text-muted">Search took {results.tookMs}ms</p>
              </div>
            </div>

            {results.items.length === 0 ? (
              <EmptyState
                icon={<Search className="h-8 w-8" strokeWidth={1.5} />}
                title="No companies match those filters"
                description="Try a broader location, remove a filter, or search a different term. Results are only ever drawn from ingested records."
              />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <thead>
                      <tr>
                        <Th>Company</Th>
                        <Th className="hidden sm:table-cell">Location</Th>
                        <Th className="hidden md:table-cell">Incorporated</Th>
                        <Th>Status</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.items.map((company) => (
                        <tr key={company.id} className="hover:bg-cream/60">
                          <Td>
                            <Link
                              href={`/dashboard/companies/${company.companyNumber}`}
                              className="font-semibold text-ink-900 hover:text-accent-green"
                            >
                              {company.name}
                            </Link>
                            <p className="mt-0.5 font-mono text-xs text-muted">
                              {company.companyNumber}
                            </p>
                          </Td>
                          <Td className="hidden sm:table-cell text-muted">
                            {company.town ?? "—"}
                            {company.localAuthorityName && (
                              <p className="text-xs">{company.localAuthorityName}</p>
                            )}
                          </Td>
                          <Td className="hidden md:table-cell text-muted">
                            {formatDate(company.incorporatedOn)}
                          </Td>
                          <Td>
                            <Badge
                              tone={
                                company.status === "ACTIVE"
                                  ? "positive"
                                  : company.status === "DISSOLVED"
                                    ? "neutral"
                                    : "warning"
                              }
                            >
                              {humanise(company.status)}
                            </Badge>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {results.totalPages > 1 && (
              <Pagination
                page={results.page}
                totalPages={results.totalPages}
                params={params}
              />
            )}
          </div>
        </div>
        </>
      )}

      <SourceFooter sources={["companies_house", "postcodes_io"]} />
    </>
  );
}

function Pagination({
  page,
  totalPages,
  params,
}: {
  page: number;
  totalPages: number;
  params: SearchParams;
}) {
  const buildHref = (target: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key === "page" || value === undefined) continue;
      if (Array.isArray(value)) value.forEach((v) => next.append(key, v));
      else next.set(key, value);
    }
    next.set("page", String(target));
    return `?${next.toString()}`;
  };

  return (
    <nav className="flex items-center justify-between" aria-label="Pagination">
      <Button asChild variant="outline" size="sm" disabled={page <= 1}>
        <Link href={buildHref(Math.max(1, page - 1))} aria-disabled={page <= 1}>
          Previous
        </Link>
      </Button>
      <span className="text-sm text-muted">
        Page {page} of {totalPages}
      </span>
      <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
        <Link href={buildHref(Math.min(totalPages, page + 1))} aria-disabled={page >= totalPages}>
          Next
        </Link>
      </Button>
    </nav>
  );
}


