/**
 * B6: Translation backfill for Kb* seed files.
 *
 * Scans `apps/api/prisma/seed-kb/data/*.json`, finds every row that is
 * missing a target locale, asks GPT-4o to translate the English payload,
 * and writes the result back into the file in place.
 *
 * Run:
 *   cd apps/api
 *   OPENAI_API_KEY=sk-... npx ts-node scripts/backfill-locales.ts
 *
 * Common flags:
 *   --locales=hi,ta,te       Only these locales (default: all 12)
 *   --tables=planets,yogas   Only these tables (default: all)
 *   --force                  Re-translate even if locale already present
 *   --dry-run                Log what would change; do not write
 *   --model=gpt-4o           Override the model (default: gpt-4o)
 *
 * The script is idempotent — rerunning with the same seed and model is a
 * no-op. On failure of a single row, it logs and moves on; the file is
 * only written if at least one row changed.
 */
import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import { backfillTable, Translator, Cli, parseArgv, KB_LOCALES, REVIEWABLE_LOCALES } from './backfill-locales.lib';

async function main() {
  const cli: Cli = parseArgv(process.argv.slice(2));

  if (!cli.dryRun && !process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not set. Add it to your env or pass --dry-run.');
    process.exit(1);
  }

  const client = cli.dryRun ? null : new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const translator: Translator = async (payload, targetLocale, localeName) => {
    if (!client) {
      // --dry-run: emit a placeholder so the diff is visible in the output
      // but no LLM tokens are spent.
      return { __dry_run__: `would translate to ${targetLocale}` } as Record<string, unknown>;
    }
    const resp = await client.chat.completions.create({
      model: cli.model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            `You are a professional translator for astrology content. Translate the values ` +
            `in the user's JSON object into ${localeName} (${targetLocale}) using native script. ` +
            `PRESERVE as-is (do NOT translate): Sanskrit proper nouns (nakshatra names, yoga names, ` +
            `tithi names, planet names like Sun/Moon/Mars, zodiac signs), English-origin mantra ` +
            `transliterations like "Om Suryaya Namaha", and English technical terms already in the ` +
            `text (e.g. "Gayatri Mantra"). PRESERVE ASCII digits (0-9) verbatim — NEVER convert to ` +
            `native numerals (e.g. keep "9" as "9", not "৯"/"९"/"௯"/"٩"). This applies to numeric ` +
            `token fields like "joyHouse" and to numbers embedded inside narrative sentences. ` +
            `PRESERVE placeholder tokens like {name}, {house}, {planet} unchanged — they are ` +
            `substituted by code at render time. Translate narrative phrases, activity descriptions, ` +
            `color names, and advice sentences fully. Preserve the exact JSON shape — same keys, ` +
            `same array lengths, same nested structure. Return ONLY the translated JSON object.`,
        },
        { role: 'user', content: JSON.stringify(payload) },
      ],
    });
    const content = resp.choices[0]?.message?.content;
    if (!content) throw new Error('empty response');
    return JSON.parse(content) as Record<string, unknown>;
  };

  const dataDir = path.resolve(__dirname, '../prisma/seed-kb/data');
  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith('.json'));

  let totalFilled = 0;
  let totalRows = 0;

  for (const file of files) {
    const tableName = path.basename(file, '.json');
    if (cli.tables && !cli.tables.has(tableName)) continue;
    const filePath = path.join(dataDir, file);
    const source = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const before = JSON.stringify(source);

    const { filled, rows } = await backfillTable({
      rows: source.rows,
      locales: cli.locales,
      force: cli.force,
      translator,
      logPrefix: tableName,
      reviewableLocales: REVIEWABLE_LOCALES,
    });
    totalFilled += filled;
    totalRows += rows;

    source.rows = source.rows; // mutation happened in-place
    const after = JSON.stringify(source);
    if (before === after) {
      console.log(`[${tableName}] no changes`);
      continue;
    }
    if (cli.dryRun) {
      console.log(`[${tableName}] would write ${filled} locale entr(ies)`);
      continue;
    }
    fs.writeFileSync(filePath, JSON.stringify(source, null, 2) + '\n', 'utf8');
    console.log(`[${tableName}] wrote ${filled} locale entr(ies)`);
  }

  console.log(`\nSummary: ${totalFilled} locale entr(ies) filled across ${totalRows} rows${cli.dryRun ? ' (dry run)' : ''}.`);
  if (!cli.dryRun && cli.locales.some((l) => !REVIEWABLE_LOCALES.includes(l))) {
    console.log('\nNote: output for locales outside the reviewable set (hi, ta, te, bn) ' +
                'is committed with reviewed: false. Have a native speaker verify before ' +
                'making user-visible.');
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { KB_LOCALES };
