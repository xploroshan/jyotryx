/**
 * Server-safe i18n constants — intentionally NO 'use client' directive so
 * both Server Components (for SSR/SSG of localized routes) and the client
 * store can share one source of truth for the supported locales.
 */
export type Locale =
  | 'en' | 'hi' | 'ta' | 'te' | 'bn' | 'mr'
  | 'gu' | 'kn' | 'ml' | 'pa' | 'or' | 'as';

export const SUPPORTED_LOCALES: Locale[] = [
  'en', 'hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa', 'or', 'as',
];

/** English is served at the root (no prefix); the rest get a /<locale> prefix. */
export const DEFAULT_LOCALE: Locale = 'en';

/** Locales that carry a URL prefix (everything except the default). */
export const PREFIXED_LOCALES: Locale[] = SUPPORTED_LOCALES.filter(
  (l) => l !== DEFAULT_LOCALE,
);

/**
 * Locales the HOROSCOPE landing pages (horoscope/[sign], …/[period]) are
 * published in. These are fully dictionary-driven (sign names, element +
 * period labels) + the API's locale-aware forecast, so any locale whose
 * dictionary is complete (all of them, via the parity tests) can be enabled
 * with no machine-translated prose.
 */
export const LANDING_LOCALES: Locale[] = ['en', 'hi', 'bn', 'kn', 'ta', 'te', 'ml'];

/** Non-default landing locales (carry a URL prefix). */
export const PREFIXED_LANDING_LOCALES: Locale[] = LANDING_LOCALES.filter(
  (l) => l !== DEFAULT_LOCALE,
);

/**
 * Which landing locales to PRE-RENDER at build time. The forecast comes from
 * the API (an LLM call), so prebuilding every locale × sign × period would be
 * slow/costly; we prebuild Hindi (the largest market) and let the rest render
 * on demand via ISR — they're still crawlable and sitemap-listed.
 */
export const PREBUILD_LANDING_LOCALES: Locale[] = ['hi'];

/**
 * Locales the PANCHANG/city landing pages are published in. These need a
 * localized CITY NAME (city.i18n) so an English city name never leaks into an
 * otherwise-localized page. Now that city.i18n carries every landing locale,
 * panchang tracks LANDING_LOCALES — keep the two sets aligned so a city page
 * is published for exactly the locales whose city name + dictionary exist.
 */
export const PANCHANG_LOCALES: Locale[] = ['en', 'hi', 'bn', 'kn', 'ta', 'te', 'ml'];
export const PREFIXED_PANCHANG_LOCALES: Locale[] = PANCHANG_LOCALES.filter(
  (l) => l !== DEFAULT_LOCALE,
);

/**
 * Which prefixed panchang locales to PRE-RENDER at build. Each panchang page
 * fetches the locale-aware API at build time, so prebuilding every locale ×
 * city would multiply build-time API calls (6 × 50). We prebuild Hindi (the
 * largest market) and let the rest render on demand via ISR — they stay
 * crawlable and sitemap-listed. Mirrors PREBUILD_LANDING_LOCALES for
 * horoscope. English lives at the root route, prebuilt there separately.
 */
export const PREBUILD_PANCHANG_LOCALES: Locale[] = ['hi'];

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (SUPPORTED_LOCALES as string[]).includes(value);
}

/**
 * Resolves a route's `[locale]` segment to a prefixed landing locale, or null
 * if it isn't one (the default/English lives at the root, and locales outside
 * LANDING_LOCALES aren't published as landing pages → the page should 404).
 */
export function prefixedLandingLocale(value: string | undefined | null): Locale | null {
  return isLocale(value) && value !== DEFAULT_LOCALE && LANDING_LOCALES.includes(value)
    ? value
    : null;
}

/** Same as prefixedLandingLocale but for the narrower PANCHANG_LOCALES set. */
export function prefixedPanchangLocale(value: string | undefined | null): Locale | null {
  return isLocale(value) && value !== DEFAULT_LOCALE && PANCHANG_LOCALES.includes(value)
    ? value
    : null;
}
