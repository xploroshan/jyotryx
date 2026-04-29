'use client';

import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';

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
 * This is the only place in the app where yellow appears as a material
 * surface — everywhere else, sun-* tokens stay in micro-accents.
 */
export default function HeroSun({ className = '' }: HeroSunProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, -80]);

  return (
    <motion.div
      ref={ref}
      style={reduce ? undefined : { y }}
      aria-hidden
      className={`relative aspect-square w-full mx-auto select-none ${className}`}
    >
      {/* Outer corona — yellow → orange halo, breathing. */}
      <div
        className={`absolute inset-[-14%] rounded-full blur-[60px] ${
          reduce ? '' : 'animate-[corona-pulse_6s_ease-in-out_infinite]'
        }`}
        style={{
          background:
            'radial-gradient(circle, rgba(255,182,39,0.55) 0%, rgba(255,122,64,0.34) 45%, transparent 75%)',
        }}
      />

      {/* Inner core — sun body. Specular highlight applied in a second
          layer so the disk reads as 3D without going kitsch. */}
      <div
        className="absolute inset-[12%] rounded-full"
        style={{
          background:
            'radial-gradient(circle at 38% 30%, #ffdc85 0%, #ff7a40 38%, #ff4d00 72%, #c43200 100%)',
          boxShadow:
            'inset 0 0 60px rgba(122, 32, 0, 0.35), inset 0 -40px 80px rgba(255, 182, 39, 0.4)',
        }}
      />
      <div
        className="absolute inset-[12%] rounded-full"
        style={{
          background:
            'radial-gradient(ellipse at 32% 22%, rgba(255,253,250,0.55) 0%, transparent 38%)',
        }}
      />

      {/* Slow ring — soft yellow, 80s rotation. */}
      <div
        className={`absolute inset-[6%] rounded-full border border-[#FFCB52]/55 ${
          reduce ? '' : '[animation:astro-spin_80s_linear_infinite]'
        }`}
      />
    </motion.div>
  );
}
