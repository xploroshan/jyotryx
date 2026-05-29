/**
 * Guard against the "scrollable but no indicator" UX regression.
 *
 * We deliberately hide the scrollbar (`no-scrollbar`) on horizontal strips
 * for a clean look — but doing that on an `overflow-x` container removes
 * the only built-in cue that there's more content off-screen, silently
 * clipping items on narrow viewports or in locales with longer labels
 * (this is exactly how the feature sub-menu shipped clipping "KP
 * Astrology"). The fix is to route such strips through <ScrollableRow>
 * (or use the useScrollAffordance hook directly), which adds an edge fade
 * + chevron controls.
 *
 * This test fails the build if any component hides the scrollbar on a
 * horizontal-scroll container WITHOUT going through that affordance — so
 * the gap can't silently reappear.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(__dirname, '..');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

// The component that legitimately owns the `overflow-x-auto no-scrollbar`
// pattern and renders the affordance.
const AFFORDANCE_OWNER = join('components', 'ui', 'ScrollableRow.tsx');

describe('scroll affordance guard', () => {
  it('every hidden-scrollbar horizontal strip uses ScrollableRow / useScrollAffordance', () => {
    const offenders: string[] = [];

    for (const file of walk(SRC)) {
      const src = readFileSync(file, 'utf8');
      const hidesScrollbar = /no-scrollbar/.test(src);
      const scrollsX = /overflow-x-(auto|scroll)/.test(src);
      if (!hidesScrollbar || !scrollsX) continue;

      // The owner is allowed to define the raw pattern.
      if (file.endsWith(AFFORDANCE_OWNER)) continue;

      // Otherwise it must opt into the affordance.
      const usesAffordance =
        /ScrollableRow/.test(src) || /useScrollAffordance/.test(src);
      if (!usesAffordance) {
        offenders.push(file.slice(file.indexOf('/src/') + 1));
      }
    }

    if (offenders.length) {
      throw new Error(
        'These components hide the scrollbar on an overflow-x strip without a ' +
          'scroll affordance. Wrap the strip in <ScrollableRow> (or use ' +
          'useScrollAffordance) so users can tell it scrolls:\n' +
          offenders.map((f) => `  • ${f}`).join('\n'),
      );
    }
    expect(offenders).toEqual([]);
  });
});
