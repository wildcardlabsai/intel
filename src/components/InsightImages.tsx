export function ConstructionScene({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 260" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="400" height="260" fill="#cdd3c4" />
      <rect x="0" y="150" width="400" height="110" fill="#a9b09b" />
      <rect x="40" y="90" width="70" height="160" fill="#5b6455" />
      <rect x="120" y="60" width="55" height="190" fill="#454d3f" />
      <rect x="230" y="110" width="90" height="140" fill="#6b7460" />
      <g stroke="#2c3126" strokeWidth="4">
        <line x1="80" y1="90" x2="80" y2="20" />
        <line x1="35" y1="35" x2="150" y2="35" />
        <line x1="80" y1="35" x2="115" y2="60" />
        <line x1="80" y1="55" x2="45" y2="60" />
      </g>
      <g stroke="#2c3126" strokeWidth="4">
        <line x1="280" y1="110" x2="280" y2="30" />
        <line x1="235" y1="45" x2="345" y2="45" />
        <line x1="280" y1="45" x2="310" y2="75" />
      </g>
      <circle cx="80" cy="20" r="4" fill="#2c3126" />
      <circle cx="280" cy="30" r="4" fill="#2c3126" />
    </svg>
  );
}

export function CommercialBuildingScene({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 260" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="400" height="260" fill="#dfe0d3" />
      <rect x="0" y="200" width="400" height="60" fill="#b7bfab" />
      <rect x="60" y="40" width="130" height="200" fill="#3a4536" />
      <rect x="210" y="80" width="100" height="160" fill="#4d5a45" />
      <g fill="#cfd6c0" opacity="0.85">
        {Array.from({ length: 8 }).map((_, row) =>
          Array.from({ length: 4 }).map((_, col) => (
            <rect
              key={`${row}-${col}`}
              x={72 + col * 28}
              y={54 + row * 22}
              width="16"
              height="12"
            />
          ))
        )}
      </g>
      <g fill="#dfe6d2" opacity="0.85">
        {Array.from({ length: 6 }).map((_, row) =>
          Array.from({ length: 3 }).map((_, col) => (
            <rect
              key={`b-${row}-${col}`}
              x={222 + col * 26}
              y={96 + row * 22}
              width="14"
              height="12"
            />
          ))
        )}
      </g>
    </svg>
  );
}

export function InfrastructureScene({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 260" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="infraSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7c8d7f" />
          <stop offset="100%" stopColor="#c9bd97" />
        </linearGradient>
      </defs>
      <rect width="400" height="260" fill="url(#infraSky)" />
      <path d="M0,150 L90,110 200,145 300,100 400,140 L400,260 L0,260 Z" fill="#3f4c3a" />
      <path d="M0,190 L400,190 L400,260 L0,260 Z" fill="#5c6f66" />
      <g opacity="0.3" stroke="#e7e2c9" strokeWidth="2">
        <path d="M60,210 L150,210" />
        <path d="M220,225 L320,225" />
      </g>
    </svg>
  );
}
