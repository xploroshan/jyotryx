/**
 * KB locale-coverage tracking.
 *
 * `render()` falls back to English when a row has no entry for the requested
 * locale. That is right at runtime — English beats nothing — but it made the
 * gap unmeasurable: 62 `render()` call sites, 9 using `renderStatus().matched`,
 * and no way to answer "how much of the KB exists in Tamil?" or "which rows
 * still need backfilling?". These tests pin the instrumentation AND the fact
 * that it changed no returned value.
 */
import { KbCoverageTracker } from '../src/knowledge/kb-coverage';
import { tr, trStatus } from '../src/knowledge/kb-locales';

describe('KbCoverageTracker', () => {
  let tracker: KbCoverageTracker;

  beforeEach(() => {
    tracker = new KbCoverageTracker();
  });

  it('starts empty', () => {
    const r = tracker.report();
    expect(r.totalRenders).toBe(0);
    expect(r.totalMisses).toBe(0);
    expect(r.byLocale).toEqual([]);
  });

  it('ignores English and locale-less renders (they are the baseline, not signal)', () => {
    tracker.record('en', 'mars:7', true);
    tracker.record(undefined, 'mars:7', true);
    tracker.record(null, 'mars:7', true);
    expect(tracker.report().totalRenders).toBe(0);
  });

  it('counts hits and misses per locale', () => {
    tracker.record('hi', 'mars:7', true);
    tracker.record('hi', 'venus:2', false);
    tracker.record('ta', 'mars:7', false);

    const r = tracker.report();
    expect(r.totalRenders).toBe(3);
    expect(r.totalMisses).toBe(2);

    const hi = r.byLocale.find((l) => l.locale === 'hi')!;
    expect(hi).toMatchObject({ hits: 1, misses: 1, coverage: 0.5 });

    const ta = r.byLocale.find((l) => l.locale === 'ta')!;
    expect(ta).toMatchObject({ hits: 0, misses: 1, coverage: 0 });
  });

  it('records WHICH keys are missing, so a backfill can be targeted', () => {
    tracker.record('hi', 'saturn:7', false);
    tracker.record('hi', 'jupiter:1', false);
    const hi = tracker.report().byLocale.find((l) => l.locale === 'hi')!;
    expect(hi.sampleMissingKeys).toEqual(['jupiter:1', 'saturn:7']);
  });

  it('dedupes repeated misses for the same key', () => {
    for (let i = 0; i < 10; i++) tracker.record('hi', 'saturn:7', false);
    const hi = tracker.report().byLocale.find((l) => l.locale === 'hi')!;
    expect(hi.sampleMissingKeys).toEqual(['saturn:7']);
    expect(hi.misses).toBe(10); // counter still counts every occurrence
  });

  it('bounds the key sample so an unbackfilled locale cannot grow memory', () => {
    for (let i = 0; i < 500; i++) tracker.record('ta', `key:${i}`, false);
    const r = tracker.report();
    const ta = r.byLocale.find((l) => l.locale === 'ta')!;
    expect(ta.sampleMissingKeys.length).toBeLessThanOrEqual(50);
    expect(ta.misses).toBe(500);
    expect(r.truncated).toBe(true);
  });

  it('sorts worst-covered locale first (that is where backfill effort goes)', () => {
    tracker.record('hi', 'a', true);
    tracker.record('hi', 'b', true);
    tracker.record('ta', 'a', false);
    tracker.record('ta', 'b', false);
    expect(tracker.report().byLocale[0].locale).toBe('ta');
  });

  it('is case-insensitive about locale', () => {
    tracker.record('HI', 'a', false);
    tracker.record('hi', 'b', false);
    expect(tracker.report().byLocale).toHaveLength(1);
  });

  it('reset() clears everything', () => {
    tracker.record('hi', 'a', false);
    tracker.reset();
    expect(tracker.report().totalRenders).toBe(0);
  });
});

describe('instrumentation changes no returned value', () => {
  // render() switched from tr() to trStatus().value purely to observe the
  // outcome. If those ever diverge, every localized string in the product
  // shifts — so pin the equivalence directly.
  const bag = { en: 'english', hi: 'hindi' } as any;
  const sparse = { en: 'english' } as any;

  it.each([
    ['en', bag],
    ['hi', bag],
    ['ta', bag],
    ['hi', sparse],
    ['ta', sparse],
  ])('tr and trStatus().value agree for locale=%s', (locale, b) => {
    expect(trStatus(b, locale as string).value).toBe(tr(b, locale as string));
  });

  it('agrees for null/undefined locale', () => {
    expect(trStatus(bag, null).value).toBe(tr(bag, null));
    expect(trStatus(bag, undefined).value).toBe(tr(bag, undefined));
  });

  it('matched is true only for a real locale hit', () => {
    expect(trStatus(bag, 'hi').matched).toBe(true);
    expect(trStatus(sparse, 'hi').matched).toBe(false);
    expect(trStatus(bag, 'en').matched).toBe(true);
  });
});
