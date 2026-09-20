import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { SourceBadge, SourceFooter } from "@/components/source-attribution";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
} from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatDate, humanise } from "@/lib/utils";

export const metadata: Metadata = { title: "Planning application | Cymru Intelligence" };
export const dynamic = "force-dynamic";

export default async function PlanningDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser(`/dashboard/planning/${id}`);

  const application = await prisma.planningApplication.findUnique({
    where: { id },
    include: {
      authority: { select: { name: true, portalUrl: true } },
      localAuthority: { select: { name: true } },
      resolvedCompany: { select: { companyNumber: true, name: true } },
      documents: { orderBy: { publishedOn: "desc" } },
    },
  });

  if (!application) notFound();

  return (
    <>
      <PageHeader
        eyebrow={application.authority.name}
        title={application.reference}
        description={application.siteAddress ?? undefined}
        actions={
          application.sourceUrl ? (
            <a
              href={application.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-green hover:underline"
            >
              View on the planning portal
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{humanise(application.status)}</Badge>
        {application.category !== "UNKNOWN" && (
          <Badge tone="neutral">{humanise(application.category)}</Badge>
        )}
        {application.applicationType && (
          <Badge tone="neutral">{application.applicationType}</Badge>
        )}
        {application.localAuthority && (
          <Badge tone="info">{application.localAuthority.name}</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {application.description && (
            <Card>
              <CardHeader>
                <CardTitle>Proposal</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted">
                  {application.description}
                </p>
              </CardContent>
            </Card>
          )}

          {application.documents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {application.documents.map((document) => (
                  <a
                    key={document.id}
                    href={document.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm hover:bg-cream"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink-900">
                        {document.title ?? document.documentType ?? "Document"}
                      </span>
                      {document.publishedOn && (
                        <span className="text-xs text-muted">
                          {formatDate(document.publishedOn)}
                        </span>
                      )}
                    </span>
                    <ExternalLink className="h-4 w-4 shrink-0 text-muted" />
                  </a>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Application details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Detail label="Reference" value={application.reference} />
              <Detail label="Authority" value={application.authority.name} />
              <Detail label="Submitted" value={formatDate(application.submittedOn)} />
              <Detail label="Validated" value={formatDate(application.validatedOn)} />
              <Detail label="Decided" value={formatDate(application.decidedOn)} />
              <Detail label="Decision" value={application.decision ?? "—"} />
              <Detail label="Postcode" value={application.postcode ?? "—"} />
              {application.dwellingCount !== null && (
                <Detail label="Dwellings" value={String(application.dwellingCount)} />
              )}
              <SourceBadge
                source={application.source}
                sourceUrl={application.sourceUrl}
                lastUpdatedAt={application.lastUpdatedAt}
                lastSeenAt={application.lastSeenAt}
                className="border-t border-border pt-3"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Applicant</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {application.resolvedCompany ? (
                <>
                  <Link
                    href={`/dashboard/companies/${application.resolvedCompany.companyNumber}`}
                    className="font-medium text-ink-900 hover:text-accent-green"
                  >
                    {application.resolvedCompany.name}
                  </Link>
                  {application.resolutionConfidence !== null &&
                    application.resolutionConfidence < 0.9 && (
                      <p className="text-xs text-amber-700">
                        Matched by name (confidence{" "}
                        {Math.round(application.resolutionConfidence * 100)}%)
                      </p>
                    )}
                </>
              ) : (
                <>
                  <p className="text-ink-900">{application.applicantName ?? "Not published"}</p>
                  {application.applicantName && (
                    <p className="text-xs text-muted">
                      Not matched to a company in the register.
                    </p>
                  )}
                </>
              )}
              {application.agentName && (
                <p className="border-t border-border pt-2 text-xs text-muted">
                  Agent: {application.agentName}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <SourceFooter sources={[application.source]} dataAsOf={application.lastSeenAt} />
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="text-right font-medium text-ink-900">{value}</span>
    </div>
  );
}
