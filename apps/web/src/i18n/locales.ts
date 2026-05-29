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

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (SUPPORTED_LOCALES as string[]).includes(value);
}
