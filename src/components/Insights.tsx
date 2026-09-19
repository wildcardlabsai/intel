import Reveal from "@/components/Reveal";

const INSIGHTS = [
  {
    image: "https://images.unsplash.com/photo-1541888946425-d0fbb186a5b3?q=80&w=800&auto=format&fit=crop",
    alt: "Welsh construction crane",
    category: "Development",
    headline: "£42m of new construction projects identified across South Wales",
    date: "19 Sep 2026",
  },
  {
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=800&auto=format&fit=crop",
    alt: "Modern commercial building",
    category: "Business",
    headline: "The 25 fastest-growing companies in Wales",
    date: "15 Sep 2026",
  },
  {
    image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=800&auto=format&fit=crop",
    alt: "Welsh valley landscape",
    category: "Investment",
    headline: "Where are Wales' next major industrial developments?",
    date: "12 Sep 2026",
  },
];

export default function Insights() {
  return (
    <section id="insights" className="bg-cream px-6 py-20 lg:px-12">
      <div className="mx-auto max-w-7xl space-y-10">
        <Reveal className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-muted">
              Latest insights
            </span>
            <h2 className="mt-1 text-3xl font-bold tracking-tight text-ink-900 sm:text-4xl">
              What&rsquo;s happening in Wales
            </h2>
          </div>
          <a
            href="#insights"
            className="group inline-flex items-center gap-2 text-sm font-semibold text-ink-900 transition-colors hover:text-accent-green"
          >
            <span>View all insights</span>
            <span className="transform transition-transform group-hover:translate-x-1">→</span>
          </a>
        </Reveal>

        <div className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-3">
          {INSIGHTS.map(({ image, alt, category, headline, date }, i) => (
            <Reveal key={headline} delay={i * 100}>
              <article className="group flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-lg">
                <div className="relative h-48 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image}
                    alt={alt}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
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
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
