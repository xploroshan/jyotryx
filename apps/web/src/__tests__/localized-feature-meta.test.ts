/**
 * Verifies that the Tier-A feature pages emit LOCALIZED <title>/description
 * metadata — composed from the same translated dictionary the page UI renders
 * — rather than spreading the English FEATURE_PAGES copy onto a localized URL.
 *
 * Guards the bug this helper fixed: `/<locale>/numerology` previously carried
 * an English meta title, which both reads wrong and undercuts the localized
 * SEO the rest of the page was built for.
 */
import { describe, it, expect } from 'vitest';
import { localizedFeatureMetadata } from '@/lib/seo/page-metadata';
import { FEATURE_PAGES } from '@/lib/seo/feature-pages';
import { hi } from '@/i18n/hi';
import { ta } from '@/i18n/ta';

describe('localizedFeatureMetadata', () => {
  it('composes the Hindi title from the translated dictionary, not the English fallback', async () => {
    const meta = await localizedFeatureMetadata('hi', '/numerology');
    // Bare title — the root layout's title.template appends the brand suffix
    // for <title>; og:title carries it explicitly (see page-metadata.test.ts).
    expect(meta.title).toBe(`${hi.numerology.title} ${hi.numerology.titleHighlight}`);
    expect(meta.description).toBe(hi.numerology.description);
    // It must NOT be the English FEATURE_PAGES title.
    expect(meta.title).not.toBe(FEATURE_PAGES['/numerology'].title);
  });

  it('omits the highlight segment when the section has only a title (tarot)', async () => {
    const meta = await localizedFeatureMetadata('ta', '/tarot');
    // tarot has no `titleHighlight` — bare translated title (template adds brand).
    expect(meta.title).toBe(ta.tarot.title);
    expect(meta.description).toBe(ta.tarot.description);
  });

  it('points the canonical at the localized URL with hreflang alternates', async () => {
    const meta = await localizedFeatureMetadata('hi', '/matching');
    const alternates = meta.alternates as { canonical?: string; languages?: Record<string, string> };
    expect(alternates.canonical).toContain('/hi/matching');
    expect(alternates.languages?.['x-default']).toBeTruthy();
  });

  it('localizes the home page from the hero strings (audit fix: no English titles on /hi)', async () => {
    // "/" is special-cased: its strings live in home.heroTitle/heroHighlight,
    // and the composed headline already contains the brand — so it opts out
    // of the title.template via an absolute title.
    const meta = await localizedFeatureMetadata('hi', '/');
    expect(meta.title).toEqual({ absolute: `${hi.home.heroTitle} ${hi.home.heroHighlight}` });
    expect(meta.description).toBe(hi.home.heroDescription);
  });
});
