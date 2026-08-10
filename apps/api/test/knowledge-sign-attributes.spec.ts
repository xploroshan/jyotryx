/**
 * The deterministic sign-attribute table must never drift from the KB.
 *
 * `sign-attributes.util.ts` replaced an LLM round-trip for luckyNumber and
 * luckyColor. That is only safe while the hard-coded values still agree with
 * what `seed-data/signs.ts` tells users elsewhere in the product — otherwise
 * the horoscope card and the sign guide would quietly disagree. This test
 * parses the KB text and compares, so editing one without the other fails.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  SIGN_RULER,
  SIGN_COLORS,
  PLANET_NUMBER,
  ZODIAC_SIGN_SLUGS,
  luckyNumberFor,
  luckyColorFor,
  isZodiacSignSlug,
} from '../src/modules/astrology/sign-attributes.util';

interface KbSign {
  ruler?: string;
  luckyNumber?: number;
  colors?: string[];
}

/** Parse the canonical values straight out of the seed corpus. */
function parseSignsFromKb(): Record<string, KbSign> {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'knowledge', 'seed-data', 'signs.ts'),
    'utf8',
  );
  const out: Record<string, KbSign> = {};
  const entries = src.matchAll(
    /\{[^{}]*?text:\s*'((?:[^'\\]|\\.)*)'[^{}]*?topic:\s*'([a-z]+)'[^{}]*?\}/gs,
  );
  for (const m of entries) {
    const [, text, topic] = m;
    const ln = /Lucky number:\s*(\d+)/.exec(text);
    const fc = /Favorable colors:\s*([a-zA-Z, ]+?)(?:\.|$)/.exec(text);
    const rl = /ruled by ([A-Z][a-z]+)/.exec(text);
    out[topic] = {
      ruler: rl?.[1],
      luckyNumber: ln ? Number(ln[1]) : undefined,
      colors: fc ? fc[1].split(',').map((c) => c.trim()).filter(Boolean) : undefined,
    };
  }
  return out;
}

const KB = parseSignsFromKb();

describe('sign attributes match the knowledge base', () => {
  it('parses all 12 signs from the KB (guards the parser itself)', () => {
    expect(Object.keys(KB).sort()).toEqual([...ZODIAC_SIGN_SLUGS].sort());
  });

  it.each([...ZODIAC_SIGN_SLUGS])('%s: ruling planet matches the KB', (sign) => {
    expect(SIGN_RULER[sign]).toBe(KB[sign].ruler);
  });

  it.each([...ZODIAC_SIGN_SLUGS])('%s: lucky number matches the KB', (sign) => {
    expect(luckyNumberFor(sign)).toBe(KB[sign].luckyNumber);
  });

  it.each([...ZODIAC_SIGN_SLUGS])('%s: favourable colours match the KB', (sign) => {
    expect(SIGN_COLORS[sign]).toEqual(KB[sign].colors);
  });

  it('lucky number is exactly PLANET_NUMBER[ruler] for every sign', () => {
    // This is the property that lets the number be derived rather than tabled.
    for (const sign of ZODIAC_SIGN_SLUGS) {
      expect(luckyNumberFor(sign)).toBe(PLANET_NUMBER[SIGN_RULER[sign]]);
    }
  });
});

describe('sign attribute helpers', () => {
  it('are deterministic — same input, same output, always', () => {
    // The whole point of replacing the LLM here: a model could answer 7 today
    // and 4 tomorrow for the same sign.
    for (const sign of ZODIAC_SIGN_SLUGS) {
      const a = { n: luckyNumberFor(sign), c: luckyColorFor(sign) };
      const b = { n: luckyNumberFor(sign), c: luckyColorFor(sign) };
      expect(a).toEqual(b);
    }
  });

  it('are case-insensitive', () => {
    expect(luckyNumberFor('ARIES')).toBe(luckyNumberFor('aries'));
    expect(luckyColorFor('Leo')).toBe(luckyColorFor('leo'));
  });

  it('return undefined for a non-sign rather than throwing', () => {
    expect(luckyNumberFor('ophiuchus')).toBeUndefined();
    expect(luckyColorFor('')).toBeUndefined();
    expect(isZodiacSignSlug('ophiuchus')).toBe(false);
    expect(isZodiacSignSlug(undefined)).toBe(false);
  });

  it('every sign yields a usable number and colour', () => {
    for (const sign of ZODIAC_SIGN_SLUGS) {
      expect(luckyNumberFor(sign)).toBeGreaterThanOrEqual(1);
      expect(luckyNumberFor(sign)).toBeLessThanOrEqual(9);
      expect(typeof luckyColorFor(sign)).toBe('string');
      expect((luckyColorFor(sign) as string).length).toBeGreaterThan(2);
    }
  });
});
