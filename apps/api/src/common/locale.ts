/**
 * Locale utility for backend services.
 * Maps locale codes to language names for AI prompt instructions.
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
