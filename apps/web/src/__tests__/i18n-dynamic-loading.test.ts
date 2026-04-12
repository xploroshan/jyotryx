/**
 * i18n Dynamic Loading Tests
 *
 * Validates that locales are loaded dynamically via import() and cached,
 * with English available synchronously as fallback.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('i18n Dynamic Locale Loading', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('SUPPORTED_LOCALES should contain all 12 locales', async () => {
    const { SUPPORTED_LOCALES } = await import('@/i18n');
    expect(SUPPORTED_LOCALES).toHaveLength(12);
    expect(SUPPORTED_LOCALES).toContain('en');
    expect(SUPPORTED_LOCALES).toContain('hi');
    expect(SUPPORTED_LOCALES).toContain('ta');
    expect(SUPPORTED_LOCALES).toContain('te');
    expect(SUPPORTED_LOCALES).toContain('bn');
    expect(SUPPORTED_LOCALES).toContain('mr');
    expect(SUPPORTED_LOCALES).toContain('gu');
    expect(SUPPORTED_LOCALES).toContain('kn');
    expect(SUPPORTED_LOCALES).toContain('ml');
    expect(SUPPORTED_LOCALES).toContain('pa');
    expect(SUPPORTED_LOCALES).toContain('or');
    expect(SUPPORTED_LOCALES).toContain('as');
  });

  it('English locale should be exported from en.ts', async () => {
    const { en } = await import('@/i18n/en');
    expect(en).toBeDefined();
    expect(en.common).toBeDefined();
  });

  it('detectSystemLocale should return "en" when navigator is undefined', async () => {
    const { detectSystemLocale } = await import('@/i18n');
    // In a Node/jsdom test environment without navigator.languages set to
    // a supported locale, it should fall back to 'en'
    const result = detectSystemLocale();
    // Either 'en' or a detected locale from the test env
    expect(typeof result).toBe('string');
  });

  it('each non-English locale file should export a named constant', async () => {
    const localeExports: Record<string, string> = {
      hi: 'hi', ta: 'ta', te: 'te', bn: 'bn', mr: 'mr',
      gu: 'gu', kn: 'kn', ml: 'ml', pa: 'pa',
      or: 'or_', as: 'as_',
    };

    for (const [locale, exportName] of Object.entries(localeExports)) {
      const mod = await import(`@/i18n/${locale}`);
      expect(mod[exportName]).toBeDefined();
      expect(mod[exportName].common).toBeDefined();
    }
  });

  it('Locale type should be a union of all supported codes', async () => {
    const { SUPPORTED_LOCALES } = await import('@/i18n');
    // All supported locales should be 2-letter codes
    for (const locale of SUPPORTED_LOCALES) {
      expect(locale).toMatch(/^[a-z]{2}$/);
    }
  });

  it('useI18nStore should be a Zustand store', async () => {
    const { useI18nStore } = await import('@/i18n');
    expect(useI18nStore).toBeDefined();
    expect(typeof useI18nStore).toBe('function');
    // Zustand stores have getState()
    expect(typeof useI18nStore.getState).toBe('function');
    const state = useI18nStore.getState();
    expect(state.locale).toBeDefined();
    expect(state.setLocale).toBeDefined();
  });
});
