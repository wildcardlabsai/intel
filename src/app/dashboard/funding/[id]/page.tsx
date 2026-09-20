import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { SourceBadge, SourceFooter } from "@/components/source-attribution";
import { Button } from "@/components/ui/button";
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
import { formatCurrency, formatDate, humanise } from "@/lib/utils";

export const metadata: Metadata = { title: "Funding opportunity | Cymru Intelligence" };
export const dynamic = "force-dynamic";

export default async function FundingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser(`/dashboard/funding/${id}`);

  const opportunity = await prisma.fundingOpportunity.findUnique({
    where: { id },
    include: { organisation: { select: { name: true, website: true } } },
  });

  if (!opportunity) notFound();

  return (
    <>
      <PageHeader
        eyebrow={opportunity.organisation?.name ?? opportunity.organisationName ?? "Funding"}
        title={opportunity.title}
        actions={
          opportunity.applicationUrl ? (
            <Button asChild>
              <a href={opportunity.applicationUrl} target="_blank" rel="noopener noreferrer">
                Apply at source
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
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
        {opportunity.type !== "UNKNOWN" && <Badge tone="neutral">{humanise(opportunity.type)}</Badge>}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {(opportunity.summary || opportunity.description) && (
            <Card>
              <CardHeader>
                <CardTitle>About this scheme</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-relaxed text-muted">
                {opportunity.summary && <p>{opportunity.summary}</p>}
                {opportunity.description && (
                  <p className="whitespace-pre-line">{opportunity.description}</p>
                )}
              </CardContent>
            </Card>
          )}

          {opportunity.eligibility && (
            <Card>
              <CardHeader>
                <CardTitle>Eligibility</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted">
                  {opportunity.eligibility}
                </p>
                <p className="mt-3 text-xs text-muted">
                  Eligibility is reproduced as published by the funder. Always confirm against the
                  original listing before applying.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Detail
                label="Award range"
                value={
                  opportunity.amountMin || opportunity.amountMax
                    ? `${formatCurrency(opportunity.amountMin?.toString() ?? null, opportunity.currency)}${
                        opportunity.amountMax
                          ? ` – ${formatCurrency(opportunity.amountMax.toString(), opportunity.currency)}`
                          : ""
                      }`
                    : "Not published"
                }
              />
              <Detail label="Opens" value={formatDate(opportunity.opensAt)} />
              <Detail label="Closes" value={formatDate(opportunity.closesAt)} />
              <Detail
                label="Funder"
                value={opportunity.organisation?.name ?? opportunity.organisationName ?? "—"}
              />
              {opportunity.sectors.length > 0 && (
                <Detail label="Sectors" value={opportunity.sectors.join(", ")} />
              )}
              {opportunity.locations.length > 0 && (
                <Detail label="Locations" value={opportunity.locations.join(", ")} />
              )}
              <SourceBadge
                source={opportunity.source}
                sourceUrl={opportunity.sourceUrl}
                lastUpdatedAt={opportunity.lastUpdatedAt}
                lastSeenAt={opportunity.lastCheckedAt ?? opportunity.lastSeenAt}
                className="border-t border-border pt-3"
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <SourceFooter
        sources={[opportunity.source]}
        dataAsOf={opportunity.lastCheckedAt ?? opportunity.lastSeenAt}
      />
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
