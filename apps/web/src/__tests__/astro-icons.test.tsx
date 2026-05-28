/**
 * Astro glyphs — zodiac signs (Tabler) and planets (bespoke SVG) render
 * as real <svg>, so the horoscope grid / planetary-hours never fall back
 * to OS Unicode characters again.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { ZodiacGlyph, PlanetGlyph } from '@/components/icons/astro';

const SIGNS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];
const PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];

describe('ZodiacGlyph', () => {
  it('renders an svg for every zodiac sign (case-insensitive)', () => {
    for (const sign of SIGNS) {
      const { container, unmount } = render(<ZodiacGlyph sign={sign.toUpperCase()} />);
      expect(container.querySelector('svg'), `missing zodiac icon for "${sign}"`).not.toBeNull();
      unmount();
    }
  });

  it('returns null for an unknown sign', () => {
    const { container } = render(<ZodiacGlyph sign="ophiuchus" />);
    expect(container.firstChild).toBeNull();
  });
});

describe('PlanetGlyph', () => {
  it('renders an svg for every classical planet', () => {
    for (const planet of PLANETS) {
      const { container, unmount } = render(<PlanetGlyph planet={planet} />);
      expect(container.querySelector('svg'), `missing planet glyph for "${planet}"`).not.toBeNull();
      unmount();
    }
  });

  it('maps `weight` onto stroke-width', () => {
    const { container } = render(<PlanetGlyph planet="Sun" weight={2} />);
    expect(container.querySelector('svg')?.getAttribute('stroke-width')).toBe('2');
  });

  it('still renders a fallback svg for an unknown planet', () => {
    const { container } = render(<PlanetGlyph planet="Pluto" />);
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
