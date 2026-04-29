export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="18" stroke="url(#jt-ring)" strokeWidth="1.5" opacity="0.5"/>
      <circle cx="20" cy="20" r="12" fill="url(#jt-center)" opacity="0.18"/>
      <circle cx="20" cy="20" r="5" fill="url(#jt-star)"/>
      <line x1="20" y1="3" x2="20" y2="10" stroke="url(#jt-ray)" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="20" y1="30" x2="20" y2="37" stroke="url(#jt-ray)" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="3" y1="20" x2="10" y2="20" stroke="url(#jt-ray)" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="30" y1="20" x2="37" y2="20" stroke="url(#jt-ray)" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="7.98" y1="7.98" x2="12.73" y2="12.73" stroke="url(#jt-ray)" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
      <line x1="27.27" y1="27.27" x2="32.02" y2="32.02" stroke="url(#jt-ray)" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
      <line x1="32.02" y1="7.98" x2="27.27" y2="12.73" stroke="url(#jt-ray)" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
      <line x1="12.73" y1="27.27" x2="7.98" y2="32.02" stroke="url(#jt-ray)" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
      <circle cx="20" cy="3.5" r="1.5" fill="#ff7a40"/>
      <circle cx="36.5" cy="20" r="1.2" fill="#ffa07a" opacity="0.7"/>
      <circle cx="8" cy="33" r="1" fill="#ffc6a8" opacity="0.55"/>
      <defs>
        <linearGradient id="jt-star" x1="15" y1="15" x2="25" y2="25">
          <stop offset="0%" stopColor="#ff7a40"/>
          <stop offset="100%" stopColor="#ff4d00"/>
        </linearGradient>
        <linearGradient id="jt-ring" x1="2" y1="2" x2="38" y2="38">
          <stop offset="0%" stopColor="#ffa07a"/>
          <stop offset="50%" stopColor="#ff4d00"/>
          <stop offset="100%" stopColor="#c43200"/>
        </linearGradient>
        <linearGradient id="jt-ray" x1="20" y1="3" x2="20" y2="37">
          <stop offset="0%" stopColor="#ffc6a8"/>
          <stop offset="100%" stopColor="#ff4d00"/>
        </linearGradient>
        <radialGradient id="jt-center" cx="20" cy="20" r="12">
          <stop offset="0%" stopColor="#ff7a40"/>
          <stop offset="100%" stopColor="#ff4d00" stopOpacity="0"/>
        </radialGradient>
      </defs>
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark />
      <span className="font-display text-lg font-semibold text-surface-50 tracking-tight">Jyotron</span>
    </span>
  );
}
