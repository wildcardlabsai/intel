import { Building2, Leaf, TrendingUp, Users2 } from "lucide-react";
import Reveal from "@/components/Reveal";
import RegisterButton from "@/components/RegisterButton";

const PANELS = [
  {
    icon: Building2,
    title: "Find opportunities",
    body: "Identify new projects, contracts and funding.",
  },
  {
    icon: TrendingUp,
    title: "Understand markets",
    body: "Track activity and trends across Wales.",
  },
  {
    icon: Users2,
    title: "Make informed decisions",
    body: "Access trusted data in one place.",
  },
  {
    icon: Leaf,
    title: "Support a stronger Wales",
    body: "More insight. More progress.",
  },
];

export default function AudienceSection() {
  return (
    <section id="audience" className="bg-green-900 py-20 text-cream sm:py-28">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-14 px-6 sm:px-10 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cream/60">
            Built for Wales
          </p>
          <h2 className="mt-4 text-3xl font-extrabold leading-[1.15] tracking-tight sm:text-4xl lg:text-[2.6rem]">
            For the people building a
            <br />
            stronger tomorrow
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-cream/80">
            Whether you&apos;re a business, investor, developer or adviser,
            Cymru Intelligence helps you find the information you need,
            faster and in one place.
          </p>
          <div className="mt-9">
            <RegisterButton variant="cream" />
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {PANELS.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-xl border border-cream/20 p-6 transition-colors duration-200 hover:border-cream/40 hover:bg-white/5"
              >
                <Icon className="h-6 w-6 text-cream" strokeWidth={1.5} />
                <h3 className="mt-4 text-base font-bold text-cream">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-cream/75">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
