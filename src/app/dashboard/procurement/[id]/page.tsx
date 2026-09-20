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
  Table,
  Td,
  Th,
} from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/session";
import { getProcurementNotice } from "@/lib/search/procurement";
import { formatCurrency, formatDate, humanise } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const result = await getProcurementNotice(id);
  return {
    title: result ? `${result.notice.title} | Cymru Intelligence` : "Contract not found",
  };
}

export default async function ProcurementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser(`/dashboard/procurement/${id}`);

  const result = await getProcurementNotice(id);
  if (!result) notFound();

  const { notice, buyerHistory, supplierHistory } = result;
  const awardTotal = notice.awards.reduce(
    (total, award) => total + Number(award.valueAmount ?? 0),
    0
  );

  return (
    <>
      <PageHeader
        eyebrow={notice.buyer?.name ?? "Public contract"}
        title={notice.title}
        actions={
          notice.sourceUrl ? (
            <a
              href={notice.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-green hover:underline"
            >
              View notice at source
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge
          tone={
            notice.status === "ACTIVE" ? "positive" : notice.status === "AWARDED" ? "info" : "neutral"
          }
        >
          {humanise(notice.status)}
        </Badge>
        <Badge tone="neutral">{humanise(notice.type)}</Badge>
        {notice.localAuthority && <Badge tone="neutral">{notice.localAuthority.name}</Badge>}
        <Badge tone="neutral">OCID {notice.ocid}</Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {notice.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted">
                  {notice.description}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Awards ({notice.awards.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {notice.awards.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-muted">
                  No award has been published for this notice yet.
                </p>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Supplier</Th>
                      <Th>Value</Th>
                      <Th>Awarded</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {notice.awards.map((award) => (
                      <tr key={award.id}>
                        <Td>
                          {award.supplier?.resolvedCompany ? (
                            <Link
                              href={`/dashboard/companies/${award.supplier.resolvedCompany.companyNumber}`}
                              className="font-semibold text-ink-900 hover:text-accent-green"
                            >
                              {award.supplier.name}
                            </Link>
                          ) : (
                            <span className="font-semibold text-ink-900">
                              {award.supplier?.name ?? "Not named"}
                            </span>
                          )}
                          {award.supplier && !award.supplier.resolvedCompany && (
                            <p className="mt-0.5 text-xs text-muted">
                              Not matched to a registered company
                              {award.supplier.companyNumber
                                ? ` (number ${award.supplier.companyNumber} not yet ingested)`
                                : " — the publisher gave no company number"}
                            </p>
                          )}
                          {award.supplier?.isSme && (
                            <Badge tone="neutral" className="mt-1">
                              SME
                            </Badge>
                          )}
                        </Td>
                        <Td className="whitespace-nowrap tabular-nums">
                          {formatCurrency(award.valueAmount?.toString() ?? null, award.valueCurrency)}
                        </Td>
                        <Td className="whitespace-nowrap text-muted">{formatDate(award.awardedAt)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </CardContent>
          </Card>

          {notice.documents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {notice.documents.map((document) => (
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
                      {document.publishedAt && (
                        <span className="text-xs text-muted">
                          Published {formatDate(document.publishedAt)}
                        </span>
                      )}
                    </span>
                    <ExternalLink className="h-4 w-4 shrink-0 text-muted" />
                  </a>
                ))}
              </CardContent>
            </Card>
          )}

          {buyerHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Other contracts from this buyer</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <thead>
                    <tr>
                      <Th>Contract</Th>
                      <Th>Value</Th>
                      <Th>Published</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {buyerHistory.map((entry) => (
                      <tr key={entry.id}>
                        <Td>
                          <Link
                            href={`/dashboard/procurement/${entry.id}`}
                            className="text-ink-900 hover:text-accent-green"
                          >
                            {entry.title}
                          </Link>
                        </Td>
                        <Td className="whitespace-nowrap tabular-nums">
                          {formatCurrency(entry.valueAmount?.toString() ?? null, entry.valueCurrency, {
                            compact: true,
                          })}
                        </Td>
                        <Td className="whitespace-nowrap text-muted">
                          {formatDate(entry.publishedAt)}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </CardContent>
            </Card>
          )}

          {supplierHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Other contracts won by this supplier</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <thead>
                    <tr>
                      <Th>Contract</Th>
                      <Th>Buyer</Th>
                      <Th>Awarded</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierHistory.map((award) => (
                      <tr key={award.id}>
                        <Td>
                          <Link
                            href={`/dashboard/procurement/${award.notice.id}`}
                            className="text-ink-900 hover:text-accent-green"
                          >
                            {award.notice.title}
                          </Link>
                        </Td>
                        <Td className="text-muted">{award.notice.buyer?.name ?? "—"}</Td>
                        <Td className="whitespace-nowrap text-muted">{formatDate(award.awardedAt)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contract details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Detail
                label="Value"
                value={formatCurrency(notice.valueAmount?.toString() ?? null, notice.valueCurrency)}
              />
              {awardTotal > 0 && notice.awards.length > 1 && (
                <Detail
                  label="Awarded total"
                  value={formatCurrency(awardTotal, notice.valueCurrency)}
                />
              )}
              <Detail label="Published" value={formatDate(notice.publishedAt)} />
              <Detail label="Deadline" value={formatDate(notice.deadlineAt)} />
              <Detail label="Contract start" value={formatDate(notice.contractStartAt)} />
              <Detail label="Contract end" value={formatDate(notice.contractEndAt)} />
              <Detail label="Procedure" value={humanise(notice.procurementMethod)} />
              <Detail label="Location" value={notice.deliveryLocality ?? "—"} />
              <SourceBadge
                source={notice.source}
                sourceUrl={notice.sourceUrl}
                lastUpdatedAt={notice.lastUpdatedAt}
                lastSeenAt={notice.lastSeenAt}
                className="border-t border-border pt-3"
              />
            </CardContent>
          </Card>

          {notice.buyer && (
            <Card>
              <CardHeader>
                <CardTitle>Buyer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-medium text-ink-900">{notice.buyer.name}</p>
                {notice.buyer.addressLocality && (
                  <p className="text-muted">{notice.buyer.addressLocality}</p>
                )}
                {notice.buyer.resolvedCompany && (
                  <Link
                    href={`/dashboard/companies/${notice.buyer.resolvedCompany.companyNumber}`}
                    className="text-accent-green hover:underline"
                  >
                    View company profile
                  </Link>
                )}
              </CardContent>
            </Card>
          )}

          {notice.cpvCodes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>CPV classifications</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                {notice.cpvCodes.map((code) => (
                  <Link key={code} href={`/dashboard/procurement?cpv=${code}`}>
                    <Badge tone="neutral">{code}</Badge>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <SourceFooter sources={[notice.source]} dataAsOf={notice.lastSeenAt} />
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
