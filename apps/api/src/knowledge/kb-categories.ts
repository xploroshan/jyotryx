/**
 * The closed set of vector-KB category names.
 *
 * WHY THIS IS A TYPE AND NOT JUST STRINGS: `KnowledgeService.search()`
 * filters with `where.category = <string>` — an EXACT match. A category name
 * that does not exist matches nothing, returns `[]`, and
 * `assembleContext([])` yields `''`, which every caller's
 * `kbContext ? … : ''` guard silently drops. The feature keeps working and
 * keeps answering; it just answers with zero grounding, with no error and no
 * log. That is how four wrong names shipped in `chat.service.ts`:
 *
 *   remedy     → 'remedies'   (corpus has 'remedy')     → 0 rows
 *   health     → 'doshas'     (corpus has 'dosha')      → 0 rows
 *   career     → 'houses'     ('career' exists, unused) → wrong 13 chunks
 *   numerology → 'nakshatras' ('numerology' exists)     → wrong 29 chunks
 *
 * Typing every lookup as `KbCategory` turns the first two into compile
 * errors. `knowledge-seed-integrity.spec.ts` asserts this list matches the
 * seed corpus exactly, so renaming a category in seed data without updating
 * here (or vice versa) fails the build rather than silently degrading
 * retrieval.
 *
 * Kept free of seed-data imports so request-path services can use it without
 * pulling the ~264KB corpus into memory.
 */

// NAMING NOTE: this list is deliberately inconsistent — 'dosha' and 'remedy'
// are singular while 'houses', 'planets' and 'yogas' are plural, and
// 'divisional_charts' is snake_case. Renaming them would mean a data
// migration over every existing row for a purely cosmetic gain, and the
// actual HARM of the inconsistency (a typo silently matching nothing) is
// already eliminated: every lookup is typed as KbCategory, so a wrong name
// cannot compile. Left as-is on purpose.
export const KB_CATEGORIES = [
  'ashtakvarga',
  'career',
  'divisional_charts',
  'dosha',
  'health',
  'horoscopes',
  'houses',
  'matching',
  'muhurat',
  'nakshatras',
  'numerology',
  'palmistry',
  'panchang',
  'planets',
  'remedy',
  'shadbala',
  'signs',
  'tarot',
  'transits',
  'vastu',
  'yogas',
] as const;

export type KbCategory = (typeof KB_CATEGORIES)[number];

const CATEGORY_SET: ReadonlySet<string> = new Set(KB_CATEGORIES);

/** Runtime guard for values arriving from outside TypeScript (DTOs, DB rows). */
export function isKbCategory(value: string | null | undefined): value is KbCategory {
  return !!value && CATEGORY_SET.has(value);
}
