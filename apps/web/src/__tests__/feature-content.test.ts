/**
 * Integrity checks for the feature-page SEO content. These pages were thin
 * (a widget with no crawlable text); this guards that every feature ships a
 * complete content block — intro, how-it-works, and a substantive FAQ that
 * can power FAQPage rich results — so the thin-content regression can't
 * silently come back.
 */
import { describe, it, expect } from 'vitest';
import { FEATURE_CONTENT, FEATURE_CONTENT_LOCALE, getFeatureContent } from '@/lib/seo/feature-content';

const FEATURE_PATHS = [
  '/numerology', '/tarot', '/vastu', '/muhurat', '/palmistry', '/matching', '/kundli',
];

function assertContentBlock(path: string, c: { heading: string; intro: string[]; howItWorks: { heading: string; steps: string[] }; faqHeading: string; faqs: { q: string; a: string }[] }, label: string) {
  expect(c.heading, `${label} ${path} heading`).toBeTruthy();
  expect(c.intro.length, `${label} ${path} intro`).toBeGreaterThanOrEqual(1);
  expect(c.intro.every((p) => p.trim().length > 40), `${label} ${path} intro paras`).toBe(true);
  expect(c.howItWorks.heading, `${label} ${path} howItWorks heading`).toBeTruthy();
  expect(c.howItWorks.steps.length, `${label} ${path} steps`).toBeGreaterThanOrEqual(3);
  expect(c.faqHeading, `${label} ${path} faqHeading`).toBeTruthy();
  expect(c.faqs.length, `${label} ${path} faq count`).toBeGreaterThanOrEqual(4);
  for (const f of c.faqs) {
    expect(f.q.trim().endsWith('?'), `${label} ${path} q "${f.q}"`).toBe(true);
    expect(f.a.trim().length, `${label} ${path} a for "${f.q}"`).toBeGreaterThan(60);
  }
}

describe('FEATURE_CONTENT (English)', () => {
  it('covers every Tier-A feature page', () => {
    for (const path of FEATURE_PATHS) {
      expect(FEATURE_CONTENT[path]).toBeDefined();
    }
  });

  it('every entry has a complete, non-empty content block', () => {
    for (const [path, c] of Object.entries(FEATURE_CONTENT)) {
      assertContentBlock(path, c, 'en');
    }
  });
});

describe('FEATURE_CONTENT_LOCALE (Hindi)', () => {
  it('covers every Tier-A feature page in Hindi', () => {
    for (const path of FEATURE_PATHS) {
      expect(FEATURE_CONTENT_LOCALE['hi']?.[path], `hi ${path}`).toBeDefined();
    }
  });

  it('every Hindi entry has a complete, non-empty content block', () => {
    for (const [path, c] of Object.entries(FEATURE_CONTENT_LOCALE['hi'] ?? {})) {
      assertContentBlock(path, c, 'hi');
    }
  });
});

describe('getFeatureContent helper', () => {
  it('returns English for locale "en"', () => {
    expect(getFeatureContent('en', '/kundli')).toBe(FEATURE_CONTENT['/kundli']);
  });

  it('returns Hindi for locale "hi"', () => {
    expect(getFeatureContent('hi', '/kundli')).toBe(FEATURE_CONTENT_LOCALE['hi']?.['/kundli']);
  });

  it('returns undefined for untranslated locale (not English fallback)', () => {
    expect(getFeatureContent('bn', '/kundli')).toBeUndefined();
  });
});
