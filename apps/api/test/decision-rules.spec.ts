/**
 * Decision Room scoring core. Pure functions — no Prisma, no ephemeris, no
 * clock. These guard the deterministic electional verdict + its "Show Your
 * Work" factor list so the same moment always scores the same way.
 */
import {
  scoreTiming,
  rahuKaalWindow,
  formatMinutes,
  tithiLabel,
  DECISION_ACTIVITIES,
  PanchangSnapshot,
  DecisionActivity,
} from '../src/modules/astrology/decision-rules';
import { ChartFactor } from '../src/modules/astrology/factors.util';

/**
 * A benign baseline snapshot: Thursday, Shukla Dashami, Moon in Pushya, Siddhi
 * yoga, 10:00 AM well clear of a late-afternoon Rahu Kaal. Override per test.
 */
function makeSnapshot(overrides: Partial<PanchangSnapshot> = {}): PanchangSnapshot {
  return {
    weekday: 4, // Thursday
    tithiIndex: 9, // Shukla Dashami (not Rikta)
    nakshatraIndex: 7, // Pushya
    yogaIndex: 15, // Siddhi (auspicious)
    tithiName: 'Shukla Dashami',
    nakshatraName: 'Pushya',
    yogaName: 'Siddhi',
    varaName: 'Guruvaar',
    timeMinutes: 600, // 10:00 AM
    rahuKaal: { startMinutes: 810, endMinutes: 900 }, // 13:30–15:00
    ...overrides,
  };
}

const byCode = (factors: ChartFactor[], code: string) => factors.find((f) => f.code === code);

describe('scoreTiming', () => {
  it('returns an excellent verdict when weekday, yoga and Rahu Kaal all align', () => {
    const result = scoreTiming('marriage', makeSnapshot());
    // 60 base + 8 (Thu favours marriage) + 8 (Siddhi yoga) + 5 (clear of Rahu Kaal) = 81
    expect(result.score).toBe(81);
    expect(result.recommendation).toBe('excellent');
    expect(result.activity).toBe('marriage');
  });

  it('returns an avoid verdict when every factor is adverse', () => {
    const result = scoreTiming(
      'marriage',
      makeSnapshot({
        weekday: 2, // Tuesday — cautioned for marriage (-8)
        tithiIndex: 8, // Navami — Rikta (-10)
        nakshatraIndex: 5, // Ardra — not favourable
        yogaIndex: 8, // Shoola — inauspicious (-10)
        tithiName: 'Shukla Navami',
        nakshatraName: 'Ardra',
        yogaName: 'Shoola',
        varaName: 'Mangalvaar',
        timeMinutes: 840, // 14:00, inside Rahu Kaal (-20)
      }),
    );
    // 60 - 8 - 10 - 10 - 20 = 12
    expect(result.score).toBe(12);
    expect(result.recommendation).toBe('avoid');
  });

  it('penalises a chosen time that falls inside Rahu Kaal', () => {
    const inside = scoreTiming('general', makeSnapshot({ timeMinutes: 840 }));
    const clear = scoreTiming('general', makeSnapshot({ timeMinutes: 600 }));
    expect(byCode(inside.factors, 'panchang.rahukaal.inside')?.contribution).toBe('negative');
    expect(byCode(clear.factors, 'panchang.rahukaal.clear')?.contribution).toBe('positive');
    expect(clear.score).toBeGreaterThan(inside.score);
  });

  it('treats Rahu Kaal as neutral context for a date-only query (no time)', () => {
    const result = scoreTiming('general', makeSnapshot({ timeMinutes: null }));
    const f = byCode(result.factors, 'panchang.rahukaal.window');
    expect(f?.contribution).toBe('neutral');
    expect(f?.label).toContain('Rahu Kaal');
    expect(byCode(result.factors, 'panchang.rahukaal.inside')).toBeUndefined();
    expect(byCode(result.factors, 'panchang.rahukaal.clear')).toBeUndefined();
  });

  it('flags Amavasya as a strong negative and Purnima as a positive', () => {
    const amavasya = scoreTiming('general', makeSnapshot({ tithiIndex: 29, tithiName: 'Amavasya' }));
    expect(byCode(amavasya.factors, 'panchang.tithi.amavasya')?.contribution).toBe('negative');

    const purnima = scoreTiming('general', makeSnapshot({ tithiIndex: 14, tithiName: 'Purnima' }));
    expect(byCode(purnima.factors, 'panchang.tithi.purnima')?.contribution).toBe('positive');
    expect(purnima.score).toBeGreaterThan(amavasya.score);
  });

  it('flags Rikta tithis (4th, 9th, 14th of a paksha) in either paksha', () => {
    for (const tithiIndex of [3, 8, 13, 18, 23, 28]) {
      const result = scoreTiming('general', makeSnapshot({ tithiIndex, tithiName: 'X' }));
      expect(byCode(result.factors, `panchang.tithi.rikta.${tithiIndex}`)?.contribution).toBe('negative');
    }
  });

  it('rewards an activity-favourable nakshatra', () => {
    // Rohini (index 3) is favourable for marriage but not specifically rewarded for "general".
    const marriage = scoreTiming('marriage', makeSnapshot({ nakshatraIndex: 3, nakshatraName: 'Rohini' }));
    expect(byCode(marriage.factors, 'panchang.nakshatra.3.favourable')?.contribution).toBe('positive');

    const general = scoreTiming('general', makeSnapshot({ nakshatraIndex: 3, nakshatraName: 'Rohini' }));
    expect(byCode(general.factors, 'panchang.nakshatra.3.favourable')).toBeUndefined();
    expect(byCode(general.factors, 'panchang.nakshatra.3')?.contribution).toBe('neutral');
  });

  it('clamps the score to the 0–100 range', () => {
    // Stack every penalty: cautioned weekday + Rikta + inauspicious yoga + inside Rahu Kaal.
    const worst = scoreTiming(
      'travel',
      makeSnapshot({
        weekday: 6,
        tithiIndex: 13,
        yogaIndex: 0,
        timeMinutes: 840,
        nakshatraIndex: 5,
      }),
    );
    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.score).toBeLessThanOrEqual(100);
  });

  it('is deterministic — identical input yields identical output', () => {
    const a = scoreTiming('business', makeSnapshot());
    const b = scoreTiming('business', makeSnapshot());
    expect(a).toEqual(b);
  });

  it('produces a verdict and factor list for every supported activity', () => {
    for (const activity of DECISION_ACTIVITIES) {
      const result = scoreTiming(activity as DecisionActivity, makeSnapshot());
      expect(result.factors.length).toBeGreaterThan(0);
      expect(['excellent', 'good', 'neutral', 'caution', 'avoid']).toContain(result.recommendation);
      // Every factor is tagged as a panchang-sourced reason.
      expect(result.factors.every((f) => f.source === 'panchang')).toBe(true);
    }
  });
});

