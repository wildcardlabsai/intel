import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";

import { Pagination } from "@/components/dashboard/pagination";
import { SearchFilterBar } from "@/components/dashboard/search-filter-bar";
import { SourceFooter } from "@/components/source-attribution";
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
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { paginationSchema, planningFilterSchema } from "@/lib/search/types";
import { formatDate, formatNumber, humanise } from "@/lib/utils";

export const metadata: Metadata = { title: "Planning | Cymru Intelligence" };
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireUser("/dashboard/planning");
  const params = await searchParams;

  const filters = planningFilterSchema.parse({
    q: params.q,
    status: Array.isArray(params.status) ? params.status : params.status ? [params.status] : undefined,
    authoritySlug: params.authority,
    localAuthority: params.localAuthority,
    postcode: params.postcode,
    sort: params.sort ?? "newest",
  });
  const pagination = paginationSchema.parse({ page: params.page, perPage: params.perPage });

  const [authorities, total] = await Promise.all([
    prisma.planningAuthority.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, status: true, statusMessage: true, portalUrl: true },
    }),
    prisma.planningApplication.count(),
  ]);

  const connected = authorities.filter((authority) => authority.status === "CONNECTED");

  const where = {
    ...(filters.q
      ? {
          OR: [
            { description: { contains: filters.q, mode: "insensitive" as const } },
            { siteAddress: { contains: filters.q, mode: "insensitive" as const } },
            { reference: { contains: filters.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(filters.status?.length ? { status: { in: filters.status as never[] } } : {}),
    ...(filters.authoritySlug ? { authority: { slug: filters.authoritySlug } } : {}),
    ...(filters.postcode
      ? { postcode: { startsWith: filters.postcode.toUpperCase().replace(/\s+/g, "") } }
      : {}),
  };

  const [applications, matching] =
    total > 0
      ? await Promise.all([
          prisma.planningApplication.findMany({
            where,
            orderBy:
              filters.sort === "oldest" ? { submittedOn: "asc" } : { submittedOn: "desc" },
            skip: (pagination.page - 1) * pagination.perPage,
            take: pagination.perPage,
            include: {
              authority: { select: { name: true } },
              resolvedCompany: { select: { companyNumber: true, name: true } },
            },
          }),
          prisma.planningApplication.count({ where }),
        ])
      : [[], 0];

  const totalPages = Math.max(1, Math.ceil(matching / pagination.perPage));

  return (
    <>
      <PageHeader
        eyebrow="Planning"
        title="Planning applications"
        description="Applications from Welsh planning authorities that publish a structured feed."
      />

      {/* The connected/total count is shown first and always, because planning
          coverage in Wales is genuinely partial and users must know that. */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Coverage</CardTitle>
            <p className="mt-1 text-sm text-muted">
              {connected.length} of {authorities.length} Welsh planning authorities are connected.
            </p>
          </div>
          <Badge tone={connected.length === 0 ? "warning" : "info"}>
            {connected.length} / {authorities.length}
          </Badge>
        </CardHeader>
        <CardContent>
          {connected.length === 0 ? (
            <p className="text-sm leading-relaxed text-muted">
              No Welsh planning authority has a structured feed configured yet. Wales has no single
              planning API — each of the {authorities.length} authorities publishes independently, and
              each must be enabled individually once a feed has been identified and its licence
              confirmed. Until then no planning data is shown for them, and none is invented.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {authorities.map((authority) => (
                <Badge
                  key={authority.id}
                  tone={authority.status === "CONNECTED" ? "positive" : "neutral"}
                >
                  {authority.name}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {total === 0 ? (
        <EmptyState
          icon={<MapPin className="h-8 w-8" strokeWidth={1.5} />}
          title="No planning applications ingested"
          description="Applications appear here once at least one authority has a configured feed and has completed a sync."
        />
      ) : (
        <>
          <SearchFilterBar
            basePath="/dashboard/planning"
            saveEntityType="PLANNING"
            searchPlaceholder="Reference, address or description"
            current={{ q: filters.q ?? "", sort: filters.sort }}
            selects={[
              {
                name: "authority",
                label: "Authority",
                value: filters.authoritySlug ?? "",
                options: [
                  { value: "", label: "All authorities" },
                  ...connected.map((authority) => ({
                    value: authority.slug,
                    label: authority.name,
                  })),
                ],
              },
              {
                name: "status",
                label: "Status",
                value: filters.status?.[0] ?? "",
                options: [
                  { value: "", label: "Any status" },
                  { value: "PENDING", label: "Pending" },
                  { value: "APPROVED", label: "Approved" },
                  { value: "REFUSED", label: "Refused" },
                  { value: "WITHDRAWN", label: "Withdrawn" },
                ],
              },
            ]}
            sortOptions={[
              { value: "newest", label: "Newest first" },
              { value: "oldest", label: "Oldest first" },
            ]}
          />

          <p className="text-sm text-muted">
            <span className="font-semibold text-ink-900">{formatNumber(matching)}</span>{" "}
            {matching === 1 ? "application" : "applications"}
          </p>

          {applications.length === 0 ? (
            <EmptyState
              title="No applications match those filters"
              description="Try a broader search or a different authority."
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <thead>
                    <tr>
                      <Th>Reference</Th>
                      <Th>Site</Th>
                      <Th className="hidden md:table-cell">Applicant</Th>
                      <Th>Status</Th>
                      <Th className="hidden sm:table-cell">Submitted</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((application) => (
                      <tr key={application.id} className="hover:bg-cream/60">
                        <Td>
                          <Link
                            href={`/dashboard/planning/${application.id}`}
                            className="font-mono text-xs font-semibold text-ink-900 hover:text-accent-green"
                          >
                            {application.reference}
                          </Link>
                          <p className="mt-0.5 text-xs text-muted">{application.authority.name}</p>
                        </Td>
                        <Td>
                          <p className="text-ink-900">{application.siteAddress ?? "—"}</p>
                          {application.description && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                              {application.description}
                            </p>
                          )}
                        </Td>
                        <Td className="hidden md:table-cell text-muted">
                          {application.resolvedCompany ? (
                            <Link
                              href={`/dashboard/companies/${application.resolvedCompany.companyNumber}`}
                              className="hover:text-accent-green"
                            >
                              {application.resolvedCompany.name}
                            </Link>
                          ) : (
                            (application.applicantName ?? "—")
                          )}
                        </Td>
                        <Td>
                          <Badge tone="neutral">{humanise(application.status)}</Badge>
                        </Td>
                        <Td className="hidden sm:table-cell whitespace-nowrap text-muted">
                          {formatDate(application.submittedOn)}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Pagination page={pagination.page} totalPages={totalPages} params={params} />
        </>
      )}

      <SourceFooter sources={connected.length > 0 ? ["planning_wales"] : []} />
    </>
  );
}
