/**
 * Locale utility for backend services.
 *
 * Historically this file also hosted `translateText` + `translateFields`
 * helpers that used the LLM to translate English output into the user's
 * locale after rule-based features assembled it. Track A (A1b..A5b)
 * migrated every caller to the structured KB (Kb* tables + placeholder
 * templates rendered via `KbService`), so those helpers are gone.
 * Locale-aware LLM *generation* still uses `getLocaleInstruction`.
 */

const LOCALE_NAMES: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  ta: 'Tamil',
  te: 'Telugu',
  bn: 'Bengali',
  mr: 'Marathi',
  gu: 'Gujarati',
  kn: 'Kannada',
  ml: 'Malayalam',
  pa: 'Punjabi',
  or: 'Odia',
  as: 'Assamese',
};

/**
 * Returns a prompt instruction for the AI to respond in the given locale.
 * Returns empty string for English (default).
 */
export function getLocaleInstruction(locale?: string): string {
  if (!locale || locale === 'en') return '';
  const name = LOCALE_NAMES[locale];
  if (!name) return '';
  return `\n\nIMPORTANT: You MUST respond entirely in ${name} language (${locale}). Use ${name} script for all text. Do not use English except for proper nouns, technical terms, or Sanskrit mantras.`;
}

export function isValidLocale(locale?: string): boolean {
  return !locale || locale in LOCALE_NAMES;
}

export function getLocaleName(locale?: string): string | null {
  if (!locale || !(locale in LOCALE_NAMES)) return null;
  return LOCALE_NAMES[locale];
}
