const DOTS = [
  { cx: 160, cy: 50, r: 4 },
  { cx: 230, cy: 55, r: 4 },
  { cx: 260, cy: 65, r: 3.5 },
  { cx: 280, cy: 115, r: 5 },
  { cx: 170, cy: 220, r: 5 },
  { cx: 235, cy: 200, r: 4 },
  { cx: 115, cy: 330, r: 4.5 },
  { cx: 165, cy: 340, r: 4 },
  { cx: 200, cy: 375, r: 5.5 },
  { cx: 240, cy: 350, r: 4 },
  { cx: 285, cy: 370, r: 5 },
];

export default function WalesMap() {
  return (
    <div className="relative flex min-h-[500px] flex-col justify-between overflow-hidden rounded-2xl border border-border bg-[#E8EAE3]/70 p-6">
      {/* Wales at a glance */}
      <div className="absolute right-6 top-6 z-20 w-56 space-y-3 rounded-xl border border-border/80 bg-card p-5 shadow-md sm:w-64">
        <h3 className="text-sm font-bold text-ink-900">Wales at a glance</h3>
        <div className="space-y-2 text-xs text-ink-900">
          <StatRow value="42" label="planning applications" />
          <StatRow value="17" label="contracts awarded" />
          <StatRow value="28" label="new companies" />
          <StatRow value="12" label="funding opportunities" last />
        </div>
        <a
          href="#data"
          className="inline-flex items-center gap-1 pt-1 text-xs font-bold text-ink-900 transition-colors hover:text-accent-green"
        >
          <span>Explore the map</span>
          <span>→</span>
        </a>
      </div>

      {/* New development */}
      <div className="absolute left-8 top-36 z-20 rounded-lg border border-border/80 bg-card px-4 py-3 text-left shadow-sm sm:left-16">
        <div className="text-[11px] font-bold uppercase tracking-wider text-ink-900">New development</div>
        <div className="text-xs font-medium text-muted">Caernarfon</div>
      </div>

      {/* Major investment */}
      <div className="absolute bottom-16 right-8 z-20 rounded-lg border border-border/80 bg-card px-4 py-3 text-left shadow-sm sm:right-16">
        <div className="text-[11px] font-bold uppercase tracking-wider text-ink-900">Major investment</div>
        <div className="text-xs font-medium text-muted">Cardiff</div>
      </div>

      <div className="flex h-full min-h-[380px] w-full items-center justify-center py-4">
        <svg className="h-auto max-h-[420px] w-full drop-shadow-sm" viewBox="0 0 400 480" fill="none">
          <path
            d="M 220 30 C 260 25, 290 40, 295 60 C 270 70, 240 75, 220 90 C 200 100, 190 120, 180 140 C 160 140, 140 150, 130 165 C 110 160, 90 170, 80 185 C 70 200, 85 220, 110 220 C 120 230, 135 240, 140 255 C 120 260, 110 270, 110 285 C 110 300, 120 320, 135 330 C 145 350, 155 365, 170 380 C 190 390, 210 405, 230 420 C 260 425, 280 415, 300 400 C 310 380, 315 360, 305 340 C 290 320, 280 300, 285 280 C 295 260, 305 240, 310 210 C 300 190, 290 170, 295 150 C 300 120, 285 90, 270 70 Z"
            fill="#CBD5CE"
            stroke="#A8B8AD"
            strokeWidth="1.5"
          />
          {DOTS.map((d, i) => (
            <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill="#102A23" />
          ))}
          <circle cx="185" cy="95" r="7" fill="#102A23" className="animate-marker" />
          <circle cx="185" cy="95" r="4" fill="#FFFFFF" />
          <circle cx="265" cy="385" r="8" fill="#102A23" className="animate-marker" />
          <circle cx="265" cy="385" r="4.5" fill="#FFFFFF" />
        </svg>
      </div>

      <p className="pt-2 text-center text-[11px] text-muted">
        Real activity. Real places. Real opportunities.
      </p>
    </div>
  );
}

function StatRow({ value, label, last = false }: { value: string; label: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${last ? "" : "border-b border-gray-100 pb-1"}`}>
      <span className="text-sm font-bold text-ink-900">{value}</span>
      <span className="text-muted">{label}</span>
    </div>
  );
}
