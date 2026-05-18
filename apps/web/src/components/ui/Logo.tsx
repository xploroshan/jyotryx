export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer 360° orbit */}
      <circle cx="20" cy="20" r="18" stroke="url(#ma-ring)" strokeWidth="1.5" opacity="0.45"/>
      {/* Inner orbital ring */}
      <circle cx="20" cy="20" r="13" stroke="url(#ma-ring)" strokeWidth="1.25" opacity="0.7"/>
      {/* Central monogram "M" */}
      <text x="20" y="24.5" fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif" fontSize="13" fontWeight="700" fill="url(#ma-star)" textAnchor="middle" letterSpacing="-0.5">M</text>
      {/* Orbital celestial dots */}
      <circle cx="20" cy="2" r="1.6" fill="#fcd34d"/>
      <circle cx="38" cy="20" r="1.3" fill="#a78bfa" opacity="0.85"/>
      <circle cx="20" cy="38" r="1.1" fill="#c4b5fd" opacity="0.7"/>
      <circle cx="2" cy="20" r="1" fill="#fbbf24" opacity="0.7"/>
      <defs>
        <linearGradient id="ma-star" x1="13" y1="13" x2="27" y2="27">
          <stop offset="0%" stopColor="#a78bfa"/>
          <stop offset="100%" stopColor="#6366f1"/>
        </linearGradient>
        <linearGradient id="ma-ring" x1="2" y1="2" x2="38" y2="38">
          <stop offset="0%" stopColor="#a78bfa"/>
          <stop offset="50%" stopColor="#6366f1"/>
          <stop offset="100%" stopColor="#4f46e5"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark />
      <span className="font-display text-lg font-semibold text-surface-950 tracking-tight">myastro360</span>
    </span>
  );
}
