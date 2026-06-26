'use client';

/**
 * Central motion language for the app.
 *
 * Three presets cover every case we need today:
 *   - soft    → page entrances, large card fades (unhurried, ~450ms)
 *   - snappy  → hover/tap micro-interactions (~180ms)
 *   - spring  → active-state indicators, layout animations
 *
 * All variants collapse to a zero-duration fade when the user has
 * `prefers-reduced-motion: reduce` enabled — respected at the per-use
 * level via the `useReducedMotion` hook from framer-motion.
 */
import { useEffect, useRef, useState } from 'react';
import type { Transition, Variants } from 'framer-motion';

export const timing = {
  soft: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
  snappy: { duration: 0.18, ease: [0.4, 0, 0.2, 1] as const },
  spring: { type: 'spring' as const, stiffness: 400, damping: 30, mass: 0.6 },
} satisfies Record<string, Transition>;

/**
 * Page-level container: fades + lifts slightly on mount. Pair with
 * `stagger` on a child container for a cascaded content reveal.
 */
export const pageVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { ...timing.soft, when: 'beforeChildren', staggerChildren: 0.05 },
  },
};

/**
 * Stagger container for grids / lists. Children should use `itemVariants`.
 */
export const staggerContainer: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: timing.soft },
};

/** Applied to interactive surfaces (cards, buttons). */
export const tapScale = { scale: 0.97 };
export const hoverLift = { y: -2, transition: timing.snappy };

/** Reduced-motion: instant reveal, no transform. */
export const reducedVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0 } },
};

/**
 * Scroll progress without framer-motion. Writes a `--scroll-progress` CSS
 * variable (0→1, clamped) onto the returned element as it scrolls up through
 * the viewport, throttled to rAF. A lightweight stand-in for
 * `useScroll`/`useTransform`: consumers read the variable inside a CSS
 * transform (translateY, scaleX, …) so the effect stays composite-only and
 * pulls no animation library into the bundle. No-ops under
 * `prefers-reduced-motion`, leaving the variable unset so callers fall back to
 * the default in their `var(--scroll-progress, <fallback>)`.
 */
export function useScrollProgress<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const span = rect.height || window.innerHeight || 1;
      const p = Math.min(1, Math.max(0, -rect.top / span));
      el.style.setProperty('--scroll-progress', p.toFixed(4));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return ref;
}

/**
 * Returns `{ ref, paused }` where `paused` is true whenever the referenced
 * element is scrolled out of the viewport OR the tab is backgrounded. Callers
 * apply it to perpetual CSS animations as
 * `style={{ animationPlayState: paused ? 'paused' : 'running' }}` so the
 * compositor/GPU goes quiet when the animation isn't visible — the homepage
 * hero otherwise keeps re-compositing at 60fps forever (heat/battery) even when
 * the user has scrolled past it. An IntersectionObserver + visibilitychange
 * listener, both cleaned up on unmount; no rAF, no per-frame work.
 */
export function useInViewPause<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let inView = true;
    let hidden = document.hidden;
    const apply = () => setPaused(!inView || hidden);
    const io = new IntersectionObserver(
      (entries) => {
        inView = entries[0]?.isIntersecting ?? true;
        apply();
      },
      { threshold: 0 },
    );
    io.observe(el);
    const onVis = () => {
      hidden = document.hidden;
      apply();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);
  return { ref, paused };
}
