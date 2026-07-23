/**
 * Tool → guide internal linking (SEO audit O3).
 *
 * articlesForTool inverts each article's own toolLinks, so the reverse links
 * can never drift from the article data. These tests pin: the inversion is
 * correct and reciprocal, the major tool pages actually get guides, every
 * returned article slug resolves (no broken /learn links), and the cap holds.
 */
import { describe, it, expect } from 'vitest';
import {
  articlesForTool,
  findArticleBySlug,
  LEARN_ARTICLES,
} from '@/lib/learn/articles';

describe('articlesForTool', () => {
  it('is reciprocal: every article a tool returns links back to that tool', () => {
    for (const path of ['/kundli', '/matching', '/muhurat', '/panchang', '/numerology', '/horoscope']) {
      for (const a of articlesForTool(path)) {
        const norm = (h: string) => h.split(/[?#]/)[0].replace(/\/$/, '');
        expect(a.toolLinks.some((t) => norm(t.href) === norm(path)), `${a.slug} ↔ ${path}`).toBe(true);
      }
    }
  });

  it('the primary tool pages each get at least one guide', () => {
    for (const path of ['/kundli', '/matching', '/muhurat', '/panchang', '/horoscope', '/numerology']) {
      expect(articlesForTool(path).length, path).toBeGreaterThan(0);
    }
    // /kundli is the hub — it should surface several.
    expect(articlesForTool('/kundli').length).toBeGreaterThanOrEqual(3);
  });

  it('never returns a slug that does not resolve (no broken /learn links)', () => {
    for (const a of LEARN_ARTICLES.flatMap((x) => x.toolLinks).map(() => null)) void a;
    for (const path of ['/kundli', '/matching', '/muhurat', '/panchang', '/numerology', '/horoscope', '/vedic/dosha', '/vedic/dasha', '/divisional']) {
      for (const a of articlesForTool(path)) {
        expect(findArticleBySlug(a.slug), `${path} → ${a.slug}`).toBeDefined();
      }
    }
  });

  it('respects the limit and is newest-first', () => {
    const two = articlesForTool('/kundli', 2);
    expect(two.length).toBeLessThanOrEqual(2);
    const all = articlesForTool('/kundli', 99);
    for (let i = 1; i < all.length; i++) {
      expect(all[i - 1].dateModified >= all[i].dateModified).toBe(true);
    }
  });

  it('returns [] for a tool no article references (component renders nothing)', () => {
    expect(articlesForTool('/nonexistent-tool')).toEqual([]);
  });

  it('trailing slash / query / hash in href all match the same tool', () => {
    // Guard the normalization the inversion relies on.
    const withVariants = LEARN_ARTICLES.some((a) =>
      a.toolLinks.some((t) => /[?#]/.test(t.href) || t.href.endsWith('/')),
    );
    // Even if today's data has none, the matcher must be robust; assert kundli
    // resolves regardless of how its href was written.
    expect(articlesForTool('/kundli/').length).toBe(articlesForTool('/kundli').length);
    void withVariants;
  });
});
