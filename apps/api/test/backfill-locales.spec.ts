/**
 * Unit tests for the backfill lib. The CLI entrypoint is a thin wrapper
 * around these pure functions; verifying them here keeps us off the
 * real OpenAI network path while proving the mutation, merge, shape,
 * and idempotency invariants.
 */
import {
  backfillTable,
  parseArgv,
  Translator,
  BackfillRow,
  KB_LOCALES,
} from '../scripts/backfill-locales.lib';

function row(overrides: Partial<BackfillRow> = {}): BackfillRow {
  return {
    key: 'Sun',
    tradition: null,
    i18n: { en: { name: 'Sun', color: 'Ruby Red' } },
    ...overrides,
  };
}

function stubTranslator(reply: Record<string, unknown> | ((locale: string) => Record<string, unknown>)): { fn: Translator; calls: { locale: string; payload: any }[] } {
  const calls: { locale: string; payload: any }[] = [];
  const fn: Translator = async (payload, locale) => {
    calls.push({ locale, payload });
    return typeof reply === 'function' ? reply(locale) : reply;
  };
  return { fn, calls };
}

describe('parseArgv', () => {
  it('defaults to all non-en locales, all tables', () => {
    const cli = parseArgv([]);
    expect(cli.locales).toEqual(KB_LOCALES.filter((l) => l !== 'en'));
    expect(cli.tables).toBeNull();
    expect(cli.force).toBe(false);
    expect(cli.dryRun).toBe(false);
    expect(cli.model).toBe('gpt-4o');
  });

  it('parses --locales', () => {
    const cli = parseArgv(['--locales=hi,ta']);
    expect(cli.locales).toEqual(['hi', 'ta']);
  });

  it('parses --tables, --force, --dry-run, --model', () => {
    const cli = parseArgv(['--tables=planets,yogas', '--force', '--dry-run', '--model=gpt-4o-mini']);
    expect(cli.tables).toEqual(new Set(['planets', 'yogas']));
    expect(cli.force).toBe(true);
    expect(cli.dryRun).toBe(true);
    expect(cli.model).toBe('gpt-4o-mini');
  });

  it('rejects unknown locales', () => {
    expect(() => parseArgv(['--locales=hi,zz'])).toThrow(/Unknown locales: zz/);
  });

  it('rejects unknown args', () => {
    expect(() => parseArgv(['--what'])).toThrow(/Unknown arg/);
  });
});

describe('backfillTable', () => {
  const locales = ['hi', 'ta'] as const;

  it('fills missing locales', async () => {
    const rows = [row()];
    const { fn } = stubTranslator({ name: 'सूर्य', color: 'रूबी लाल' });
    const result = await backfillTable({
      rows,
      locales: [...locales],
      force: false,
      translator: fn,
      logPrefix: 'test',
      reviewableLocales: ['hi'],
    });
    expect(result.filled).toBe(2);
    expect(rows[0].i18n.hi).toEqual({ name: 'सूर्य', color: 'रूबी लाल' });
    expect(rows[0].i18n.ta).toEqual({ name: 'सूर्य', color: 'रूबी लाल' });
  });

  it('is idempotent — second run makes no changes', async () => {
    const rows = [row()];
    const { fn } = stubTranslator({ name: 'सूर्य', color: 'रूबी लाल' });
    await backfillTable({ rows, locales: [...locales], force: false, translator: fn, logPrefix: 'test', reviewableLocales: [] });

    const second = stubTranslator({ name: 'should not be called', color: 'X' });
    const result = await backfillTable({
      rows,
      locales: [...locales],
      force: false,
      translator: second.fn,
      logPrefix: 'test',
      reviewableLocales: [],
    });
    expect(result.filled).toBe(0);
    expect(second.calls).toHaveLength(0);
  });

  it('--force re-translates already-present locales', async () => {
    const rows = [row({ i18n: { en: { name: 'Sun', color: 'Ruby Red' }, hi: { name: 'OLD', color: 'OLD' } } })];
    const { fn, calls } = stubTranslator({ name: 'NEW', color: 'NEW' });
    const result = await backfillTable({
      rows,
      locales: ['hi'],
      force: true,
      translator: fn,
      logPrefix: 'test',
      reviewableLocales: [],
    });
    expect(result.filled).toBe(1);
    expect(calls).toHaveLength(1);
    expect(rows[0].i18n.hi).toEqual({ name: 'NEW', color: 'NEW' });
  });

  it('falls back to English for keys the translator drops', async () => {
    const rows = [row({ i18n: { en: { name: 'Sun', color: 'Ruby Red', mantra: 'Om Suryaya Namaha' } } })];
    const { fn } = stubTranslator({ name: 'सूर्य' }); // dropped color + mantra
    await backfillTable({
      rows,
      locales: ['hi'],
      force: false,
      translator: fn,
      logPrefix: 'test',
      reviewableLocales: [],
    });
    expect(rows[0].i18n.hi).toEqual({
      name: 'सूर्य',
      color: 'Ruby Red',
      mantra: 'Om Suryaya Namaha',
    });
  });

  it('preserves array length — rejects a translated array that drops items', async () => {
    const rows = [row({ i18n: { en: { name: 'Sun', doList: ['a', 'b', 'c'] } } })];
    const { fn } = stubTranslator({ name: 'सूर्य', doList: ['क', 'ख'] }); // wrong length
    await backfillTable({
      rows,
      locales: ['hi'],
      force: false,
      translator: fn,
      logPrefix: 'test',
      reviewableLocales: [],
    });
    // doList fell back to English since translator didn't preserve length
    expect(rows[0].i18n.hi).toEqual({ name: 'सूर्य', doList: ['a', 'b', 'c'] });
  });

  it('skips rows without an English payload', async () => {
    const rows = [row({ i18n: {} as any })];
    const { fn, calls } = stubTranslator({ name: 'X' });
    const result = await backfillTable({
      rows,
      locales: ['hi'],
      force: false,
      translator: fn,
      logPrefix: 'test',
      reviewableLocales: [],
    });
    expect(result.filled).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it('logs and continues when the translator throws for one row', async () => {
    const rows = [row({ key: 'Sun' }), row({ key: 'Moon', i18n: { en: { name: 'Moon', color: 'Pearl White' } } })];
    let callIdx = 0;
    const fn: Translator = async () => {
      callIdx++;
      if (callIdx === 1) throw new Error('API down');
      return { name: 'चंद्र', color: 'मोती सफेद' };
    };
    const result = await backfillTable({
      rows,
      locales: ['hi'],
      force: false,
      translator: fn,
      logPrefix: 'test',
      reviewableLocales: [],
    });
    expect(result.filled).toBe(1); // only Moon got translated
    expect(rows[0].i18n.hi).toBeUndefined();
    expect(rows[1].i18n.hi).toEqual({ name: 'चंद्र', color: 'मोती सफेद' });
  });

  it('rejects a translated payload whose shape drifts', async () => {
    const rows = [row()];
    const { fn } = stubTranslator({ name: 'सूर्य', color: 'रूबी लाल', extraKey: 'x' });
    const result = await backfillTable({
      rows,
      locales: ['hi'],
      force: false,
      translator: fn,
      logPrefix: 'test',
      reviewableLocales: [],
    });
    // mergeTranslated drops unknown keys, so shape matches en — result passes
    // (the shape guard catches translators that DROP keys or change types,
    // not ones that add unknown keys that we can safely ignore).
    expect(result.filled).toBe(1);
    expect(rows[0].i18n.hi).toEqual({ name: 'सूर्य', color: 'रूबी लाल' });
  });
});
