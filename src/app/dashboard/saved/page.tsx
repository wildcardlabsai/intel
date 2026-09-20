import type { Metadata } from "next";
import Link from "next/link";
import { Bookmark, SlidersHorizontal } from "lucide-react";

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";
import { SavedSearchList, type SavedSearchItem } from "@/app/dashboard/saved/saved-search-list";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import { getEntitlements } from "@/lib/billing/plans";
import { prisma } from "@/lib/db/prisma";
import {
  describeSavedSearch,
  isSaveableEntityType,
  type SaveableEntityType,
} from "@/lib/search/saved-search";
import { formatDate, formatRelative, humanise } from "@/lib/utils";

export const metadata: Metadata = { title: "Saved items | Cymru Intelligence" };
export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const user = await requireUser("/dashboard/saved");

  const [saved, entitlements, savedSearchRecords] = await Promise.all([
    prisma.savedCompany.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        company: {
          select: {
            id: true,
            companyNumber: true,
            name: true,
            status: true,
            town: true,
            lastUpdatedAt: true,
            localAuthority: { select: { name: true } },
          },
        },
      },
    }),
    getEntitlements(user),
    prisma.savedSearch.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  // Saved searches for entity types the product no longer offers a search page
  // for are hidden rather than rendered as dead links.
  const savedSearches: SavedSearchItem[] = savedSearchRecords
    .filter((record) => isSaveableEntityType(record.entityType))
    .map((record) => {
      const filters = (record.filters ?? {}) as Record<string, unknown>;
      return {
        id: record.id,
        name: record.name,
        entityType: record.entityType as SaveableEntityType,
        query: record.query,
        filters,
        description: describeSavedSearch(record.query, filters),
        updatedAt: record.updatedAt.toISOString(),
      };
    });

  // Changes to saved companies since the user followed them — this is what
  // makes following useful rather than just a bookmark list.
  const companyIds = saved.map((entry) => entry.companyId);
  const recentEvents = companyIds.length
    ? await prisma.companyEvent.findMany({
        where: { companyId: { in: companyIds } },
        orderBy: { occurredAt: "desc" },
        take: 15,
        include: { company: { select: { name: true, companyNumber: true } } },
      })
    : [];

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Your workspace"
        description="Companies you follow and searches you have saved. New filings, contracts and planning activity for followed companies appear below."
        actions={
          <Badge tone="neutral">
            {saved.length}
            {entitlements.limits.savedCompanies !== -1
              ? ` / ${entitlements.limits.savedCompanies}`
              : ""}{" "}
            companies
          </Badge>
        }
      />

      {saved.length === 0 ? (
        <EmptyState
          icon={<Bookmark className="h-8 w-8" strokeWidth={1.5} />}
          title="No saved companies yet"
          description="Open a company profile and choose Save to follow it. You will see new filings, contracts and planning activity for it here."
          action={
            <Button asChild variant="outline">
              <Link href="/dashboard/companies">Search companies</Link>
            </Button>
          }
        />
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Company</Th>
                    <Th className="hidden sm:table-cell">Location</Th>
                    <Th>Status</Th>
                    <Th className="hidden md:table-cell">Saved</Th>
                  </tr>
                </thead>
                <tbody>
                  {saved.map((entry) => (
                    <tr key={entry.id} className="hover:bg-cream/60">
                      <Td>
                        <Link
                          href={`/dashboard/companies/${entry.company.companyNumber}`}
                          className="font-semibold text-ink-900 hover:text-accent-green"
                        >
                          {entry.company.name}
                        </Link>
                        <p className="mt-0.5 font-mono text-xs text-muted">
                          {entry.company.companyNumber}
                        </p>
                      </Td>
                      <Td className="hidden sm:table-cell text-muted">
                        {entry.company.localAuthority?.name ?? entry.company.town ?? "—"}
                      </Td>
                      <Td>
                        <Badge
                          tone={entry.company.status === "ACTIVE" ? "positive" : "neutral"}
                        >
                          {humanise(entry.company.status)}
                        </Badge>
                      </Td>
                      <Td className="hidden md:table-cell whitespace-nowrap text-muted">
                        {formatDate(entry.createdAt)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h2 className="text-base font-bold text-ink-900">Activity on saved companies</h2>
              {recentEvents.length === 0 ? (
                <p className="mt-3 text-sm text-muted">
                  No recorded activity yet. Events appear as filings, contracts and applications are
                  ingested for the companies you follow.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-border/60">
                  {recentEvents.map((event) => (
                    <li key={event.id} className="py-3 first:pt-0 last:pb-0">
                      <Link
                        href={`/dashboard/companies/${event.company.companyNumber}`}
                        className="group flex items-start justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink-900 group-hover:text-accent-green">
                            {event.title}
                          </p>
                          <p className="mt-0.5 text-xs text-muted">{event.company.name}</p>
                        </div>
                        <span className="shrink-0 text-xs text-muted">
                          {formatRelative(event.occurredAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>Saved searches</CardTitle>
          <Badge tone="neutral">
            {savedSearches.length}
            {entitlements.limits.savedSearches !== -1
              ? ` / ${entitlements.limits.savedSearches}`
              : ""}{" "}
            saved
          </Badge>
        </CardHeader>
        <CardContent>
          {savedSearches.length === 0 ? (
            <EmptyState
              icon={<SlidersHorizontal className="h-8 w-8" strokeWidth={1.5} />}
              title="No saved searches yet"
              description="Run a search on any dataset, then choose “Save this search” to keep those filters. You can re-run a saved search at any time, or turn it into a daily alert."
            />
          ) : (
            <SavedSearchList items={savedSearches} />
          )}
        </CardContent>
      </Card>
    </>
  );
}
