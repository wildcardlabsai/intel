import type { Metadata } from "next";
import Link from "next/link";

import { DatasetStatus } from "@/components/dashboard/dataset-placeholder";
import { SourceBadge } from "@/components/source-attribution";
import { Card, CardContent, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Jobs | Cymru Intelligence" };
export const dynamic = "force-dynamic";

export default async function JobsPage() {
  await requireUser("/dashboard/jobs");

  const total = await prisma.jobPosting.count();
  const jobs =
    total > 0
      ? await prisma.jobPosting.findMany({
          orderBy: { postedAt: "desc" },
          take: 50,
          include: {
            company: { select: { companyNumber: true, name: true } },
            localAuthority: { select: { name: true } },
          },
        })
      : [];

  return (
    <>
      <PageHeader
        eyebrow="Jobs"
        title="Job postings"
        description="Vacancies advertised by Welsh employers, linked to the companies behind them."
      />

      {total === 0 ? (
        <DatasetStatus sourceKey="funding_wales" what="job postings" />
      ) : (
        <>
          <p className="text-sm text-muted">
            <span className="font-semibold text-ink-900">{formatNumber(total)}</span> postings
          </p>
          <Card>
            <CardContent className="p-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Role</Th>
                    <Th>Employer</Th>
                    <Th className="hidden sm:table-cell">Location</Th>
                    <Th className="hidden md:table-cell">Salary</Th>
                    <Th className="hidden sm:table-cell">Posted</Th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id}>
                      <Td className="font-medium text-ink-900">{job.title}</Td>
                      <Td>
                        {job.company ? (
                          <Link
                            href={`/dashboard/companies/${job.company.companyNumber}`}
                            className="text-ink-900 hover:text-accent-green"
                          >
                            {job.company.name}
                          </Link>
                        ) : (
                          <span className="text-muted">{job.employerName}</span>
                        )}
                      </Td>
                      <Td className="hidden sm:table-cell text-muted">
                        {job.localAuthority?.name ?? job.locationText ?? "—"}
                      </Td>
                      <Td className="hidden md:table-cell whitespace-nowrap tabular-nums">
                        {job.salaryMin
                          ? formatCurrency(job.salaryMin.toString(), "GBP", { compact: true })
                          : "—"}
                      </Td>
                      <Td className="hidden sm:table-cell whitespace-nowrap text-muted">
                        {formatDate(job.postedAt)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </CardContent>
          </Card>
          {jobs[0] && <SourceBadge source={jobs[0].source} sourceUrl={jobs[0].sourceUrl} />}
        </>
      )}
    </>
  );
}
