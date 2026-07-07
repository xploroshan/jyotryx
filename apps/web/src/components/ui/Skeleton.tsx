import type { CSSProperties } from 'react';

/**
 * Placeholder block with a subtle shimmer pulse. Compose into
 * page-specific skeletons instead of using a spinner alone — the user
 * sees the layout the real content will settle into.
 *
 * The pulse is a pure-CSS keyframe (`animate-skeleton-pulse` in
 * globals.css) rather than framer-motion: skeletons render on
 * first-load-critical pages (/horoscope, /reports), and a looping
 * opacity tween is exactly what CSS animations are for — dropping the
 * motion runtime (~45KB gz) from those pages' first-load JS.
 * `prefers-reduced-motion` is honoured in CSS (`motion-reduce:animate-none`).
 * No 'use client' needed anymore — it renders anywhere.
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
  return (
    <div
      aria-hidden
      className={`${rounded} bg-[rgba(255,252,245,0.86)] animate-skeleton-pulse motion-reduce:animate-none ${className ?? ''}`}
      style={style}
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
