/**
 * "Show Your Work" factor extraction. Pure functions — no Prisma, no mocks.
 * These guard the deterministic mapping from chart data → transparency
 * factors so the user-facing "why this reading" list stays stable.
 */
import {
  buildKundliFactors,
  buildDoshaFactors,
  ChartFactor,
} from '../src/modules/astrology/factors.util';

const byCode = (factors: ChartFactor[], code: string) => factors.find((f) => f.code === code);

describe('buildKundliFactors', () => {
  it('flags exalted and debilitated dignities with the right contribution', () => {
    const factors = buildKundliFactors({
      planetaryPositions: [
        { planet: 'Sun', sign: 'Aries', house: 10, status: 'Exalted' },
        { planet: 'Saturn', sign: 'Aries', house: 4, status: 'Debilitated' },
        { planet: 'Mercury', sign: 'Gemini', house: 3, status: 'Friendly' }, // omitted
      ],
    });

    const sun = byCode(factors, 'planet.Sun.exalted');
    expect(sun?.contribution).toBe('positive');
    expect(sun?.label).toContain('Aries');
    expect(sun?.label).toContain('House 10');

    expect(byCode(factors, 'planet.Saturn.debilitated')?.contribution).toBe('negative');
    // Common relational dignities are intentionally not surfaced.
    expect(factors.some((f) => f.code.startsWith('planet.Mercury'))).toBe(false);
  });

  it('emits a negative factor for combust planets', () => {
    const factors = buildKundliFactors({
      planetaryPositions: [{ planet: 'Mercury', sign: 'Leo', house: 1, isCombust: true }],
    });
    const combust = byCode(factors, 'planet.Mercury.combust');
    expect(combust?.contribution).toBe('negative');
    expect(combust?.source).toBe('planet');
  });

  it('maps yoga effect to contribution and carries the description', () => {
    const factors = buildKundliFactors({
      yogas: [
        { name: 'Gaja Kesari', description: 'Jupiter in kendra from Moon.', effect: 'benefic' },
        { name: 'Kemadruma', description: 'Moon isolated.', effect: 'malefic' },
        { name: 'Budhaditya', description: 'Sun with Mercury.', effect: 'neutral' },
      ],
    });
    expect(byCode(factors, 'yoga.Gaja_Kesari')?.contribution).toBe('positive');
    expect(byCode(factors, 'yoga.Gaja_Kesari')?.detail).toBe('Jupiter in kendra from Moon.');
    expect(byCode(factors, 'yoga.Kemadruma')?.contribution).toBe('negative');
    expect(byCode(factors, 'yoga.Budhaditya')?.contribution).toBe('neutral');
  });

  it('resolves the active mahadasha against an injected clock', () => {
    const dashas = [
      { planet: 'Sun', startDate: '2010-01-01', endDate: '2016-01-01' },
      { planet: 'Moon', startDate: '2016-01-01', endDate: '2026-01-01' },
      { planet: 'Mars', startDate: '2026-01-01', endDate: '2033-01-01' },
    ];
    const factors = buildKundliFactors({ dashas }, new Date('2020-06-15'));
    const active = byCode(factors, 'dasha.active.Moon');
    expect(active).toBeDefined();
    expect(active?.contribution).toBe('neutral');
    // Only the containing period is surfaced.
    expect(factors.filter((f) => f.source === 'dasha')).toHaveLength(1);
  });

  it('skips malformed dasha dates without throwing', () => {
    const factors = buildKundliFactors(
      { dashas: [{ planet: 'Rahu', startDate: 'not-a-date', endDate: 'also-bad' }] },
      new Date('2020-01-01'),
    );
    expect(factors.filter((f) => f.source === 'dasha')).toHaveLength(0);
  });

  it('returns an empty list for an empty chart', () => {
    expect(buildKundliFactors({})).toEqual([]);
  });
});

describe('buildDoshaFactors', () => {
  it('surfaces only present doshas, with severity in the label', () => {
    const factors = buildDoshaFactors([
      { name: 'Mangal Dosha', present: true, severity: 'severe', description: 'Mars in 7th.' },
      { name: 'Kaal Sarp Dosha', present: false, severity: 'none', description: 'Not present.' },
    ]);
    expect(factors).toHaveLength(1);
    expect(factors[0].code).toBe('dosha.Mangal_Dosha');
    expect(factors[0].label).toBe('Mangal Dosha (severe)');
    expect(factors[0].contribution).toBe('negative');
    expect(factors[0].detail).toBe('Mars in 7th.');
  });

  it('omits the severity suffix when severity is none', () => {
    const factors = buildDoshaFactors([
      { name: 'Pitra Dosha', present: true, severity: 'none', description: 'Sun with Rahu.' },
    ]);
    expect(factors[0].label).toBe('Pitra Dosha');
  });

  it('handles undefined input', () => {
    expect(buildDoshaFactors(undefined)).toEqual([]);
  });
});
