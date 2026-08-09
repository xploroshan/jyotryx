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
    console.log('\nNo missing documents.');
    await refreshKeywords(dryRun);
    await reportOrphans();
    return;
  }

  if (dryRun) {
    console.log(`\n--dry: would insert ${missing.length} document(s). No changes made.`);
    await refreshKeywords(dryRun);
    await reportOrphans();
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

  await refreshKeywords(dryRun);
  await reportOrphans();
}

/**
 * Recompute `keywords` on rows whose stored value no longer matches the
 * current tokeniser.
 *
 * REQUIRED, not cosmetic. `keywords` is written at insert time and was never
 * recomputed, but the tokeniser changed: punctuation used to be deleted
 * ("long-term" -> `longterm`, "Moon's" -> `moons`) and is now a word break
 * ("long", "term", "moon"). 42% of the corpus contains a hyphenated word and
 * 27% an apostrophe, so without this pass the stored keywords and the query
 * tokeniser disagree on nearly half the corpus — silently losing exactly the
 * discriminating terms the keyword tier exists to match, and leaving a
 * half-old/half-new corpus after any insert.
 */
async function refreshKeywords(dryRun: boolean): Promise<void> {
  const rows = await prisma.knowledgeDocument.findMany({
    select: { id: true, text: true, keywords: true },
  });
  const stale = rows.filter((r) => {
    const want = extractKeywords(r.text);
    return want.length !== r.keywords.length || want.some((k, i) => k !== r.keywords[i]);
  });

  if (stale.length === 0) {
    console.log('\nkeywords: already current on all rows.');
    return;
  }
  if (dryRun) {
    console.log(`\n--dry: ${stale.length} row(s) have stale keywords. No changes made.`);
    return;
  }
  for (const row of stale) {
    await prisma.knowledgeDocument.update({
      where: { id: row.id },
      data: { keywords: extractKeywords(row.text) },
    });
  }
  console.log(`\nRefreshed keywords on ${stale.length} row(s).`);
}

/**
 * Report rows the corpus no longer accounts for.
 *
 * Identity is (locale, category, text), so EDITING a chunk's text creates a
 * new row and leaves the old one behind — still retrievable, still holding a
 * valid embedding, and able to co-occupy the top-k with the corrected text.
 * The per-category table cannot show this (db > seed prints no flag), and the
 * next run would report "nothing to do". Also flags rows whose text matches
 * but whose topic drifted, since topic is the key for getByTopic — the
 * zero-LLM retrieval path.
 */
async function reportOrphans(): Promise<void> {
  const rows = await prisma.knowledgeDocument.findMany({
    select: { id: true, category: true, text: true, topic: true, locale: true },
  });
  const byIdentity = new Map(
    ALL_KNOWLEDGE_SEEDS.map((d) => [identityOf(d.category, d.text, 'en'), d]),
  );

  const orphans = rows.filter((r) => !byIdentity.has(identityOf(r.category, r.text, r.locale)));
  const topicDrift = rows
    .map((r) => ({ row: r, seed: byIdentity.get(identityOf(r.category, r.text, r.locale)) }))
    .filter((x) => x.seed && (x.seed.topic ?? null) !== x.row.topic);

  if (orphans.length > 0) {
    console.warn(
      `\nWARNING: ${orphans.length} row(s) are in the DB but not in the seed corpus — ` +
        'usually an edited chunk whose old row was left behind. They remain retrievable.',
    );
    for (const o of orphans.slice(0, 10)) {
      console.warn(`  ${o.id}  ${o.category}/${o.topic ?? '?'}  "${o.text.slice(0, 60)}..."`);
    }
    if (orphans.length > 10) console.warn(`  ...and ${orphans.length - 10} more`);
  }
  if (topicDrift.length > 0) {
    console.warn(
      `\nWARNING: ${topicDrift.length} row(s) have the corpus text but a different topic. ` +
        'getByTopic lookups against the new topic will miss.',
    );
    for (const t of topicDrift.slice(0, 10)) {
      console.warn(`  ${t.row.id}  db="${t.row.topic}"  seed="${t.seed!.topic}"`);
    }
  }
}

main()
  .catch((err) => {
    console.error('kb:sync failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
