import Reveal from "@/components/Reveal";
import RegisterButton from "@/components/RegisterButton";

const PANELS = [
  {
    title: "Find opportunities",
    body: "Identify new projects, contracts and funding.",
    d: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h4m-4 0V11m0 0V7m0 4h4m-4 0H9m4-4H9m4 0V3m-4 4V3",
  },
  {
    title: "Understand markets",
    body: "Track activity and trends across Wales.",
    d: "M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z",
  },
  {
    title: "Make informed decisions",
    body: "Access trusted data in one place.",
    d: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5 5 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  },
  {
    title: "Support a stronger Wales",
    body: "More insight. More progress.",
    d: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  },
];

export default function AudienceSection() {
  return (
    <section id="audience" className="bg-green-900 px-6 py-20 text-white lg:px-12">
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
        <Reveal className="space-y-6 lg:col-span-5">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-400/80">
            Built for Wales
          </span>
          <h2 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            For the people building a stronger tomorrow
          </h2>
          <p className="text-base leading-relaxed text-emerald-100/80 sm:text-lg">
            Whether you&rsquo;re a business, investor, developer or adviser,
            Cymru Intelligence helps you find the information you need,
            faster and in one place.
          </p>
          <div className="pt-4">
            <RegisterButton variant="cream" showArrow={false} />
          </div>
        </Reveal>

        <Reveal delay={120} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-7">
          {PANELS.map(({ title, body, d }) => (
            <div
              key={title}
              className="rounded-xl border border-white/10 bg-slate p-6 transition-colors hover:border-white/20"
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-start text-emerald-300">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={d} />
                </svg>
              </div>
              <h3 className="mb-1 text-lg font-bold text-white">{title}</h3>
              <p className="text-sm leading-relaxed text-emerald-100/70">{body}</p>
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
