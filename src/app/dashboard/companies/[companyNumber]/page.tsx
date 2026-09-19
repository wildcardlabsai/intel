import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, RefreshCw } from "lucide-react";

import { SaveCompanyButton } from "@/app/dashboard/companies/[companyNumber]/save-button";
import { SourceBadge, SourceFooter } from "@/components/source-attribution";
import { Button } from "@/components/ui/button";
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
import { requireUser } from "@/lib/auth/session";
import { companiesHouseWebUrl } from "@/lib/sources/companies-house/client";
import { getCompanyProfile, isCompanySaved } from "@/lib/services/company-profile";
import { formatCurrency, formatDate, formatRelative, humanise } from "@/lib/utils";
import { WELSH_REGION_LABELS } from "@/lib/wales/local-authorities";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ companyNumber: string }>;
}): Promise<Metadata> {
  const { companyNumber } = await params;
  const profile = await getCompanyProfile(companyNumber);
  if (!profile) return { title: "Company not found | Cymru Intelligence" };
  return {
    title: `${profile.company.name} | Cymru Intelligence`,
    description: `Company intelligence for ${profile.company.name} (${profile.company.companyNumber}).`,
  };
}

export default async function CompanyProfilePage({
  params,
}: {
  params: Promise<{ companyNumber: string }>;
}) {
  const { companyNumber } = await params;
  const user = await requireUser(`/dashboard/companies/${companyNumber}`);
  const profile = await getCompanyProfile(companyNumber);

  if (!profile) notFound();

  const { company, timeline, procurementAwards, planningApplications, fundingAwards, relatedCompanies, jobs } =
    profile;
  const saved = await isCompanySaved(user.id, company.id);

  const activeOfficers = company.officers.filter((officer) => officer.isActive);
  const activePscs = company.pscs.filter((psc) => psc.isActive);

  return (
    <>
      <PageHeader
        eyebrow={company.localAuthority?.name ?? company.town ?? "Wales"}
        title={company.name}
        description={
          company.primarySector?.name ??
          (company.sicCodes.length > 0 ? `SIC ${company.sicCodes.join(", ")}` : undefined)
        }
        actions={
          <div className="flex items-center gap-2">
            <SaveCompanyButton companyId={company.id} initiallySaved={saved} />
            <Button asChild variant="outline" size="sm">
              <a href={companiesHouseWebUrl(company.companyNumber)} target="_blank" rel="noopener noreferrer">
                Companies House
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={company.status === "ACTIVE" ? "positive" : company.status === "DISSOLVED" ? "neutral" : "warning"}>
          {humanise(company.status)}
        </Badge>
        <Badge tone="neutral">{company.companyNumber}</Badge>
        {company.companyType && <Badge tone="neutral">{humanise(company.companyType)}</Badge>}
        {company.region && company.region !== "UNKNOWN" && (
          <Badge tone="info">{WELSH_REGION_LABELS[company.region]}</Badge>
        )}
        {company.hasCharges && <Badge tone="warning">Has charges</Badge>}
        {company.hasInsolvencyHistory && <Badge tone="critical">Insolvency history</Badge>}
      </div>

      {/* Welsh classification evidence — always shown, never implied. */}
      {company.welshEvidence && (
        <div className="rounded-xl border border-border bg-cream/60 p-4 text-xs leading-relaxed text-muted">
          <span className="font-semibold text-ink-900">Welsh classification: </span>
          {humanise(company.welshConfidence)} — {company.welshEvidence}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Timeline ------------------------------------------------------ */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">
                  No events recorded yet. Events appear as filings, contracts and applications are
                  ingested.
                </p>
              ) : (
                <ol className="relative space-y-5 border-l border-border pl-6">
                  {timeline.map((event) => (
                    <li key={event.id} className="relative">
                      <span className="absolute -left-[27px] top-1.5 h-2.5 w-2.5 rounded-full bg-green-900" />
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-semibold text-ink-900">{event.title}</p>
                        <time className="text-xs text-muted" dateTime={event.occurredAt.toISOString()}>
                          {formatDate(event.occurredAt)}
                        </time>
                      </div>
                      {event.description && (
                        <p className="mt-1 text-sm text-muted">{event.description}</p>
                      )}
                      <SourceBadge
                        source={event.source}
                        sourceUrl={event.sourceUrl}
                        className="mt-1.5"
                      />
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          {/* Procurement --------------------------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle>Public contracts ({procurementAwards.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {procurementAwards.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-muted">
                  No public contracts linked to this company. Contracts are matched from Sell2Wales
                  by company number where the publisher provides one.
                </p>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Contract</Th>
                      <Th>Buyer</Th>
                      <Th>Value</Th>
                      <Th>Awarded</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {procurementAwards.map((award) => (
                      <tr key={award.id}>
                        <Td>
                          <Link
                            href={`/dashboard/procurement/${award.notice.id}`}
                            className="font-semibold text-ink-900 hover:text-accent-green"
                          >
                            {award.notice.title}
                          </Link>
                          {award.supplier?.resolutionConfidence !== null &&
                            award.supplier?.resolutionConfidence !== undefined &&
                            award.supplier.resolutionConfidence < 0.9 && (
                              <p className="mt-0.5 text-xs text-amber-700">
                                Matched by name (confidence{" "}
                                {Math.round(award.supplier.resolutionConfidence * 100)}%)
                              </p>
                            )}
                        </Td>
                        <Td className="text-muted">{award.notice.buyer?.name ?? "—"}</Td>
                        <Td className="tabular-nums">
                          {formatCurrency(award.valueAmount?.toString() ?? null, award.valueCurrency)}
                        </Td>
                        <Td className="text-muted">{formatDate(award.awardedAt)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Planning ------------------------------------------------------ */}
          <Card>
            <CardHeader>
              <CardTitle>Planning activity ({planningApplications.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {planningApplications.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-muted">
                  No planning applications linked. Welsh planning data is published per authority;
                  only authorities with a configured feed are searchable.
                </p>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Reference</Th>
                      <Th>Site</Th>
                      <Th>Status</Th>
                      <Th>Submitted</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {planningApplications.map((application) => (
                      <tr key={application.id}>
                        <Td>
                          <Link
                            href={`/dashboard/planning/${application.id}`}
                            className="font-mono text-xs font-semibold text-ink-900 hover:text-accent-green"
                          >
                            {application.reference}
                          </Link>
                          <p className="mt-0.5 text-xs text-muted">{application.authority.name}</p>
                        </Td>
                        <Td className="text-muted">{application.siteAddress ?? "—"}</Td>
                        <Td>
                          <Badge tone="neutral">{humanise(application.status)}</Badge>
                        </Td>
                        <Td className="text-muted">{formatDate(application.submittedOn)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Filings ------------------------------------------------------- */}
          <Card>
            <CardHeader>
              <CardTitle>Filing history ({company._count.filings})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {company.filings.length === 0 ? (
                <div className="px-5 pb-5">
                  <p className="text-sm text-muted">
                    Filing history has not been synced for this company yet.
                  </p>
                  {company.detailSyncedAt === null && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                      <RefreshCw className="h-3 w-3" />
                      Queued for enrichment on the next scheduled run.
                    </p>
                  )}
                </div>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Date</Th>
                      <Th>Description</Th>
                      <Th className="hidden sm:table-cell">Category</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {company.filings.map((filing) => (
                      <tr key={filing.id}>
                        <Td className="whitespace-nowrap text-muted">{formatDate(filing.date)}</Td>
                        <Td>{filing.description ?? filing.type ?? "—"}</Td>
                        <Td className="hidden sm:table-cell text-muted">
                          {humanise(filing.category)}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar --------------------------------------------------------- */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Company details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Detail label="Company number" value={company.companyNumber} mono />
              <Detail label="Incorporated" value={formatDate(company.incorporatedOn)} />
              {company.dissolvedOn && <Detail label="Dissolved" value={formatDate(company.dissolvedOn)} />}
              <Detail label="Type" value={humanise(company.companyType)} />
              <Detail label="Jurisdiction" value={humanise(company.jurisdiction)} />
              {company.sizeBand && <Detail label="Accounts size" value={humanise(company.sizeBand)} />}
              <Detail label="Accounts next due" value={formatDate(company.accountsNextDue)} />
              <Detail
                label="Confirmation statement"
                value={formatDate(company.confirmationStatementNextDue)}
              />
              <SourceBadge
                source={company.source}
                sourceUrl={company.sourceUrl}
                lastUpdatedAt={company.lastUpdatedAt}
                lastSeenAt={company.lastSeenAt}
                className="border-t border-border pt-3"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Registered office</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted">
              {company.addresses.length === 0 ? (
                <p>No address recorded.</p>
              ) : (
                company.addresses.map((address) => (
                  <address key={address.id} className="not-italic leading-relaxed">
                    {[
                      address.premises,
                      address.addressLine1,
                      address.addressLine2,
                      address.locality,
                      address.regionText,
                      address.postcode,
                      address.country,
                    ]
                      .filter(Boolean)
                      .map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                  </address>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Officers ({activeOfficers.length} active)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {company.officers.length === 0 ? (
                <p className="text-muted">Not synced yet.</p>
              ) : (
                company.officers.slice(0, 10).map((officer) => (
                  <div key={officer.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink-900">{officer.name}</p>
                      <p className="text-xs text-muted">
                        {humanise(officer.role)} · appointed {formatDate(officer.appointedOn)}
                      </p>
                    </div>
                    {!officer.isActive && <Badge tone="neutral">Resigned</Badge>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {activePscs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Persons with significant control</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {activePscs.map((psc) => (
                  <div key={psc.id}>
                    <p className="font-medium text-ink-900">{psc.name}</p>
                    <p className="text-xs text-muted">
                      {psc.naturesOfControl.map((nature) => humanise(nature)).join(", ")}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {(relatedCompanies.linked.length > 0 || relatedCompanies.sharedOfficers.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Related companies</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {relatedCompanies.linked.map((related) => (
                  <Link
                    key={related.id}
                    href={`/dashboard/companies/${related.companyNumber}`}
                    className="block hover:text-accent-green"
                  >
                    <p className="font-medium text-ink-900">{related.name}</p>
                    <p className="text-xs text-muted">{humanise(related.relation)}</p>
                  </Link>
                ))}
                {relatedCompanies.sharedOfficers.map((related) => (
                  <Link
                    key={`officer-${related.id}`}
                    href={`/dashboard/companies/${related.companyNumber}`}
                    className="block hover:text-accent-green"
                  >
                    <p className="font-medium text-ink-900">{related.name}</p>
                    <p className="text-xs text-muted">Shares officer {related.officerName}</p>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {fundingAwards.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Funding received</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {fundingAwards.map((award) => (
                  <div key={award.id}>
                    <p className="font-medium text-ink-900">
                      {award.opportunity?.title ?? award.purpose ?? "Funding award"}
                    </p>
                    <p className="text-xs text-muted">
                      {formatCurrency(award.amount?.toString() ?? null, award.currency)} ·{" "}
                      {formatDate(award.awardedAt)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {jobs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent job postings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {jobs.map((job) => (
                  <div key={job.id}>
                    <p className="font-medium text-ink-900">{job.title}</p>
                    <p className="text-xs text-muted">
                      {job.locationText ?? "—"} · posted {formatRelative(job.postedAt)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <SourceFooter sources={profile.sourcesUsed} dataAsOf={company.lastSeenAt} />
    </>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-muted">{label}</span>
      <span className={`text-right font-medium text-ink-900 ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  );
}

