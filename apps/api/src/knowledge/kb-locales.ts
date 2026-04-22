/**
 * Canonical locale list for the Knowledge Base.
 *
 * Every KB row must carry an `i18n` bag with an entry for each of these
 * codes. The integrity test asserts presence; `tr()` is the only lookup
 * helper services should use when rendering a KB row for a user.
 */
export const KB_LOCALES = [
  'en', 'hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa', 'or', 'as',
] as const;

export type KbLocale = (typeof KB_LOCALES)[number];

export type LocaleBag<T> = Partial<Record<KbLocale, T>> & { en: T };

export function isKbLocale(value: unknown): value is KbLocale {
  return typeof value === 'string' && (KB_LOCALES as readonly string[]).includes(value);
}

/**
 * Resolve a localized value from a KB row's i18n bag.
 *
 * Lookup order:
 *   1. exact locale match
 *   2. English fallback (guaranteed by schema)
 *
 * Callers that need to know whether the lookup hit the requested locale
 * vs. fell back should use `trStatus` instead and consult `.matched`.
 */
export function tr<T>(bag: LocaleBag<T>, locale?: string | null): T {
  if (locale && isKbLocale(locale) && bag[locale] != null) {
    return bag[locale] as T;
  }
  return bag.en;
}

/**
 * Same as `tr()` but reports whether the requested locale was found.
 * Used by hybrid code paths that still want to call the LLM translator
 * for locales that haven't been backfilled yet.
 */
export function trStatus<T>(
  bag: LocaleBag<T>,
  locale?: string | null,
): { value: T; matched: boolean } {
  if (locale && isKbLocale(locale) && locale !== 'en' && bag[locale] != null) {
    return { value: bag[locale] as T, matched: true };
  }
  return { value: bag.en, matched: !locale || locale === 'en' };
}
