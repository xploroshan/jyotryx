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
