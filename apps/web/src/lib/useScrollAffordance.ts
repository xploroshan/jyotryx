"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tracks whether a horizontally-scrollable element has more content off
 * either edge, so callers can render a scroll affordance (edge fade +
 * chevron). This is the missing cue on our `overflow-x-auto no-scrollbar`
 * strips: hiding the scrollbar for aesthetics removed the only built-in
 * "there's more →" signal, silently clipping items on narrow viewports or
 * in locales with longer labels.
 *
 * Returns a ref to attach to the scroll container, `showStart`/`showEnd`
 * flags, and a `scrollByAmount` helper for chevron buttons. Recomputes on
 * scroll, on element resize (ResizeObserver), and on window resize.
 */
export function useScrollAffordance<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    // 1px tolerance absorbs sub-pixel rounding so the fade doesn't flicker
    // at the extremes.
    setShowStart(scrollLeft > 1);
    setShowEnd(scrollLeft < maxScroll - 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      ro?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [update]);

  const scrollByAmount = useCallback((amount: number) => {
    ref.current?.scrollBy({ left: amount, behavior: "smooth" });
  }, []);

  return { ref, showStart, showEnd, scrollByAmount, update };
}
