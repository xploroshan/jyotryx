/**
 * KB seed registry.
 *
 * Mirrors the `SEED_TABLES` list in `apps/api/prisma/seed-kb/index.ts` and
 * exposes it keyed by Prisma model name. The integrity test
 * (`integrity.spec.ts`) iterates this registry to assert that every row
 * has a complete `i18n` bag and that keys are unique within each table.
 *
 * Loaded lazily via `require()` so this module stays cheap to import when
 * the registry isn't needed (e.g. production runtime — only tests consume it).
 */
import type { LocaleBag } from '../kb-locales';

export interface KbSeedRow<Shape> {
  /** Canonical English identifier, e.g. "Sun", "Ashwini". Stable across migrations. */
  key: string;
  /** Null = shared across traditions; else a single tradition code like "VEDIC". */
  tradition?: string | null;
  /** Localized payload; shape is per-table. */
  i18n: LocaleBag<Shape>;
}

export type KbSeedRegistry = Record<string, ReadonlyArray<KbSeedRow<unknown>>>;

function loadRegistry(): KbSeedRegistry {
  // Imported at call time so build systems that don't include `prisma/` in
  // their compilation graph still succeed. Tests resolve this path via
  // ts-jest's module resolver.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { SEED_TABLES } = require('../../../prisma/seed-kb') as {
    SEED_TABLES: ReadonlyArray<{ modelName: string; rows: KbSeedRow<unknown>[] }>;
  };
  const registry: KbSeedRegistry = {};
  for (const table of SEED_TABLES) {
    registry[table.modelName] = table.rows;
  }
  return registry;
}

export const KB_SEEDS: KbSeedRegistry = loadRegistry();
