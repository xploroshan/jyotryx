/**
 * Idempotent vector-KB backfill.
 *
 * `prisma/seed.ts` seeds `knowledge_documents` ONLY on an empty table:
 *
 *     const existingCount = await prisma.knowledgeDocument.count();
 *     if (existingCount > 0) { ...skipping seed...; return; }
 *
 * That guard means any seed file added after the first production seed is
 * never inserted. It is exactly how the `tarot` and `vastu` categories ended
 * up with ZERO rows in production while `tarot.service.ts` and
 * `vastu.service.ts` queried them on every request -- returning `[]`, which
 * silently dropped their grounding block and left both features running on
 * ungrounded LLM output.
 *
 * This script closes that gap: it diffs the seed corpus against the table and
 * inserts only what is missing. Safe to run repeatedly; a second run inserts 0.
 *
 *   npm run kb:sync            # apply
 *   npm run kb:sync -- --dry   # report only, change nothing
 *
 * After inserting, `EmbeddingSyncService.onModuleInit` (which runs on every
 * API boot and backfills rows `WHERE embedding_vec IS NULL`) generates the
 * pgvector embeddings for the new rows -- no extra step needed.
 */

import { PrismaClient } from '@prisma/client';
import {
  ALL_KNOWLEDGE_SEEDS,
  extractKeywords,
  knowledgeSeedCountsByCategory,
  type KnowledgeSeed,
} from '../src/knowledge/seed-data';

const prisma = new PrismaClient();

/**
 * Stable identity for a chunk.
 *
 * Keyed on (category, text) -- NOT (category, topic). Topics are deliberately
 * NOT unique: nine separate chunks share the `planets/sun` topic, for
 * instance, so that getByTopic can assemble a richer multi-chunk context.
 * Keying on topic would treat every chunk after the first in a topic as
 * already present and silently skip it, which would have re-created the very
 * class of gap this script exists to close.
 */
function identityOf(category: string, text: string, locale: string): string {
  return `${locale}::${category}::${text.trim()}`;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry');

  const existing = await prisma.knowledgeDocument.findMany({
    select: { id: true, category: true, topic: true, text: true, locale: true },
  });

  const seen = new Set(existing.map((row) => identityOf(row.category, row.text, row.locale)));
  const missing: KnowledgeSeed[] = ALL_KNOWLEDGE_SEEDS.filter(
    // The corpus is English-authored; translated chunks arrive with their
    // own locale and therefore their own identity.
    (seed) => !seen.has(identityOf(seed.category, seed.text, 'en')),
  );

  // Per-category report: what the corpus declares vs what the DB holds.
  const seedCounts = knowledgeSeedCountsByCategory();
  const dbCounts: Record<string, number> = {};
  for (const row of existing) dbCounts[row.category] = (dbCounts[row.category] ?? 0) + 1;

  const rule = '-'.repeat(52);
  console.log('category              seed    db   missing');
  console.log(rule);
  for (const category of Object.keys(seedCounts).sort()) {
    const s = seedCounts[category];
    const d = dbCounts[category] ?? 0;
    const gap = missing.filter((m) => m.category === category).length;
    const flag = d === 0 ? '   <-- EMPTY IN DB' : gap > 0 ? '   <-- incomplete' : '';
    console.log(
      category.padEnd(20) +
        String(s).padStart(5) +
        String(d).padStart(6) +
        String(gap).padStart(10) +
        flag,
    );
  }
  console.log(rule);
  console.log(
    `total: ${ALL_KNOWLEDGE_SEEDS.length} seed / ${existing.length} db / ${missing.length} missing`,
  );

  // Categories present in the DB but absent from the corpus -- usually a
  // renamed category, which strands rows no code path will ever query.
  const orphanCategories = Object.keys(dbCounts).filter((c) => !(c in seedCounts));
  if (orphanCategories.length > 0) {
    console.warn(`\nWARNING: categories in DB but not in seed corpus: ${orphanCategories.join(', ')}`);
  }

  if (missing.length === 0) {
    console.log('\nNothing to do -- the database already matches the seed corpus.');
    return;
  }

  if (dryRun) {
    console.log(`\n--dry: would insert ${missing.length} document(s). No changes made.`);
    return;
  }

  const batchSize = 50;
  let inserted = 0;
  for (let i = 0; i < missing.length; i += batchSize) {
    const batch = missing.slice(i, i + batchSize).map((item) => ({
      text: item.text,
      category: item.category,
      locale: 'en',
      topic: item.topic,
      source: item.source,
      keywords: extractKeywords(item.text),
    }));
    const result = await prisma.knowledgeDocument.createMany({ data: batch });
    inserted += result.count;
  }

  console.log(`\nInserted ${inserted} document(s).`);
  console.log(
    'Embeddings for the new rows are generated on the next API boot ' +
      '(EmbeddingSyncService.onModuleInit backfills WHERE embedding_vec IS NULL).',
  );
}

main()
  .catch((err) => {
    console.error('kb:sync failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
