/**
 * Sitemap hreflang matrix — SEO audit I1 ("mirror the matrix in the sitemap").
 *
 * The dangerous failure mode with hreflang is INCONSISTENCY: if the sitemap
 * and the page-level alternates disagree, or if cluster members carry
 * different matrices, Google discards the whole cluster. These tests pin:
 *  - localized entry groups carry alternates.languages with x-default,
 *  - every URL inside a cluster carries the IDENTICAL matrix (reciprocity),
 *  - each cluster's matrix contains the member URL itself,
 *  - English-only groups (kundli cities, learn, traditions) carry none.
 */
import { describe, it, expect } from 'vitest';
import {
  allSitemapEntries,
  staticEntries,
  signEntries,
  localizedSignEntries,
  panchangCityEntries,
  localizedPanchangCityEntries,
  localizedFeatureEntries,
  kundliCityEntries,
  traditionEntries,
  learnEntries,
} from '@/lib/seo/sitemap-entries';

type Entry = ReturnType<typeof allSitemapEntries>[number];
const langs = (e: Entry): Record<string, string> | undefined =>
  (e as { alternates?: { languages?: Record<string, string> } }).alternates?.languages;

describe('sitemap hreflang alternates', () => {
  it('localized groups carry a languages matrix with x-default', () => {
    for (const group of [
      signEntries(),
      localizedSignEntries(),
      panchangCityEntries(),
      localizedPanchangCityEntries(),
      localizedFeatureEntries(),
    ]) {
      expect(group.length).toBeGreaterThan(0);
      for (const entry of group) {
        const l = langs(entry);
        expect(l, entry.url).toBeDefined();
        expect(l!['x-default'], entry.url).toBeTruthy();
        expect(Object.keys(l!).length, entry.url).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('every cluster member lists ITSELF in its matrix (validity requirement)', () => {
    for (const entry of [...signEntries(), ...localizedSignEntries(), ...localizedFeatureEntries()]) {
      const l = langs(entry)!;
      expect(Object.values(l), entry.url).toContain(entry.url);
    }
  });

  it('en and localized variants of the same page carry IDENTICAL matrices (reciprocity)', () => {
    const en = signEntries();
    const localized = localizedSignEntries();
    const enAries = en.find((e) => e.url.endsWith('/horoscope/aries'))!;
    const hiAries = localized.find((e) => e.url.includes('/hi/horoscope/aries'))!;
    expect(langs(hiAries)).toEqual(langs(enAries));
  });

  it('English-only groups carry no alternates (no phantom clusters)', () => {
    for (const group of [kundliCityEntries(), traditionEntries(), learnEntries()]) {
      for (const entry of group) {
        expect(langs(entry), entry.url).toBeUndefined();
      }
    }
  });

  it('static entries: localized feature paths have the matrix, en-only paths do not', () => {
    const entries = staticEntries();
    const home = entries.find((e) => e.url.endsWith('.com/'))!;
    expect(langs(home)).toBeDefined();
    const pricing = entries.find((e) => e.url.endsWith('/pricing'))!;
    expect(langs(pricing)).toBeUndefined();
  });

  it('the full sitemap has no duplicate URLs', () => {
    const all = allSitemapEntries();
    const urls = all.map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
