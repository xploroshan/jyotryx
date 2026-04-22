/**
 * Testable guts of `backfill-locales.ts`.
 *
 * The CLI entrypoint is a thin wrapper that wires OpenAI into the pure
 * functions here. Tests exercise these directly with a stub translator
 * so the behaviour (shape validation, idempotency, missing-locale
 * detection) is verified without network I/O.
 */

export const KB_LOCALES = [
  'en', 'hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa', 'or', 'as',
] as const;

export type KbLocale = (typeof KB_LOCALES)[number];

/** Locales where we have native-speaker review infra today. */
export const REVIEWABLE_LOCALES: readonly KbLocale[] = ['hi', 'ta', 'te', 'bn'];

const LOCALE_NAMES: Record<KbLocale, string> = {
  en: 'English',
  hi: 'Hindi',
  ta: 'Tamil',
  te: 'Telugu',
  bn: 'Bengali',
  mr: 'Marathi',
  gu: 'Gujarati',
  kn: 'Kannada',
  ml: 'Malayalam',
  pa: 'Punjabi',
  or: 'Odia',
  as: 'Assamese',
};

export type Translator = (
  payload: Record<string, unknown>,
  targetLocale: KbLocale,
  localeName: string,
) => Promise<Record<string, unknown>>;

export interface Cli {
  locales: KbLocale[];
  tables: Set<string> | null;
  force: boolean;
  dryRun: boolean;
  model: string;
}

export function parseArgv(argv: string[]): Cli {
  const cli: Cli = {
    locales: KB_LOCALES.filter((l) => l !== 'en'),
    tables: null,
    force: false,
    dryRun: false,
    model: 'gpt-4o',
  };
  for (const arg of argv) {
    if (arg === '--force') cli.force = true;
    else if (arg === '--dry-run') cli.dryRun = true;
    else if (arg.startsWith('--locales=')) {
      const raw = arg.slice('--locales='.length).split(',').map((s) => s.trim()).filter(Boolean);
      const valid = raw.filter((l): l is KbLocale => (KB_LOCALES as readonly string[]).includes(l));
      if (valid.length !== raw.length) {
        const bad = raw.filter((l) => !(KB_LOCALES as readonly string[]).includes(l));
        throw new Error(`Unknown locales: ${bad.join(', ')}. Valid: ${KB_LOCALES.join(', ')}`);
      }
      cli.locales = valid;
    } else if (arg.startsWith('--tables=')) {
      cli.tables = new Set(arg.slice('--tables='.length).split(',').map((s) => s.trim()).filter(Boolean));
    } else if (arg.startsWith('--model=')) {
      cli.model = arg.slice('--model='.length);
    } else if (arg === '--help' || arg === '-h') {
      console.log(
        `backfill-locales — fill missing Kb* seed translations via LLM\n\n` +
        `  --locales=<l1,l2,..>  Limit to these locales (default: non-en)\n` +
        `  --tables=<t1,t2,..>   Limit to these table files (default: all)\n` +
        `  --force               Re-translate even if already present\n` +
        `  --dry-run             Report what would change, no writes\n` +
        `  --model=<id>          OpenAI model id (default: gpt-4o)\n`,
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown arg: ${arg}. Pass --help for usage.`);
    }
  }
  return cli;
}

export interface BackfillRow {
  key: string;
  tradition: string | null;
  i18n: Record<string, Record<string, unknown>>;
}

export interface BackfillOptions {
  rows: BackfillRow[];
  locales: KbLocale[];
  force: boolean;
  translator: Translator;
  logPrefix: string;
  reviewableLocales: readonly KbLocale[];
}

/**
 * Fill missing locale entries on every row of a table.
 *
 * Mutates `rows` in place. Returns the count of locale entries filled
 * and the total row count (for summary logging by the caller).
 */
export async function backfillTable(opts: BackfillOptions): Promise<{ filled: number; rows: number }> {
  let filled = 0;
  for (const row of opts.rows) {
    const enPayload = row.i18n.en;
    if (!enPayload) {
      console.warn(`[${opts.logPrefix}] ${row.key} has no 'en' payload, skipping`);
      continue;
    }
    const enShape = shapeOf(enPayload);
    for (const locale of opts.locales) {
      if (locale === 'en') continue;
      const existing = row.i18n[locale];
      if (!opts.force) {
        if (existing && shapeOf(existing) === enShape && !hasEmpty(existing)) {
          continue;
        }
      }
      try {
        const translated = await opts.translator(enPayload, locale, LOCALE_NAMES[locale]);
        const sealed = mergeTranslated(enPayload, translated, existing);
        const translatedShape = shapeOf(sealed);
        if (translatedShape !== enShape) {
          console.warn(`[${opts.logPrefix}] ${row.key}/${locale}: shape drift ` +
                       `(en=${enShape}, got=${translatedShape}); keeping original`);
          continue;
        }
        row.i18n[locale] = sealed as Record<string, unknown>;
        filled++;
        console.log(`[${opts.logPrefix}] ${row.key}/${locale} ok`);
      } catch (err) {
        console.warn(`[${opts.logPrefix}] ${row.key}/${locale}: ${(err as Error).message}`);
      }
    }
  }
  return { filled, rows: opts.rows.length };
}

/**
 * Merge translator output with the English payload. Keys the translator
 * dropped fall back to English so the row shape is preserved even when
 * the model under-returns.
 */
function mergeTranslated(
  en: Record<string, unknown>,
  translated: Record<string, unknown>,
  existing: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(existing ?? {}) };
  for (const [key, enValue] of Object.entries(en)) {
    const tValue = translated[key];
    if (Array.isArray(enValue)) {
      if (Array.isArray(tValue) && tValue.length === enValue.length && tValue.every((v) => typeof v === 'string' && v.trim())) {
        out[key] = tValue;
      } else {
        out[key] = enValue;
      }
    } else if (typeof enValue === 'string') {
      out[key] = typeof tValue === 'string' && tValue.trim() ? tValue : enValue;
    } else if (typeof enValue === 'object' && enValue !== null) {
      out[key] = enValue; // nested objects aren't used in today's schema
    } else {
      out[key] = enValue;
    }
  }
  return out;
}

function shapeOf(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `array(${value.length})`;
  if (typeof value === 'object') {
    const keys = Object.keys(value as object).sort();
    const parts = keys.map((k) => {
      const v = (value as Record<string, unknown>)[k];
      return `${k}:${kindOf(v)}`;
    });
    return `{${parts.join(',')}}`;
  }
  return typeof value;
}

function kindOf(v: unknown): string {
  if (Array.isArray(v)) return `array(${v.length})`;
  if (v === null) return 'null';
  return typeof v;
}

function hasEmpty(obj: Record<string, unknown>): boolean {
  for (const value of Object.values(obj)) {
    if (value == null) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
  }
  return false;
}
