'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Moves keyboard focus to the `<main>` element whenever the route changes.
 *
 * Next.js client-side navigation doesn't reset focus the way a full reload
 * would, so focus stays on whatever link/button the user just clicked. That
 * leaves a stuck focus ring on the nav pill for sighted users and, more
 * importantly, means screen readers don't announce the new page title.
 *
 * Requires `<main tabIndex={-1}>` so the element can receive programmatic
 * focus without becoming a tab stop.
 */
export default function RouteFocusReset() {
  const pathname = usePathname();
  // Skip the very first render — on initial page load the browser already
  // handles focus correctly, and forcing a focus move would steal it from
  // elements like an autofocused input.
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    const main = document.querySelector('main');
    if (!(main instanceof HTMLElement)) return;
    main.focus({ preventScroll: true });
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  return null;
}
