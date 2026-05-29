"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useScrollAffordance } from "@/lib/useScrollAffordance";

/**
 * A horizontally-scrollable strip WITH affordances. Wraps its children in
 * an `overflow-x-auto` container whose scrollbar is hidden (clean look),
 * and adds the cue that was missing everywhere we used a bare
 * `no-scrollbar` strip: a soft edge fade plus a chevron button on each
 * side that appear only when there is more content to scroll toward.
 *
 * This is the single sanctioned place for `overflow-x-auto no-scrollbar`;
 * the scroll-affordance test fails the build if that pattern is used in a
 * component that doesn't go through here (or the affordance hook), so we
 * can't silently reintroduce a scrollable-but-unindicated strip.
 */
export function ScrollableRow({
  children,
  className = "",
  innerClassName = "",
  fadeColor = "var(--color-bg, #ede4d0)",
  controls = true,
  scrollAmount = 220,
  scrollLeftLabel = "Scroll left",
  scrollRightLabel = "Scroll right",
}: {
  children: ReactNode;
  /** Classes for the outer (relative) wrapper. */
  className?: string;
  /** Classes for the inner scroll container. */
  innerClassName?: string;
  /** Solid color the edge fade blends from (match the bar background). */
  fadeColor?: string;
  /** Render clickable chevron controls (in addition to the fades). */
  controls?: boolean;
  /** Pixels scrolled per chevron click. */
  scrollAmount?: number;
  scrollLeftLabel?: string;
  scrollRightLabel?: string;
}) {
  const { ref, showStart, showEnd, scrollByAmount } =
    useScrollAffordance<HTMLDivElement>();

  return (
    <div className={`relative ${className}`}>
      <div ref={ref} className={`overflow-x-auto no-scrollbar ${innerClassName}`}>
        {children}
      </div>

      {/* Edge fades — pure visual cue, never intercept pointer events. */}
      <span
        aria-hidden
        style={{ backgroundImage: `linear-gradient(to right, ${fadeColor}, transparent)` }}
        className={`pointer-events-none absolute inset-y-0 left-0 w-10 transition-opacity duration-200 ${
          showStart ? "opacity-100" : "opacity-0"
        }`}
      />
      <span
        aria-hidden
        style={{ backgroundImage: `linear-gradient(to left, ${fadeColor}, transparent)` }}
        className={`pointer-events-none absolute inset-y-0 right-0 w-10 transition-opacity duration-200 ${
          showEnd ? "opacity-100" : "opacity-0"
        }`}
      />

      {controls && (
        <>
          <button
            type="button"
            aria-label={scrollLeftLabel}
            tabIndex={showStart ? 0 : -1}
            onClick={() => scrollByAmount(-scrollAmount)}
            className={`absolute left-0 top-1/2 -translate-y-1/2 grid place-items-center h-6 w-6 rounded-full bg-[var(--color-bg,#ede4d0)] text-[var(--color-fg-muted)] shadow-sm ring-1 ring-[var(--color-border)] transition-opacity duration-200 hover:text-[var(--color-fg)] ${
              showStart ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            aria-label={scrollRightLabel}
            tabIndex={showEnd ? 0 : -1}
            onClick={() => scrollByAmount(scrollAmount)}
            className={`absolute right-0 top-1/2 -translate-y-1/2 grid place-items-center h-6 w-6 rounded-full bg-[var(--color-bg,#ede4d0)] text-[var(--color-fg-muted)] shadow-sm ring-1 ring-[var(--color-border)] transition-opacity duration-200 hover:text-[var(--color-fg)] ${
              showEnd ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            <ChevronRight size={14} />
          </button>
        </>
      )}
    </div>
  );
}
