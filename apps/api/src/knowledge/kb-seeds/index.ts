/**
 * KB seed registry.
 *
 * Every seed file (added in B2) exports an array of rows shaped
 * `{ key, tradition?, i18n }` and pushes its array onto `KB_SEEDS` under
 * the matching table name. The integrity test (`integrity.spec.ts`)
 * iterates this registry to assert that every row has a complete
 * `i18n` bag and that keys are unique within their table.
 *
 * This file starts empty. Seeds land incrementally as each `Kb*` model
 * lands in the schema (see `docs/` for the phased rollout).
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

export const KB_SEEDS: KbSeedRegistry = {};
