'use client';

import { type CSSProperties } from 'react';

/**
 * Pure-CSS 3D orb used inside tradition hero blocks. Stacked radial
 * gradients produce a lit sphere; a slow `astro-spin` rotation (defined
 * in `globals.css`) gives it subtle life. Respects
 * `prefers-reduced-motion` via the existing media query in globals.
 */
export default function Orb3D({
  fromClass = 'from-primary-500/80',
  viaClass = 'via-accent-400/40',
  toClass = 'to-transparent',
  size = 140,
  className = '',
}: {
  fromClass?: string;
  viaClass?: string;
  toClass?: string;
  size?: number;
  className?: string;
}) {
  const style: CSSProperties = {
    width: size,
    height: size,
    animation: 'astro-spin 24s linear infinite',
  };
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      {/* Outer glow */}
      <div
        className={`absolute inset-[-30%] rounded-full bg-gradient-radial ${fromClass} ${viaClass} ${toClass} blur-2xl opacity-60`}
        aria-hidden
      />
      {/* Core sphere */}
      <div
        style={style}
        className={`relative rounded-full bg-gradient-radial ${fromClass} ${viaClass} ${toClass} shadow-[inset_-12px_-18px_40px_rgba(0,0,0,0.55),inset_10px_12px_30px_rgba(255,255,255,0.12)]`}
        aria-hidden
      >
        {/* Specular highlight */}
        <div className="absolute top-[14%] left-[22%] w-[24%] h-[18%] rounded-full bg-white/35 blur-md" />
        {/* Equatorial ring */}
        <div className="absolute inset-[18%] rounded-full border border-white/15" />
      </div>
    </div>
  );
}
