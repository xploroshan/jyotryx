/**
 * Single source of truth for the vector-KB seed corpus.
 *
 * WHY THIS EXISTS: `prisma/seed.ts` used to import each seed file
 * individually and spread them into a local `allData` array. Two files
 * (tarot.ts, vastu.ts) were never added to either list, so the `tarot` and
 * `vastu` categories had ZERO rows in the database while
 * `tarot.service.ts` and `vastu.service.ts` queried them on every request —
 * silently returning `[]`, which `assembleContext` turns into an empty
 * string, which the `kbContext ? … : ''` guard drops. Both features ran on
 * ungrounded LLM output with no error, no log and no metric.
 *
 * Everything that needs the corpus (the seeder, the idempotent backfill and
 * the integrity tests) now imports from HERE, so a new seed file is wired
 * into all three by adding it once — and `knowledge-seed-integrity.spec.ts`
 * fails if a file under seed-data/ is not represented.
 */

// Keyword extraction is shared with the request-path service so stored
// keywords and query tokens are produced by the SAME code.
export { extractKeywords } from '../keywords.util';

import { PLANET_DATA } from './planets';
import { SIGN_DATA } from './signs';
import { HOUSE_DATA } from './houses';
import { NAKSHATRA_DATA } from './nakshatras';
import { YOGA_DATA } from './yogas';
import { DOSHA_DATA } from './doshas';
import { MATCHING_DATA } from './matching';
import { REMEDY_DATA } from './remedies';
import { PANCHANG_DATA } from './panchang';
import { PALMISTRY_DATA } from './palmistry';
import { MUHURAT_DATA } from './muhurat';
import { DIVISIONAL_CHART_DATA } from './divisional-charts';
import { NUMEROLOGY_DATA } from './numerology';
import { HOROSCOPE_DAILY_DATA } from './horoscope-daily';
import { CAREER_PROFESSION_DATA } from './career-profession';
import { TRANSIT_DASHA_DATA } from './transits-dasha';
import { HEALTH_ASTROLOGY_DATA } from './health-astrology';
import { ASHTAKVARGA_DATA } from './ashtakvarga';
import { SHADBALA_DATA } from './shadbala';
import { TAROT_DATA } from './tarot';
import { VASTU_DATA } from './vastu';

export interface KnowledgeSeed {
  text: string;
  category: string;
  topic?: string;
  source?: string;
}

/** Every seed file, in seeding order. Add new files HERE and nowhere else. */
export const ALL_KNOWLEDGE_SEEDS: KnowledgeSeed[] = [
  ...PLANET_DATA,
  ...SIGN_DATA,
  ...HOUSE_DATA,
  ...NAKSHATRA_DATA,
  ...YOGA_DATA,
  ...DOSHA_DATA,
  ...MATCHING_DATA,
  ...REMEDY_DATA,
  ...PANCHANG_DATA,
  ...PALMISTRY_DATA,
  ...MUHURAT_DATA,
  ...DIVISIONAL_CHART_DATA,
  ...NUMEROLOGY_DATA,
  ...HOROSCOPE_DAILY_DATA,
  ...CAREER_PROFESSION_DATA,
  ...TRANSIT_DASHA_DATA,
  ...HEALTH_ASTROLOGY_DATA,
  ...ASHTAKVARGA_DATA,
  ...SHADBALA_DATA,
  ...TAROT_DATA,
  ...VASTU_DATA,
];

/** Distinct categories present in the corpus. */
export const KNOWLEDGE_SEED_CATEGORIES: ReadonlySet<string> = new Set(
  ALL_KNOWLEDGE_SEEDS.map((d) => d.category),
);

/** Chunk count per category — used by the integrity test and ops tooling. */
export function knowledgeSeedCountsByCategory(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const d of ALL_KNOWLEDGE_SEEDS) counts[d.category] = (counts[d.category] ?? 0) + 1;
  return counts;
}

