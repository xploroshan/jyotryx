/**
 * MyAstro360 brand mark — the "Shatkona-dial": two interlocking triangles (the
 * six-pointed shatkona) inside a 360° tick-dial, in the warm sunrise brand
 * gradient (amber→orange, matching `.text-gradient-sunrise`). Pure vector,
 * font-independent. Rendered transparent so it sits on any surface (cream
 * navbar/footer, dark auth) and inherits sizing via `className`. Gradient ids
 * are prefixed to this component; every instance is identical, so duplicate
 * ids across marks on one page resolve correctly. Stroke weights are tuned to
 * stay crisp at the 24px navbar size.
 */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="logomark-ring" gradientUnits="userSpaceOnUse" x1="12" y1="12" x2="88" y2="88">
          <stop offset="0" stopColor="#f7b733" />
          <stop offset="0.5" stopColor="#f8943f" />
          <stop offset="1" stopColor="#ef6c1a" />
        </linearGradient>
        <linearGradient id="logomark-star" gradientUnits="userSpaceOnUse" x1="28" y1="28" x2="72" y2="72">
          <stop offset="0" stopColor="#f8943f" />
          <stop offset="1" stopColor="#ef6c1a" />
        </linearGradient>
      </defs>
      {/* 360° dial ring */}
      <circle cx="50" cy="50" r="40" fill="none" stroke="url(#logomark-ring)" strokeWidth="2" opacity="0.85" />
      {/* 12 dial ticks */}
      <g stroke="url(#logomark-ring)" strokeWidth="2.4" strokeLinecap="round" opacity="0.7">
        <line x1="84" y1="50" x2="90" y2="50" />
        <line x1="79.4" y1="67" x2="84.6" y2="70" />
        <line x1="67" y1="79.4" x2="70" y2="84.6" />
        <line x1="50" y1="84" x2="50" y2="90" />
        <line x1="33" y1="79.4" x2="30" y2="84.6" />
        <line x1="20.6" y1="67" x2="15.4" y2="70" />
        <line x1="16" y1="50" x2="10" y2="50" />
        <line x1="20.6" y1="33" x2="15.4" y2="30" />
        <line x1="33" y1="20.6" x2="30" y2="15.4" />
        <line x1="50" y1="16" x2="50" y2="10" />
        <line x1="67" y1="20.6" x2="70" y2="15.4" />
        <line x1="79.4" y1="33" x2="84.6" y2="30" />
      </g>
      {/* Shatkona — two interlocking triangles */}
      <path d="M50 24 L73 64 L27 64 Z" fill="none" stroke="url(#logomark-star)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M50 76 L27 36 L73 36 Z" fill="none" stroke="url(#logomark-star)" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="50" cy="50" r="3.6" fill="url(#logomark-star)" />
    </svg>
  );
}

/**
 * Brand wordmark — "MyAstro" inherits the surrounding text color (so it reads
 * on both the cream chrome and the dark footer), while "360" carries the warm
 * sunrise gradient (`.text-gradient-sunrise`, the site's signature accent).
 * Pass typography/color via `className`.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={className}>
      MyAstro
      <span className="text-gradient-sunrise">360</span>
    </span>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark />
      <Wordmark className="font-display text-lg font-semibold text-surface-950 tracking-tight" />
    </span>
  );
}
