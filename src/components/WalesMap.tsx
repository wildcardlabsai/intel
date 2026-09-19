import { ArrowRight } from "lucide-react";

const MARKERS = [
  { top: "10%", left: "48%", size: "h-2.5 w-2.5" },
  { top: "16%", left: "62%", size: "h-2 w-2" },
  { top: "24%", left: "38%", size: "h-2 w-2" },
  { top: "32%", left: "55%", size: "h-2.5 w-2.5" },
  { top: "40%", left: "35%", size: "h-2 w-2" },
  { top: "46%", left: "50%", size: "h-2 w-2" },
  { top: "54%", left: "30%", size: "h-2.5 w-2.5" },
  { top: "60%", left: "48%", size: "h-2 w-2" },
  { top: "68%", left: "40%", size: "h-3 w-3" },
  { top: "74%", left: "55%", size: "h-4 w-4" },
  { top: "78%", left: "34%", size: "h-2 w-2" },
  { top: "86%", left: "44%", size: "h-2.5 w-2.5" },
];

export default function WalesMap() {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-[#e7e9dd] p-6 sm:p-8">
      <div className="relative mx-auto aspect-[9/11] w-full max-w-md">
        {/* Wales silhouette */}
        <svg
          viewBox="0 0 300 380"
          className="absolute inset-0 h-full w-full drop-shadow-sm"
          aria-hidden="true"
        >
          <path
            d="M118 8
               L 158 4 L 186 22 L 172 34
               L 198 30 L 214 54 L 200 66
               L 216 90 L 210 116 L 224 128
               L 214 150 L 226 168 L 210 182
               L 218 208 L 204 226 L 212 250
               L 196 268 L 202 292 L 178 308
               L 184 330 L 156 344 L 132 338
               L 108 348 L 92 358 L 70 350
               L 60 336 L 76 328 L 52 320
               L 30 306 L 12 314 L 4 296
               L 22 282 L 6 264 L 22 250
               L 12 228 L 32 214 L 22 192
               L 42 178 L 34 156 L 54 140
               L 44 118 L 62 100 L 52 78
               L 32 84 L 20 68 L 44 58
               L 30 40 L 54 32 L 60 48
               L 80 30 L 100 40 L 92 20 Z"
            fill="#cbd6bb"
            stroke="#a9b89a"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>

        {/* activity markers */}
        {MARKERS.map((marker, i) => (
          <span
            key={i}
            className={`absolute ${marker.size} animate-marker rounded-full bg-green-900`}
            style={{
              top: marker.top,
              left: marker.left,
              animationDelay: `${i * 0.35}s`,
            }}
          />
        ))}

        {/* New development panel */}
        <div className="absolute left-[0%] top-[8%] w-[52%] min-w-[130px] rounded-lg bg-white/95 px-3.5 py-2.5 text-left shadow-md ring-1 ring-black/5 sm:px-4 sm:py-3">
          <p className="text-[11px] font-semibold text-ink-900 sm:text-xs">
            New development
          </p>
          <p className="text-[11px] text-muted sm:text-xs">Caernarfon</p>
        </div>

        {/* Major investment panel */}
        <div className="absolute bottom-[2%] right-[0%] w-[52%] min-w-[130px] rounded-lg bg-white/95 px-3.5 py-2.5 text-left shadow-md ring-1 ring-black/5 sm:px-4 sm:py-3">
          <p className="text-[11px] font-semibold text-ink-900 sm:text-xs">
            Major investment
          </p>
          <p className="text-[11px] text-muted sm:text-xs">Cardiff</p>
        </div>
      </div>

      {/* Wales at a glance stat card */}
      <div className="relative mt-5 w-full rounded-xl bg-white px-5 py-4 shadow-lg ring-1 ring-black/5 sm:absolute sm:right-8 sm:top-8 sm:mt-0 sm:w-[240px]">
        <p className="text-[13px] font-bold text-ink-900">Wales at a glance</p>
        <ul className="mt-3 space-y-2">
          <StatRow value="42" label="planning applications" />
          <StatRow value="17" label="contracts awarded" />
          <StatRow value="28" label="new companies" />
          <StatRow value="12" label="funding opportunities" />
        </ul>
        <a
          href="#data"
          className="mt-3.5 inline-flex items-center gap-1.5 text-xs font-semibold text-green-800 transition-colors hover:text-green-900"
        >
          Explore the map
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>

      <p className="mt-4 text-center text-xs text-muted">
        Real activity. Real places. Real opportunities.
      </p>
    </div>
  );
}

function StatRow({ value, label }: { value: string; label: string }) {
  return (
    <li className="flex items-baseline gap-2 text-[13px]">
      <span className="font-bold text-ink-900">{value}</span>
      <span className="text-muted">{label}</span>
    </li>
  );
}
