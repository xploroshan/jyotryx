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
    expect(meta.title).toBe(`${hi.numerology.title} ${hi.numerology.titleHighlight} | myastro360`);
    expect(meta.description).toBe(hi.numerology.description);
    // It must NOT be the English FEATURE_PAGES title.
    expect(meta.title).not.toBe(FEATURE_PAGES['/numerology'].title);
  });

  it('omits the highlight segment when the section has only a title (tarot)', async () => {
    const meta = await localizedFeatureMetadata('ta', '/tarot');
    // tarot has no `titleHighlight` — title is just `${title} | myastro360`.
    expect(meta.title).toBe(`${ta.tarot.title} | myastro360`);
    expect(meta.description).toBe(ta.tarot.description);
  });

  it('points the canonical at the localized URL with hreflang alternates', async () => {
    const meta = await localizedFeatureMetadata('hi', '/matching');
    const alternates = meta.alternates as { canonical?: string; languages?: Record<string, string> };
    expect(alternates.canonical).toContain('/hi/matching');
    expect(alternates.languages?.['x-default']).toBeTruthy();
  });

  it('falls back to the English entry for a path with no i18n key mapping', async () => {
    // "/" is in FEATURE_PAGES but not in the feature→dictionary map.
    const meta = await localizedFeatureMetadata('hi', '/');
    expect(meta.title).toBe(FEATURE_PAGES['/'].title);
    expect(meta.description).toBe(FEATURE_PAGES['/'].description);
  });
});
