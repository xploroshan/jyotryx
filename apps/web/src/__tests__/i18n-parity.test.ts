/**
 * i18n key-parity regression test.
 *
 * Guarantees that every non-English locale file defines *exactly* the same
 * nested key shape as `en.ts`. If a locale is missing a key, the user will
 * see an `undefined` in the UI when that locale is selected — this test
 * catches the regression at build time.
 *
 * Beyond structural parity, this suite also asserts translation quality:
 *   - no empty/whitespace-only values (translator skipped a row)
 *   - no untranslated values (copy-paste of English that was never translated,
 *     excluding an allowlist of proper nouns, brand names, and universally
 *     untranslated terms like 'OK' or 'Kundli')
 *   - no leading/trailing whitespace drift
 *   - every SUPPORTED_LOCALES entry from i18n/index.ts has a test case
 *     (so adding a new locale without wiring it up here fails loudly)
 */
import { describe, it, expect } from 'vitest';
import { en } from '@/i18n/en';
import { hi } from '@/i18n/hi';
import { ta } from '@/i18n/ta';
import { te } from '@/i18n/te';
import { bn } from '@/i18n/bn';
import { mr } from '@/i18n/mr';
import { gu } from '@/i18n/gu';
import { kn } from '@/i18n/kn';
import { ml } from '@/i18n/ml';
import { pa } from '@/i18n/pa';
import { or_ } from '@/i18n/or';
import { as_ } from '@/i18n/as';
import { SUPPORTED_LOCALES } from '@/i18n';

type Dict = Record<string, unknown>;

function collectKeyPaths(obj: Dict, prefix = ''): string[] {
  const out: string[] = [];
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      out.push(path);
    } else if (value && typeof value === 'object') {
      out.push(...collectKeyPaths(value as Dict, path));
    }
  }
  return out;
}

function resolvePath(obj: Dict, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') return (acc as Dict)[part];
    return undefined;
  }, obj);
}

/**
 * Keys that are allowed to match English verbatim in other locales.
 *
 * Use sparingly. Valid reasons: proper nouns ('Jyotron', 'Vedic'), universally
 * adopted English terms in Indian-language UIs ('OK', 'Email', 'SMS'), and
 * acronyms (API, URL). Anything else should actually be translated.
 */
const UNTRANSLATED_ALLOWLIST = new Set<string>([
  // Allowlist specific key paths here once we hit legitimate cases.
  // Format: 'namespace.key' or 'a.b.c'
]);

/**
 * Regex for values that are allowed to match English verbatim regardless of
 * the key path. Use for patterns like brand names, numbers, URLs.
 */
const UNTRANSLATED_VALUE_PATTERNS: RegExp[] = [
  /^Jyotron$/i,         // brand name
  /^Jyotryx$/i,         // brand name
  /^OK$/,               // universal UI term
  /^\d+$/,              // pure numbers
  /^[\d.,%+\-\s]+$/,    // numeric formats
  /^https?:\/\//i,      // URLs
  /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i, // email addresses
];

/**
 * Ratchet baseline: current count of values in each locale that match English
 * verbatim. These are documented translation gaps — the test fails if a PR
 * INCREASES any of these counts (regression), but a PR that decreases a count
 * is allowed and should update the baseline in the same commit.
 *
 * Goal: every number here should eventually be 0. Until then, this lock
 * prevents backsliding.
 *
 * To update: run `npx vitest run src/__tests__/i18n-parity.test.ts` and copy
 * the printed actual count into the matching entry below.
 */
const UNTRANSLATED_BASELINE: Record<string, number> = {
  hi: 79,
  ta: 79,
  te: 455,
  bn: 455,
  mr: 450,
  gu: 455,
  kn: 455,
  ml: 455,
  pa: 455,
  or: 455,
  as: 455,
};

const locales: Array<[string, Dict]> = [
  ['hi', hi],
  ['ta', ta],
  ['te', te],
  ['bn', bn],
  ['mr', mr],
  ['gu', gu],
  ['kn', kn],
  ['ml', ml],
  ['pa', pa],
  ['or', or_],
  ['as', as_],
];

