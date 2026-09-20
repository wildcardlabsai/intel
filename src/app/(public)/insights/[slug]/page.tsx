import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge, Card, CardContent } from "@/components/ui/primitives";
import { prisma } from "@/lib/db/prisma";
import { renderMarkdown } from "@/lib/insights/markdown";
import { parseStoredMetrics, renderTemplate } from "@/lib/insights/template";
import { formatDateTime, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const insight = await prisma.insight.findUnique({
    where: { slug },
    select: { title: true, summary: true, status: true },
  });

  if (!insight || insight.status !== "PUBLISHED") {
    return { title: "Insight not found | Cymru Intelligence" };
  }

  return {
    title: `${insight.title} | Cymru Intelligence`,
    description: insight.summary ?? undefined,
  };
}

/**
 * A published insight.
 *
 * Figures are substituted from the values computed at publication, and every
 * one of them is listed at the foot of the page with the query behind it. A
 * reader can therefore check any number in the text against a stated query and
 * a stated moment in time.
 */
export default async function InsightPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const insight = await prisma.insight.findUnique({
    where: { slug },
    include: { author: { select: { name: true } } },
  });

  if (!insight || insight.status !== "PUBLISHED") notFound();

  const metrics = parseStoredMetrics(insight.metrics);
  const body = renderMarkdown(renderTemplate(insight.bodyMarkdown ?? "", metrics));

  return (
    <article>
      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{insight.category}</Badge>
          <span className="text-xs text-muted">{formatDate(insight.publishedAt)}</span>
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-900">{insight.title}</h1>
        {insight.summary && (
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">{insight.summary}</p>
        )}
        <p className="mt-3 text-xs text-muted">
          {insight.author?.name ? `By ${insight.author.name} · ` : ""}
          Figures computed {formatDateTime(insight.dataAsOf)}
        </p>
      </header>

      <div
        className="max-w-2xl text-sm text-muted"
        // Safe by construction: the body is HTML-escaped before a fixed subset
        // of Markdown is reintroduced, so author text can never become a tag.
        dangerouslySetInnerHTML={{ __html: body }}
      />

      {metrics.length > 0 && (
        <Card className="mt-10">
          <CardContent className="p-5">
            <h2 className="text-base font-bold text-ink-900">Where these figures come from</h2>
            <p className="mt-1 text-sm text-muted">
              Each figure above was computed by the query beside it, at the time shown. No number
              in this piece was written by hand.
            </p>
            <dl className="mt-4 space-y-4">
              {metrics.map((metric) => (
                <div key={metric.key} className="border-l-2 border-border pl-3">
                  <dt className="text-sm font-semibold text-ink-900">
                    {metric.label}: {metric.formatted}
                  </dt>
                  <dd className="mt-0.5 text-xs leading-relaxed text-muted">
                    {metric.query}
                    <br />
                    Computed {formatDateTime(new Date(metric.computedAt))}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      {insight.sourcesUsed.length > 0 && (
        <p className="mt-6 text-xs leading-relaxed text-muted">
          Drawn from data published by {insight.sourcesUsed.join(", ")}. Contains public sector
          information licensed under the Open Government Licence v3.0. Cymru Intelligence is an
          independent service and is not affiliated with or endorsed by any of these bodies.
        </p>
      )}

      <p className="mt-8">
        <Link href="/insights" className="text-sm font-semibold text-accent-green hover:underline">
          ← All insights
        </Link>
      </p>
    </article>
  );
}
