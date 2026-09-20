import type { Metadata } from "next";
import Link from "next/link";

import { Badge, Card, CardContent, EmptyState } from "@/components/ui/primitives";
import { prisma } from "@/lib/db/prisma";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Insights | Cymru Intelligence",
  description:
    "Analysis of Welsh business activity, with every figure computed from the underlying records.",
};

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const insights = await prisma.insight.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      category: true,
      publishedAt: true,
      dataAsOf: true,
    },
  });

  return (
    <>
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Insights</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink-900">
          What the data shows
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Every figure in these pieces is computed from the records behind the platform at the
          moment of publication, and each one carries the query that produced it. Nothing is
          estimated, and nothing is typed in by hand.
        </p>
      </header>

      {insights.length === 0 ? (
        <EmptyState
          title="No insights published yet"
          description="Analysis appears here once there is enough ingested data to support it. We would rather publish nothing than publish a figure we cannot stand behind."
        />
      ) : (
        <div className="space-y-4">
          {insights.map((insight) => (
            <Card key={insight.id}>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{insight.category}</Badge>
                  <span className="text-xs text-muted">{formatDate(insight.publishedAt)}</span>
                </div>
                <h2 className="mt-2 text-lg font-bold text-ink-900">
                  <Link href={`/insights/${insight.slug}`} className="hover:text-accent-green">
                    {insight.title}
                  </Link>
                </h2>
                {insight.summary && (
                  <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted">
                    {insight.summary}
                  </p>
                )}
                <p className="mt-2 text-xs text-muted">
                  Figures as of {formatDate(insight.dataAsOf)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
