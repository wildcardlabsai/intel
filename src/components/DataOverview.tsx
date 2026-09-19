import {
  ArrowRight,
  BarChart3,
  Building2,
  Coins,
  Construction,
  FileText,
  Map,
  MapPin,
  Users,
} from "lucide-react";
import Reveal from "@/components/Reveal";
import WalesMap from "@/components/WalesMap";

const CATEGORIES = [
  { icon: Building2, label: "Businesses" },
  { icon: MapPin, label: "Planning" },
  { icon: FileText, label: "Contracts" },
  { icon: Coins, label: "Funding" },
  { icon: Users, label: "Jobs" },
  { icon: BarChart3, label: "Economic data" },
  { icon: Construction, label: "Infrastructure" },
  { icon: Map, label: "Interactive map" },
];

export default function DataOverview() {
  return (
    <section id="data" className="bg-cream py-20 sm:py-28">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-14 px-6 sm:px-10 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            The bigger picture
          </p>
          <h2 className="mt-4 text-3xl font-extrabold leading-[1.15] tracking-tight text-ink-900 sm:text-4xl lg:text-[2.6rem]">
            Connect the dots
            <br />
            across the Welsh economy
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
            Cymru Intelligence brings together trusted public data to give
            you a clearer view of the opportunities, people and projects
            shaping Wales.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
            {CATEGORIES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-start gap-2.5">
                <Icon className="h-6 w-6 text-green-800" strokeWidth={1.5} />
                <span className="text-sm font-medium text-ink-900">
                  {label}
                </span>
              </div>
            ))}
          </div>

          <a
            href="#data"
            className="mt-9 inline-flex items-center gap-2 text-sm font-semibold text-ink-900 transition-colors hover:text-green-800"
          >
            Explore our data sources
            <ArrowRight className="h-4 w-4" />
          </a>
        </Reveal>

        <Reveal delay={120}>
          <WalesMap />
        </Reveal>
      </div>
    </section>
  );
}
