'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { CSSProperties } from 'react';

/**
 * Placeholder block with a subtle shimmer pulse. Compose into
 * page-specific skeletons instead of using a spinner alone — the user
 * sees the layout the real content will settle into.
 *
 * Respects prefers-reduced-motion: falls back to a static tint.
 */
export function Skeleton({
  className,
  rounded = 'rounded-xl',
  style,
}: {
  className?: string;
  rounded?: string;
  style?: CSSProperties;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      className={`${rounded} bg-[rgba(255,252,245,0.86)] ${className ?? ''}`}
      style={style}
      animate={reduce ? undefined : { opacity: [0.55, 0.85, 0.55] }}
      transition={reduce ? undefined : { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

/** Multi-line text placeholder. */
export function SkeletonLines({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton
          key={i}
          rounded="rounded"
          className="h-3"
          style={{ width: `${Math.max(55, 100 - i * 15)}%` }}
        />
      ))}
    </div>
  );
}
