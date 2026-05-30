/**
 * Integrity checks for the feature-page SEO content. These pages were thin
 * (a widget with no crawlable text); this guards that every feature ships a
 * complete content block — intro, how-it-works, and a substantive FAQ that
 * can power FAQPage rich results — so the thin-content regression can't
 * silently come back.
 */
import { describe, it, expect } from 'vitest';
import { FEATURE_CONTENT } from '@/lib/seo/feature-content';

const FEATURE_PATHS = [
  '/numerology', '/tarot', '/vastu', '/muhurat', '/palmistry', '/matching', '/kundli',
];

describe('FEATURE_CONTENT', () => {
  it('covers every Tier-A feature page', () => {
    for (const path of FEATURE_PATHS) {
      expect(FEATURE_CONTENT[path]).toBeDefined();
    }
  });

  it('every entry has a complete, non-empty content block', () => {
    for (const [path, c] of Object.entries(FEATURE_CONTENT)) {
      expect(c.heading, `${path} heading`).toBeTruthy();
      expect(c.intro.length, `${path} intro`).toBeGreaterThanOrEqual(1);
      expect(c.intro.every((p) => p.trim().length > 40), `${path} intro paras`).toBe(true);
      expect(c.howItWorks.heading, `${path} howItWorks heading`).toBeTruthy();
      expect(c.howItWorks.steps.length, `${path} steps`).toBeGreaterThanOrEqual(3);
      expect(c.faqHeading, `${path} faqHeading`).toBeTruthy();
    }
  });

  it('every FAQ has a substantive question and answer (for FAQPage schema)', () => {
    for (const [path, c] of Object.entries(FEATURE_CONTENT)) {
      expect(c.faqs.length, `${path} faq count`).toBeGreaterThanOrEqual(4);
      for (const f of c.faqs) {
        expect(f.q.trim().endsWith('?'), `${path} q "${f.q}"`).toBe(true);
        // Google requires complete answers — guard against stub one-liners.
        expect(f.a.trim().length, `${path} a for "${f.q}"`).toBeGreaterThan(60);
      }
    }
  });
});
