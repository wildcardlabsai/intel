import Reveal from "@/components/Reveal";
import WalesMap from "@/components/WalesMap";

const CATEGORIES = [
  { label: "Businesses", d: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V11m0 0V7m0 4h4m-4 0H9m4-4H9m4 0V3m-4 4V3" },
  {
    label: "Planning",
    paths: [
      "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z",
      "M15 11a3 3 0 11-6 0 3 3 0 016 0z",
    ],
  },
  { label: "Contracts", d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { label: "Funding", d: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { label: "Jobs", d: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5 5 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
  { label: "Economic data", d: "M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" },
  { label: "Infrastructure", d: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
  { label: "Interactive map", d: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" },
];

export default function DataOverview() {
  return (
    <section id="data" className="bg-cream px-6 py-20 lg:px-12">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-12 lg:grid-cols-12 lg:gap-16">
        <Reveal className="space-y-8 lg:col-span-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-muted">
              The bigger picture
            </span>
            <h2 className="mt-2 text-3xl font-bold leading-tight tracking-tight text-ink-900 sm:text-4xl">
              Connect the dots
              <br />
              across the Welsh economy
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
              Cymru Intelligence brings together trusted public data to give
              you a clearer view of the opportunities, people and projects
              shaping Wales.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6 pt-4 sm:grid-cols-4">
            {CATEGORIES.map((cat) => (
              <div
                key={cat.label}
                className="flex cursor-default flex-col items-center rounded-lg p-3 text-center transition-colors hover:bg-white/60"
              >
                <div className="mb-2 flex h-12 w-12 items-center justify-center text-ink-900">
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {cat.paths ? (
                      cat.paths.map((d) => (
                        <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={d} />
                      ))
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={cat.d} />
                    )}
                  </svg>
                </div>
                <span className="text-xs font-semibold text-ink-900 sm:text-sm">{cat.label}</span>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <a
              href="#data"
              className="group inline-flex items-center gap-2 text-sm font-bold text-ink-900 transition-colors hover:text-accent-green"
            >
              <span>Explore our data sources</span>
              <span className="transform transition-transform group-hover:translate-x-1">→</span>
            </a>
          </div>
        </Reveal>

        <Reveal delay={120} className="lg:col-span-6">
          <WalesMap />
        </Reveal>
      </div>
    </section>
  );
}
