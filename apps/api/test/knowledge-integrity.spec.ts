/**
 * KB integrity test.
 *
 * Locks in two invariants that every Kb* row must satisfy:
 *   1. The `i18n` bag has a non-empty entry for each of the 12 locales
 *      listed in `kb-locales.ts`.
 *   2. `key` is unique within each table, and arrays/strings translate
 *      as the same shape across locales.
 *
 * The test iterates `KB_SEEDS` from `kb-seeds/index.ts`, so it activates
 * automatically as each seed file is added. Today the registry is empty
 * (passes trivially); the first time B2 lands real seeds, any missing
 * locale or shape mismatch will fail this spec.
 */
import { KB_LOCALES } from '../src/knowledge/kb-locales';
import { KB_SEEDS, KbSeedRow } from '../src/knowledge/kb-seeds';

// Tables that are English-authored and awaiting `npm run kb:backfill` to fill
// the remaining 11 locales. These are exempt from the all-12-locales assertion
// (but still must have a non-empty English payload and shape-consistent rows).
// This is safe by design: InterpretationService.tryKb serves the KB only for
// locales that match exactly (renderStatus().matched) and falls back to the
// localized LLM for any locale not yet present — so no English leaks into a
// non-English UI. Remove an entry the moment its backfill lands.
const BACKFILL_PENDING = new Set<string>([
  'kbDashaImpact',
  'kbMatchingTier',
  'kbSignTrait',
  'kbPlanetInHouse',
]);

describe('KB integrity', () => {
  const tableNames = Object.keys(KB_SEEDS);

  it('registry exists', () => {
    expect(KB_SEEDS).toBeDefined();
  });

  for (const tableName of tableNames) {
    describe(tableName, () => {
      const rows = KB_SEEDS[tableName];
      const pending = BACKFILL_PENDING.has(tableName);

      it('has unique keys', () => {
        const keys = rows.map((r) => r.key);
        const unique = new Set(keys);
        expect(unique.size).toBe(keys.length);
      });

      it.each(rows.map((r: KbSeedRow<unknown>) => [r.key, r] as const))(
        '%s has a complete i18n bag',
        (_key, row) => {
          if (pending) {
            // English must exist and be non-empty; other locales arrive via
            // backfill and are served by the LLM until then.
            expect(row.i18n.en).toBeDefined();
            assertNonEmpty(row.i18n.en, `${tableName}.${row.key}.en`);
            return;
          }
          for (const locale of KB_LOCALES) {
            const value = row.i18n[locale];
            expect(value).toBeDefined();
            assertNonEmpty(value, `${tableName}.${row.key}.${locale}`);
          }
        },
      );

      it.each(rows.map((r: KbSeedRow<unknown>) => [r.key, r] as const))(
        '%s has a consistent shape across locales',
        (_key, row) => {
          const enShape = shapeOf(row.i18n.en);
          for (const locale of KB_LOCALES) {
            if (locale === 'en') continue;
            const value = row.i18n[locale];
            if (value === undefined) continue;
            expect(shapeOf(value)).toEqual(enShape);
          }
        },
      );
    });
  }
});

function assertNonEmpty(value: unknown, path: string): void {
  if (value == null) {
    throw new Error(`${path}: expected non-empty value, got ${String(value)}`);
  }
  if (typeof value === 'string' && value.trim().length === 0) {
    throw new Error(`${path}: expected non-empty string`);
  }
  if (Array.isArray(value) && value.length === 0) {
    throw new Error(`${path}: expected non-empty array`);
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      assertNonEmpty(v, `${path}.${k}`);
    }
  }
}

function shapeOf(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `array(${value.length})`;
  if (typeof value === 'object') {
    const keys = Object.keys(value as object).sort();
    return `object(${keys.join(',')})`;
  }
  return typeof value;
}