describe('rahuKaalWindow', () => {
  it('places Monday Rahu Kaal in the 2nd eighth of the day', () => {
    // Sunrise 06:00 (360), sunset 18:00 (1080) → each part = 90 min. Monday = 2nd part.
    const w = rahuKaalWindow(1, 360, 1080);
    expect(w.startMinutes).toBe(450); // 07:30
    expect(w.endMinutes).toBe(540); // 09:00
  });

  it('places Sunday Rahu Kaal in the final eighth of the day', () => {
    const w = rahuKaalWindow(0, 360, 1080);
    expect(w.startMinutes).toBe(990); // 16:30
    expect(w.endMinutes).toBe(1080); // 18:00
  });
});

describe('formatMinutes', () => {
  it('formats minutes-after-midnight as a 12-hour clock', () => {
    expect(formatMinutes(0)).toBe('12:00 AM');
    expect(formatMinutes(90)).toBe('1:30 AM');
    expect(formatMinutes(720)).toBe('12:00 PM');
    expect(formatMinutes(870)).toBe('2:30 PM');
  });
});

describe('tithiLabel', () => {
  // Mirrors the 15-entry Pratipada…Purnima canonical table the service passes.
  const NAMES = [
    'Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami',
    'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi', 'Purnima',
  ];

  it('labels the New Moon (index 29) as Amavasya, not "Krishna Purnima"', () => {
    expect(tithiLabel(29, NAMES)).toBe('Amavasya');
  });

  it('labels the Full Moon (index 14) as Shukla Purnima', () => {
    expect(tithiLabel(14, NAMES)).toBe('Shukla Purnima');
  });

  it('prefixes the paksha for ordinary tithis in both halves', () => {
    expect(tithiLabel(0, NAMES)).toBe('Shukla Pratipada');
    expect(tithiLabel(9, NAMES)).toBe('Shukla Dashami');
    expect(tithiLabel(15, NAMES)).toBe('Krishna Pratipada'); // 15 % 15 = 0
    expect(tithiLabel(23, NAMES)).toBe('Krishna Navami'); // 23 % 15 = 8
  });
});
