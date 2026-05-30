/**
 * Data-integrity tests for the SEO landing-page configuration.
 *
 * These guard against the kind of bug that would silently break a
 * couple of static pages out of ~100 — a duplicate slug, a swapped
 * lat/lng pair, a stale state name. They run in milliseconds, no DOM,
 * no network.
 */
import { describe, it, expect } from 'vitest';
import {
  SEO_CITIES,
  SUPPORTED_SEO_LOCALES,
  findCityBySlug,
  listCitySlugs,
  slugifyCityName,
} from '@/lib/seo/cities';
import {
  ZODIAC_SIGNS,
  findSignBySlug,
  listSignSlugs,
} from '@/lib/seo/zodiac';

describe('SEO_CITIES integrity', () => {
  it('contains the documented top-50 city set', () => {
    expect(SEO_CITIES.length).toBe(50);
  });

  it('every slug is unique', () => {
    const slugs = SEO_CITIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('every slug is URL-safe (lowercase, alphanum + hyphen only)', () => {
    for (const c of SEO_CITIES) {
      expect(c.slug).toMatch(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/);
    }
  });

  it('latitudes fall within the Indian subcontinent envelope', () => {
    for (const c of SEO_CITIES) {
      // 8°N (Kanyakumari) … 35°N (Srinagar) covers every city we ship.
      expect(c.lat).toBeGreaterThan(7);
      expect(c.lat).toBeLessThan(36);
    }
  });

  it('longitudes fall within the Indian subcontinent envelope', () => {
    for (const c of SEO_CITIES) {
      // 68°E (Gujarat) … 96°E (Arunachal) covers every city we ship.
      expect(c.lng).toBeGreaterThan(67);
      expect(c.lng).toBeLessThan(97);
    }
  });

  it('every city carries a label in every supported SEO locale', () => {
    for (const c of SEO_CITIES) {
      for (const locale of SUPPORTED_SEO_LOCALES) {
        expect((c.i18n as Record<string, string>)[locale]).toBeTruthy();
      }
    }
  });

  it('localized city names use the expected script per locale', () => {
    // Guard against a copy-paste that leaves, say, the Devanagari name in
    // the Tamil slot. Each Indic locale has a distinct Unicode block.
    const scripts: Record<string, RegExp> = {
      hi: /[ऀ-ॿ]/, // Devanagari
      bn: /[ঀ-৿]/, // Bengali
      kn: /[ಀ-೿]/, // Kannada
      ta: /[஀-௿]/, // Tamil
      te: /[ఀ-౿]/, // Telugu
      ml: /[ഀ-ൿ]/, // Malayalam
    };
    for (const c of SEO_CITIES) {
      for (const [locale, re] of Object.entries(scripts)) {
        expect((c.i18n as Record<string, string>)[locale]).toMatch(re);
      }
    }
  });

  it('findCityBySlug round-trips for every entry', () => {
    for (const c of SEO_CITIES) {
      const found = findCityBySlug(c.slug);
      expect(found).toBeDefined();
      expect(found?.slug).toBe(c.slug);
    }
    expect(findCityBySlug('not-a-city')).toBeUndefined();
  });

  it('listCitySlugs matches SEO_CITIES order and length', () => {
    const slugs = listCitySlugs();
    expect(slugs).toHaveLength(SEO_CITIES.length);
    expect(slugs[0]).toBe(SEO_CITIES[0].slug);
  });
});

describe('slugifyCityName', () => {
  it('lowercases and dash-separates spaces', () => {
    expect(slugifyCityName('New Delhi')).toBe('new-delhi');
  });

  it('strips accents and special characters', () => {
    expect(slugifyCityName('São Paulo')).toBe('sao-paulo');
    expect(slugifyCityName("Côte d'Or")).toBe('cote-dor');
  });

  it('collapses repeated separators', () => {
    expect(slugifyCityName('A   B  -  C')).toBe('a-b-c');
  });

  it('returns empty string for empty input', () => {
    expect(slugifyCityName('')).toBe('');
    // @ts-expect-error guarding against undefined input at runtime
    expect(slugifyCityName(undefined)).toBe('');
  });
});

describe('ZODIAC_SIGNS integrity', () => {
  it('contains exactly the 12 tropical signs', () => {
    expect(ZODIAC_SIGNS).toHaveLength(12);
  });

  it('every slug is unique and lowercase', () => {
    const slugs = ZODIAC_SIGNS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z]+$/);
    }
  });

  it('every sign has an emoji symbol and a date range', () => {
    for (const s of ZODIAC_SIGNS) {
      expect(s.symbol.length).toBeGreaterThanOrEqual(1);
      expect(s.dateRange).toMatch(/.+ – .+/);
    }
  });

  it('findSignBySlug round-trips for every sign', () => {
    for (const s of ZODIAC_SIGNS) {
      expect(findSignBySlug(s.slug)?.name).toBe(s.name);
    }
    expect(findSignBySlug('not-a-sign')).toBeUndefined();
  });

  it('listSignSlugs returns 12 entries', () => {
    expect(listSignSlugs()).toHaveLength(12);
  });

  it('elements are restricted to the four classical elements', () => {
    const valid = new Set(['Fire', 'Earth', 'Air', 'Water']);
    for (const s of ZODIAC_SIGNS) {
      expect(valid.has(s.element)).toBe(true);
    }
  });

  it('modalities are restricted to cardinal/fixed/mutable', () => {
    const valid = new Set(['Cardinal', 'Fixed', 'Mutable']);
    for (const s of ZODIAC_SIGNS) {
      expect(valid.has(s.modality)).toBe(true);
    }
  });
});
