/**
 * i18n key-parity regression test.
 *
 * Guarantees that every non-English locale file defines *exactly* the same
 * nested key shape as `en.ts`. If a locale is missing a key, the user will
 * see an `undefined` in the UI when that locale is selected — this test
 * catches the regression at build time.
 *
 * The test does not compare values (those are translations); it only checks
 * that every path leading to a string in en.ts also exists in every other
 * locale and resolves to a string.
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
  }
});
