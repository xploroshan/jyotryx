/**
 * Icon registry — every tradition and every feature slug must resolve to
 * a (lucide-backed) glyph, so a new feature can't ship with a blank icon.
 * Also pins the `weight` -> stroke-width mapping and the null fallback.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { TraditionGlyph, FeatureGlyph } from '@/components/icons';
import { TRADITION_IDS, WEB_TRADITIONS } from '@/lib/traditions';

describe('icon registry (lucide-backed)', () => {
  it('renders an svg for every tradition id', () => {
    for (const id of TRADITION_IDS) {
      const { container, unmount } = render(<TraditionGlyph id={id} />);
      expect(container.querySelector('svg')).not.toBeNull();
      unmount();
    }
  });

  it('renders an svg for every feature slug across all traditions', () => {
    const slugs = new Set<string>();
    for (const id of TRADITION_IDS) {
      for (const f of WEB_TRADITIONS[id].features) slugs.add(f.slug);
    }
    for (const slug of slugs) {
      const { container, unmount } = render(<FeatureGlyph slug={slug} />);
      expect(container.querySelector('svg'), `missing icon for feature "${slug}"`).not.toBeNull();
      unmount();
    }
  });

  it('maps the `weight` prop onto stroke-width', () => {
    const { container } = render(<TraditionGlyph id="VEDIC" weight={1.4} />);
    expect(container.querySelector('svg')?.getAttribute('stroke-width')).toBe('1.4');
  });

  it('returns null for an unknown feature slug', () => {
    const { container } = render(<FeatureGlyph slug="does-not-exist" />);
    expect(container.firstChild).toBeNull();
  });
});
