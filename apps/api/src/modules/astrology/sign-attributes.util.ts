/**
 * Deterministic per-sign attributes: ruling planet, lucky number, lucky colours.
 *
 * These were previously ASKED OF THE LLM on every horoscope request, per sign,
 * per period, per locale, per day. They are not opinions — they are fixed
 * classical correspondences that never change, and the values were already
 * written down in the knowledge base (`seed-data/signs.ts`, "Lucky number: N"
 * / "Favorable colors: …"). Paying a model to re-invent them each day is both
 * a cost and a correctness risk: a model is free to answer 7 today and 4
 * tomorrow for the same sign.
 *
 * `knowledge-sign-attributes.spec.ts` parses signs.ts and asserts every value
 * here matches the KB, so the two can never drift.
 */

export type ZodiacSignSlug =
  | 'aries' | 'taurus' | 'gemini' | 'cancer' | 'leo' | 'virgo'
  | 'libra' | 'scorpio' | 'sagittarius' | 'capricorn' | 'aquarius' | 'pisces';

export const ZODIAC_SIGN_SLUGS: readonly ZodiacSignSlug[] = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
] as const;

/** Classical Vedic rulership (the ruler of the sign's rashi). */
export const SIGN_RULER: Record<ZodiacSignSlug, string> = {
  aries: 'Mars',
  taurus: 'Venus',
  gemini: 'Mercury',
  cancer: 'Moon',
  leo: 'Sun',
  virgo: 'Mercury',
  libra: 'Venus',
  scorpio: 'Mars',
  sagittarius: 'Jupiter',
  capricorn: 'Saturn',
  aquarius: 'Saturn',
  pisces: 'Jupiter',
};

/**
 * Classical planet -> number correspondence used across Vedic numerology.
 * The KB's per-sign "Lucky number" values are exactly PLANET_NUMBER[ruler]
 * for all 12 signs, so the lucky number is fully derivable rather than
 * needing its own table.
 */
export const PLANET_NUMBER: Record<string, number> = {
  Sun: 1,
  Moon: 2,
  Jupiter: 3,
  Rahu: 4,
  Mercury: 5,
  Venus: 6,
  Ketu: 7,
  Saturn: 8,
  Mars: 9,
};

/**
 * Favourable colours per sign.
 *
 * NOT derivable from the ruler alone: Aries and Scorpio share Mars but carry
 * different palettes (red/orange vs dark red/black), as do Capricorn and
 * Aquarius under Saturn. Mirrors seed-data/signs.ts verbatim.
 */
export const SIGN_COLORS: Record<ZodiacSignSlug, string[]> = {
  aries: ['red', 'orange'],
  taurus: ['green', 'pink'],
  gemini: ['yellow', 'green'],
  cancer: ['white', 'silver'],
  leo: ['gold', 'orange', 'red'],
  virgo: ['green', 'grey'],
  libra: ['blue', 'white', 'pink'],
  scorpio: ['dark red', 'black'],
  sagittarius: ['yellow', 'purple'],
  capricorn: ['black', 'dark blue'],
  aquarius: ['blue', 'electric blue'],
  pisces: ['sea green', 'lavender'],
};

export function isZodiacSignSlug(value: string | null | undefined): value is ZodiacSignSlug {
  return !!value && (ZODIAC_SIGN_SLUGS as readonly string[]).includes(value.toLowerCase());
}

/** Lucky number for a sign, via its ruling planet. Stable forever. */
export function luckyNumberFor(sign: string): number | undefined {
  const slug = sign.toLowerCase();
  if (!isZodiacSignSlug(slug)) return undefined;
  return PLANET_NUMBER[SIGN_RULER[slug]];
}

/**
 * Primary lucky colour for a sign.
 *
 * Deliberately returns the FIRST colour rather than rotating by date: the
 * value is cached for 24h per sign/period/locale, so a date-varying answer
 * would be inconsistent across the cache window and between periods.
 */
export function luckyColorFor(sign: string): string | undefined {
  const slug = sign.toLowerCase();
  if (!isZodiacSignSlug(slug)) return undefined;
  return SIGN_COLORS[slug][0];
}

/** All favourable colours for a sign. */
export function luckyColorsFor(sign: string): string[] {
  const slug = sign.toLowerCase();
  if (!isZodiacSignSlug(slug)) return [];
  return [...SIGN_COLORS[slug]];
}
