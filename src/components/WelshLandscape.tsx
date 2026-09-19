export default function WelshLandscape({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 760"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role="img"
      aria-label="Mountains and a lake in the Welsh countryside at dusk"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5c6f6b" />
          <stop offset="38%" stopColor="#8a9a8d" />
          <stop offset="62%" stopColor="#c7b592" />
          <stop offset="100%" stopColor="#e7d2a6" />
        </linearGradient>
        <linearGradient id="ridgeFar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6b7a72" />
          <stop offset="100%" stopColor="#59695f" />
        </linearGradient>
        <linearGradient id="ridgeMid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4a5c4e" />
          <stop offset="100%" stopColor="#3a4b3d" />
        </linearGradient>
        <linearGradient id="ridgeNear" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#33422f" />
          <stop offset="100%" stopColor="#232f22" />
        </linearGradient>
        <linearGradient id="lake" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9fae94" />
          <stop offset="55%" stopColor="#71857a" />
          <stop offset="100%" stopColor="#4c5f56" />
        </linearGradient>
        <linearGradient id="foreground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2b3527" />
          <stop offset="100%" stopColor="#161d15" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="1440" height="760" fill="url(#sky)" />

      {/* sun glow */}
      <circle cx="1180" cy="200" r="150" fill="#f3e3bd" opacity="0.35" />
      <circle cx="1180" cy="200" r="70" fill="#f7ecd2" opacity="0.5" />

      {/* far ridge */}
      <path
        d="M0,300 L90,260 190,290 300,235 420,275 540,225 660,270 800,210 930,260 1060,220 1180,265 1300,230 1440,270 L1440,420 L0,420 Z"
        fill="url(#ridgeFar)"
        opacity="0.75"
      />

      {/* mid ridge */}
      <path
        d="M0,380 L120,320 260,365 380,300 520,355 650,290 790,345 930,300 1080,360 1220,310 1350,350 1440,320 L1440,470 L0,470 Z"
        fill="url(#ridgeMid)"
      />

      {/* near ridge / mountains */}
      <path
        d="M0,470 L140,380 250,430 340,350 460,420 560,370 660,430 760,360 880,425 990,375 1100,430 1220,390 1330,440 1440,400 L1440,520 L0,520 Z"
        fill="url(#ridgeNear)"
      />

      {/* lake */}
      <path d="M0,520 L1440,520 L1440,660 L0,660 Z" fill="url(#lake)" />
      {/* soft reflection ripples */}
      <g opacity="0.28" stroke="#e9e2c8" strokeWidth="2">
        <path d="M120,560 L340,560" />
        <path d="M420,590 L640,590" />
        <path d="M760,555 L940,555" />
        <path d="M1020,610 L1260,610" />
        <path d="M180,630 L420,630" />
      </g>

      {/* foreground rocky bank */}
      <path
        d="M0,600 C160,560 260,650 420,610 C560,578 660,650 820,600 C980,555 1120,640 1260,600 C1340,580 1400,600 1440,590 L1440,760 L0,760 Z"
        fill="url(#foreground)"
      />
    </svg>
  );
}
