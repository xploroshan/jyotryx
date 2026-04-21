/**
 * Locale utility for backend services.
 * Maps locale codes to language names for AI prompt instructions and
 * translates rule-based output strings into the user's chosen locale.
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

/**
 * Minimal LLM chat interface required by the translation helper.
 * Intentionally loose so any caller (OpenAIService, LlmService) satisfies it.
 */
export interface LocaleChatClient {
  chatCompletion(options: {
    messages: { role: string; content: string }[];
    maxTokens?: number;
    temperature?: number;
    jsonMode?: boolean;
    model?: string;
    userId?: string | null;
    feature?: string;
  }): Promise<any | null>;
  getModelForFeature?(feature: 'default' | 'precision' | 'vision'): string;
}

/**
 * Translate a plain string to the target locale using the provided LLM client.
 * Returns the original text unchanged when:
 *  - locale is missing or English
 *  - text is empty
 *  - the LLM call fails or returns an invalid result
 *
 * This is meant for rule-based features (numerology, decumbiture, flying
 * stars, etc.) whose output is assembled from English templates.
 */
export async function translateText(
  client: LocaleChatClient | null | undefined,
  text: string,
  locale?: string,
  feature = 'translate',
): Promise<string> {
  if (!locale || locale === 'en') return text;
  if (!text || !text.trim()) return text;
  if (!client) return text;
  const name = LOCALE_NAMES[locale];
  if (!name) return text;

  try {
    const result = await client.chatCompletion({
      messages: [
        {
          role: 'system',
          content:
            `You are a professional translator. Translate the user text into ${name} (${locale}) ` +
            `using native ${name} script. Preserve proper nouns (personal names, brand names, ` +
            `Sanskrit mantras, planet names like Sun/Moon/Mars, zodiac signs, Nakshatras, ` +
            `Chinese BaZi stems/branches) in their original form. Return ONLY a JSON object ` +
            `shaped exactly {"text":"..."} with no other keys or commentary.`,
        },
        { role: 'user', content: text },
      ],
      maxTokens: Math.min(2000, Math.max(200, text.length * 3)),
      temperature: 0.2,
      jsonMode: true,
      model: client.getModelForFeature?.('default'),
      feature: `i18n:${feature}:${locale}`,
    });
    if (result && typeof result === 'object' && typeof result.text === 'string' && result.text.trim()) {
      return result.text;
    }
  } catch {
    // Swallow — callers always want the original English text as a fallback.
  }
  return text;
}

/**
 * Translate every string value in a flat record. Keys are preserved; any
 * value whose translation fails falls back to the original English string.
 */
export async function translateFields<T extends Record<string, string | string[] | undefined | null>>(
  client: LocaleChatClient | null | undefined,
  fields: T,
  locale?: string,
  feature = 'translate',
): Promise<T> {
  if (!locale || locale === 'en') return fields;
  if (!client) return fields;
  const name = LOCALE_NAMES[locale];
  if (!name) return fields;

  // Build a single JSON payload so one LLM call handles all fields.
  const payload: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      payload[key] = value;
    } else if (typeof value === 'string' && value.trim()) {
      payload[key] = value;
    }
  }
  if (Object.keys(payload).length === 0) return fields;

  try {
    const result = await client.chatCompletion({
      messages: [
        {
          role: 'system',
          content:
            `You are a professional translator. Translate each string value in the user's JSON into ` +
            `${name} (${locale}) using native ${name} script. Preserve proper nouns (personal names, ` +
            `brand names, Sanskrit mantras, planet names like Sun/Moon/Mars, zodiac signs, Nakshatras, ` +
            `Chinese BaZi stems/branches) in their original form. Preserve the exact JSON shape — ` +
            `same keys, same array lengths — and return ONLY the translated JSON object with no ` +
            `extra keys or commentary.`,
        },
        { role: 'user', content: JSON.stringify(payload) },
      ],
      maxTokens: 3000,
      temperature: 0.2,
      jsonMode: true,
      model: client.getModelForFeature?.('default'),
      feature: `i18n:${feature}:${locale}`,
    });

    if (!result || typeof result !== 'object') return fields;

    const merged: Record<string, any> = { ...fields };
    for (const key of Object.keys(payload)) {
      const translated = (result as any)[key];
      const original = payload[key];
      if (Array.isArray(original)) {
        if (Array.isArray(translated) && translated.length === original.length && translated.every((v: any) => typeof v === 'string' && v.trim())) {
          merged[key] = translated;
        }
      } else {
        if (typeof translated === 'string' && translated.trim()) {
          merged[key] = translated;
        }
      }
    }
    return merged as T;
  } catch {
    return fields;
  }
}