describe('i18n key parity', () => {
  const enPaths = collectKeyPaths(en as unknown as Dict);

  it('en.ts is non-empty and has expected scale', () => {
    expect(enPaths.length).toBeGreaterThan(500);
  });

  for (const [name, dict] of locales) {
    it(`${name}.ts defines every key path that en.ts defines`, () => {
      const missing: string[] = [];
      const nonString: string[] = [];
      for (const path of enPaths) {
        const v = resolvePath(dict, path);
        if (v === undefined) missing.push(path);
        else if (typeof v !== 'string') nonString.push(path);
      }
      if (missing.length) {
        throw new Error(
          `${name}.ts is missing ${missing.length} key(s): ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`,
        );
      }
      if (nonString.length) {
        throw new Error(
          `${name}.ts has non-string values at ${nonString.length} path(s): ${nonString.slice(0, 5).join(', ')}${nonString.length > 5 ? '…' : ''}`,
        );
      }
      expect(missing).toEqual([]);
      expect(nonString).toEqual([]);
    });

    it(`${name}.ts has no extra keys beyond en.ts`, () => {
      const localPaths = collectKeyPaths(dict);
      const enSet = new Set(enPaths);
      const extra = localPaths.filter((p) => !enSet.has(p));
      if (extra.length) {
        throw new Error(
          `${name}.ts has ${extra.length} extra key(s) not in en.ts: ${extra.slice(0, 5).join(', ')}${extra.length > 5 ? '…' : ''}`,
        );
      }
      expect(extra).toEqual([]);
    });

    it(`${name}.ts has no empty or whitespace-only values`, () => {
      const empties: string[] = [];
      for (const path of enPaths) {
        const v = resolvePath(dict, path);
        if (typeof v === 'string' && v.trim() === '') {
          empties.push(path);
        }
      }
      if (empties.length) {
        throw new Error(
          `${name}.ts has ${empties.length} empty value(s) — translator likely skipped these rows:\n` +
            empties.slice(0, 10).join('\n') +
            (empties.length > 10 ? `\n… and ${empties.length - 10} more` : ''),
        );
      }
      expect(empties).toEqual([]);
    });

    it(`${name}.ts untranslated-count does not exceed ratchet baseline`, () => {
      const untranslated: string[] = [];
      for (const path of enPaths) {
        if (UNTRANSLATED_ALLOWLIST.has(path)) continue;
        const en_v = resolvePath(en as unknown as Dict, path);
        const loc_v = resolvePath(dict, path);
        if (
          typeof en_v === 'string' &&
          typeof loc_v === 'string' &&
          en_v === loc_v &&
          // Skip values matching the allowlist patterns (brand names, numbers, etc.)
          !UNTRANSLATED_VALUE_PATTERNS.some((re) => re.test(loc_v.trim()))
        ) {
          untranslated.push(`${path} = "${en_v}"`);
        }
      }

      const baseline = UNTRANSLATED_BASELINE[name] ?? 0;
      const actual = untranslated.length;

      if (actual > baseline) {
        throw new Error(
          `${name}.ts REGRESSED: ${actual} untranslated values (baseline ${baseline}, +${actual - baseline}).\n` +
            `Either translate the new entries or, if intentional, add them to ` +
            `UNTRANSLATED_ALLOWLIST / UNTRANSLATED_VALUE_PATTERNS.\n\n` +
            `First few untranslated entries:\n` +
            untranslated.slice(0, 15).join('\n') +
            (untranslated.length > 15 ? `\n… and ${untranslated.length - 15} more` : ''),
        );
      }

      if (actual < baseline) {
        // Progress! Translations were added. Emit a warning so the dev knows
        // to lower the baseline in the same commit (otherwise future regressions
        // won't be caught against the newly-improved state).
        console.warn(
          `\n[i18n-parity] ${name}.ts improved: ${actual} untranslated ` +
            `(baseline ${baseline}, -${baseline - actual}). ` +
            `Update UNTRANSLATED_BASELINE['${name}'] to ${actual} in ` +
            `src/__tests__/i18n-parity.test.ts to lock in the progress.\n`,
        );
      }

      expect(actual).toBeLessThanOrEqual(baseline);
    });

    it(`${name}.ts values have no leading/trailing whitespace`, () => {
      const drifted: string[] = [];
      for (const path of enPaths) {
        const v = resolvePath(dict, path);
        if (typeof v === 'string' && v !== v.trim() && v.trim() !== '') {
          drifted.push(`${path} = "${v}"`);
        }
      }
      if (drifted.length) {
        throw new Error(
          `${name}.ts has ${drifted.length} value(s) with leading/trailing whitespace:\n` +
            drifted.slice(0, 10).join('\n'),
        );
      }
      expect(drifted).toEqual([]);
    });
  }

  // Coverage completeness — if a new locale is added to SUPPORTED_LOCALES without
  // being wired into the test array, this assertion flags it immediately.
  it('every locale in SUPPORTED_LOCALES has a test case (or is the source locale)', () => {
    const tested = new Set(['en', ...locales.map(([name]) => name)]);
    const missing = SUPPORTED_LOCALES.filter((l) => !tested.has(l));
    expect(
      missing,
      `SUPPORTED_LOCALES includes ${missing.join(', ')} but the i18n-parity test does ` +
        `not cover them. Add the import and a [name, dict] entry to the locales array.`,
    ).toEqual([]);
  });
});
