import Link from "next/link";

import Reveal from "@/components/Reveal";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { formatDate } from "@/lib/utils";

/**
 * The "What's happening in Wales" section.
 *
 * The layout is exactly as designed. What changed is where the cards come
 * from: they are published insights read from the database, not hard-coded
 * headlines. A marketing page must not quote figures that were never computed
 * from anything — so when nothing has been published, the section says so
 * rather than showing invented examples.
 */

type Card = {
  slug: string;
  category: string;
  headline: string;
  date: string;
  image: string | null;
};

async function getCards(): Promise<Card[]> {
  try {
    const insights = await prisma.insight.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 3,
      select: {
        slug: true,
        title: true,
        category: true,
        publishedAt: true,
        heroImageUrl: true,
      },
    });

    return insights.map((insight) => ({
      slug: insight.slug,
      category: insight.category,
      headline: insight.title,
      date: formatDate(insight.publishedAt),
      image: insight.heroImageUrl,
    }));
  } catch (error) {
    // The marketing page must still render if the database is unreachable.
    logger.warn("could not load insights for the landing page", {
      message: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export default async function Insights() {
  const cards = await getCards();

  return (
    <section id="insights" className="bg-cream px-6 py-20 lg:px-12">
      <div className="mx-auto max-w-7xl space-y-10">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted">
              Latest insights
            </p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
              What&rsquo;s happening in Wales
            </h2>
          </div>
          <Link
            href="/insights"
            className="group inline-flex items-center gap-2 text-sm font-semibold text-ink-900 transition-colors hover:text-accent-green"
          >
            <span>View all insights</span>
            <span className="transform transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </Reveal>

        {cards.length === 0 ? (
          <Reveal>
            <div className="rounded-xl border border-border bg-card p-8">
              <p className="max-w-2xl text-sm leading-relaxed text-muted">
                Nothing is published yet. Analysis appears here once enough public records have
                been ingested to support it, and every figure we publish is computed from those
                records and carries the query behind it. We would rather show you nothing than a
                number we cannot stand behind.
              </p>
            </div>
          </Reveal>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-3">
            {cards.map(({ slug, image, category, headline, date }, i) => (
              <Reveal key={slug} delay={i * 100}>
                <Link
                  href={`/insights/${slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-lg"
                >
                  <div className="relative h-48 overflow-hidden bg-green-900/5">
                    {image ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={image}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div
                        aria-hidden
                        className="flex h-full w-full items-center justify-center bg-green-900/5 text-4xl font-bold text-green-900/15"
                      >
                        CI
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-between space-y-4 p-6">
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                        {category}
                      </span>
                      <h3 className="text-base font-bold leading-snug text-ink-900 transition-colors group-hover:text-accent-green sm:text-lg">
                        {headline}
                      </h3>
                    </div>
                    <div className="pt-2 text-xs text-muted">{date}</div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
