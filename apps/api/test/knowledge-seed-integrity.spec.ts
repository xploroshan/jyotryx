/**
 * Vector-KB corpus integrity.
 *
 * Every assertion here corresponds to a defect that actually shipped and ran
 * in production undetected, because the failure mode of this subsystem is
 * SILENCE: a category that does not exist, or exists but holds no rows,
 * returns `[]` from `search()`; `assembleContext([])` returns `''`; and every
 * caller's `kbContext ? … : ''` guard drops the grounding block. The feature
 * still answers — just with nothing behind it.
 *
 * Defects these tests would have caught:
 *   1. tarot.ts / vastu.ts were never imported by the seeder (they used a
 *      camelCase export while every other file used *_DATA), so the `tarot`
 *      and `vastu` categories were empty in the DB while both services
 *      queried them on every request.
 *   2. chat.service.ts asked for 'remedies' and 'doshas'; the corpus uses the
 *      singular 'remedy' and 'dosha'. Both returned zero rows.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  ALL_KNOWLEDGE_SEEDS,
  KNOWLEDGE_SEED_CATEGORIES,
  knowledgeSeedCountsByCategory,
} from '../src/knowledge/seed-data';
import { KB_CATEGORIES, isKbCategory } from '../src/knowledge/kb-categories';

const SEED_DIR = path.join(__dirname, '..', 'src', 'knowledge', 'seed-data');

function seedFiles(): string[] {
  return fs
    .readdirSync(SEED_DIR)
    .filter((f) => f.endsWith('.ts') && f !== 'index.ts');
}

describe('seed corpus wiring', () => {
  it('every file under seed-data/ is exported through the barrel', () => {
    // The tarot/vastu bug: a seed file existed, was well-written, and was
    // simply never imported. Nothing failed — the category was just empty.
    const barrel = fs.readFileSync(path.join(SEED_DIR, 'index.ts'), 'utf8');
    const missing = seedFiles().filter((f) => !barrel.includes(`'./${f.replace(/\.ts$/, '')}'`));
    expect(missing).toEqual([]);
  });

  it('every seed file uses the *_DATA export convention', () => {
    // tarot.ts/vastu.ts drifted to camelCase, which is what let them be
    // overlooked when the seeder's import list was maintained by hand.
    const offenders: string[] = [];
    for (const file of seedFiles()) {
      const src = fs.readFileSync(path.join(SEED_DIR, file), 'utf8');
      if (!/export const [A-Z][A-Z0-9_]*_DATA\b/.test(src)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it('the seeder consumes the shared corpus rather than its own list', () => {
    const seeder = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'seed.ts'), 'utf8');
    expect(seeder).toContain('ALL_KNOWLEDGE_SEEDS');
    // A hand-maintained spread list is exactly how files got orphaned.
    expect(seeder).not.toMatch(/const allData = \[\s*\n\s*\.\.\.[A-Z_]+_DATA/);
  });

  it('has a non-trivial corpus', () => {
    expect(ALL_KNOWLEDGE_SEEDS.length).toBeGreaterThan(300);
  });
});

describe('category registry matches the corpus', () => {
  it('KB_CATEGORIES and the seed corpus agree exactly', () => {
    const declared = [...KB_CATEGORIES].sort();
    const actual = [...KNOWLEDGE_SEED_CATEGORIES].sort();
    // Renaming a category in seed data without updating the registry (or the
    // reverse) must break the build, not retrieval.
    expect(actual).toEqual(declared);
  });

  it('every declared category has at least one chunk', () => {
    const counts = knowledgeSeedCountsByCategory();
    const empty = KB_CATEGORIES.filter((c) => (counts[c] ?? 0) === 0);
    expect(empty).toEqual([]);
  });

  it('tarot and vastu are populated — both services query them every request', () => {
    const counts = knowledgeSeedCountsByCategory();
    expect(counts.tarot).toBeGreaterThan(0);
    expect(counts.vastu).toBeGreaterThan(0);
  });

  it('isKbCategory accepts real names and rejects the ones that shipped broken', () => {
    expect(isKbCategory('remedy')).toBe(true);
    expect(isKbCategory('dosha')).toBe(true);
    // The exact strings chat.service.ts used to send:
    expect(isKbCategory('remedies')).toBe(false);
    expect(isKbCategory('doshas')).toBe(false);
    expect(isKbCategory(undefined)).toBe(false);
  });
});

describe('chunk quality', () => {
  it('every chunk has non-empty text and a category', () => {
    const bad = ALL_KNOWLEDGE_SEEDS.filter(
      (d) => !d.text || d.text.trim().length < 40 || !d.category,
    );
    expect(bad.map((d) => `${d.category}/${d.topic ?? '?'}`)).toEqual([]);
  });

  it('every chunk carries a topic — it is the key for deterministic lookup', () => {
    // getByTopic(category, topic) is the zero-LLM retrieval path; it only
    // works if topic is populated.
    const untopiced = ALL_KNOWLEDGE_SEEDS.filter((d) => !d.topic);
    expect(untopiced.map((d) => d.category)).toEqual([]);
  });

  it('no chunk text is duplicated', () => {
    // NOTE: several chunks intentionally SHARE a topic (e.g. nine
    // `planets/sun` rows), so getByTopic can return a richer multi-chunk
    // context. That is by design. What must never happen is the same text
    // stored twice — it wastes retrieval slots and skews keyword scoring.
    const seen = new Map<string, number>();
    for (const d of ALL_KNOWLEDGE_SEEDS) {
      const key = `${d.category}::${d.text.trim()}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k.slice(0, 80));
    expect(dupes).toEqual([]);
  });
});
