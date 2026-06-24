'use client';

import { useScrollProgress } from '@/lib/motion';

interface HeroSunProps {
  className?: string;
}

/**
 * The hero focal mass — a layered orange→yellow sun.
 *
 * Built from four stacked radial gradients (corona, core, specular, ring)
 * so we never need a raster or canvas. Drives a subtle scroll-parallax
 * (-80px over the section's viewport range) plus a 6s breathing corona.
 *
 * The parallax uses the framer-motion-free `useScrollProgress` hook (a CSS
 * variable + transform), and the corona/ring loops are CSS animations disabled
 * under prefers-reduced-motion by the global rule in globals.css — so the orb
 * pulls no animation library into the home page's bundle.
 *
 * This is the only place in the app where yellow appears as a material
 * surface — everywhere else, sun-* tokens stay in micro-accents.
 */
export default function HeroSun({ className = '' }: HeroSunProps) {
  const ref = useScrollProgress<HTMLDivElement>();

  return (
    <div
      ref={ref}
      aria-hidden
      style={{ transform: 'translateY(calc(var(--scroll-progress, 0) * -80px))' }}
      className={`relative aspect-square w-full mx-auto select-none ${className}`}
    >
      {/* Outer corona — yellow → orange halo. On the cream canvas we
          push the corona warmer and slightly stronger so the orb still
          reads as a luminous mass against a light page. */}
      <div
        className="absolute inset-[-16%] rounded-full blur-[64px] animate-[corona-pulse_6s_ease-in-out_infinite]"
        style={{
          background:
            'radial-gradient(circle, rgba(255,182,39,0.70) 0%, rgba(255,122,64,0.42) 42%, rgba(255,77,0,0.18) 65%, transparent 80%)',
        }}
      />

      {/* Inner core — sun body. Slightly warmer rim gives the disk a
          firm edge against cream rather than dissolving into the corona. */}
      <div
        className="absolute inset-[10%] rounded-full"
        style={{
          background:
            'radial-gradient(circle at 36% 28%, #fff1c0 0%, #ffb627 18%, #ff7a40 48%, #ff4d00 78%, #a02900 100%)',
          boxShadow:
            'inset 0 0 70px rgba(122, 32, 0, 0.40), inset 0 -50px 90px rgba(255, 182, 39, 0.45), 0 30px 80px -20px rgba(255, 77, 0, 0.55)',
        }}
      />
      <div
        className="absolute inset-[10%] rounded-full"
        style={{
          background:
            'radial-gradient(ellipse at 30% 20%, rgba(255,253,250,0.65) 0%, transparent 42%)',
        }}
      />

      {/* Slow ring — soft saffron at higher opacity so it stays visible
          over the lit canvas. */}
      <div className="absolute inset-[4%] rounded-full border border-[#FFCB52]/70 [animation:astro-spin_80s_linear_infinite]" />
      {/* Outer thin orbit — adds a second concentric ring so the orb
          reads as a small celestial system, not a single disc. */}
      <div className="absolute inset-[-4%] rounded-full border border-[#FF7A40]/35 [animation:astro-spin-rev_120s_linear_infinite]" />
    </div>
  );
}
