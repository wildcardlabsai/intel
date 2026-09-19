import { ArrowRight } from "lucide-react";
import Reveal from "@/components/Reveal";
import {
  CommercialBuildingScene,
  ConstructionScene,
  InfrastructureScene,
} from "@/components/InsightImages";

const INSIGHTS = [
  {
    Scene: ConstructionScene,
    category: "Development",
    headline: "£42m of new construction projects identified across South Wales",
    date: "19 Sep 2026",
  },
  {
    Scene: CommercialBuildingScene,
    category: "Business",
    headline: "The 25 fastest-growing companies in Wales",
    date: "15 Sep 2026",
  },
  {
    Scene: InfrastructureScene,
    category: "Investment",
    headline: "Where are Wales' next major industrial developments?",
    date: "12 Sep 2026",
  },
];

export default function Insights() {
  return (
    <section id="insights" className="bg-cream py-20 sm:py-28">
      <div className="mx-auto max-w-[1400px] px-6 sm:px-10">
        <Reveal>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                Latest insights
              </p>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
                What&apos;s happening in Wales
              </h2>
            </div>
            <a
              href="#insights"
              className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900 transition-colors hover:text-green-800"
            >
              View all insights
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {INSIGHTS.map(({ Scene, category, headline, date }, i) => (
            <Reveal key={headline} delay={i * 100}>
              <article className="group cursor-pointer">
                <div className="overflow-hidden rounded-xl">
                  <Scene className="h-56 w-full transition-transform duration-500 group-hover:scale-105" />
                </div>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                  {category}
                </p>
                <h3 className="mt-2 text-lg font-bold leading-snug text-ink-900 transition-colors group-hover:text-green-800">
                  {headline}
                </h3>
                <p className="mt-3 text-sm text-muted">{date}</p>
              </article>
            </Reveal>
          ))}
        </div>

        <p className="mt-10 text-xs text-muted">
          Illustrative content for preview purposes only &mdash; not live
          reporting.
        </p>
      </div>
    </section>
  );
}
