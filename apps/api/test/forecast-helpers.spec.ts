/**
 * Phase 4 forecast helpers — pure math, no Prisma. We pin the numbers
 * for:
 *   1. Holt smoothing — reasonable seeding, non-negative forecasts,
 *      residual std computed correctly.
 *   2. Linear trend — slope on a perfect line is exact, flat series
 *      returns 0.
 *   3. `daysUntilLimit` — positive slope gives a finite answer,
 *      non-positive gives Infinity.
 */
import {
  holtForecast,
  linearTrend,
  daysUntilLimit,
} from '../src/forecast/forecast-helpers';

describe('holtForecast', () => {
  it('returns all zeros for an empty series', () => {
    const res = holtForecast([], 5);
    expect(res.forecast).toEqual([0, 0, 0, 0, 0]);
    expect(res.level).toBe(0);
    expect(res.trend).toBe(0);
    expect(res.residualStd).toBe(0);
  });

  it('flat-lines a single-point series', () => {
    const res = holtForecast([10], 3);
    expect(res.forecast).toEqual([10, 10, 10]);
    expect(res.level).toBe(10);
    expect(res.trend).toBe(0);
  });

  it('extrapolates an increasing trend forward', () => {
    // Linear series 1..10 — Holt should pick up a trend near +1 per day
    // and the forecast should keep climbing.
    const series = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const res = holtForecast(series, 5);
    expect(res.forecast).toHaveLength(5);
    // Each forecast point should be strictly larger than the previous.
    for (let i = 1; i < res.forecast.length; i++) {
      expect(res.forecast[i]).toBeGreaterThan(res.forecast[i - 1]);
    }
    // Trend should be near 1 (the true slope) — allow some smoothing slop.
    expect(res.trend).toBeGreaterThan(0.5);
    expect(res.trend).toBeLessThan(1.5);
  });

  it('clips negative forecasts at zero', () => {
    // A steeply descending series would project into negatives; the
    // helper must clamp because a cost series can't be negative.
    const series = [100, 80, 60, 40, 20, 10];
    const res = holtForecast(series, 10);
    expect(res.forecast.every((v) => v >= 0)).toBe(true);
  });

  it('produces a non-zero residual std for a noisy series', () => {
    const noisy = [5, 6, 5, 7, 5, 8, 5, 9];
    const res = holtForecast(noisy, 3);
    expect(res.residualStd).toBeGreaterThan(0);
  });
});

describe('linearTrend', () => {
  it('computes exact slope on a perfect line', () => {
    const { slope, intercept } = linearTrend([0, 10, 20, 30, 40]);
    expect(slope).toBeCloseTo(10, 5);
    expect(intercept).toBeCloseTo(0, 5);
  });

  it('handles a flat series with slope 0', () => {
    const { slope } = linearTrend([5, 5, 5, 5, 5]);
    expect(slope).toBe(0);
  });

  it('handles a single-point series without throwing', () => {
    const { slope, intercept } = linearTrend([42]);
    expect(slope).toBe(0);
    expect(intercept).toBe(42);
  });

  it('handles an empty series', () => {
    const { slope, intercept } = linearTrend([]);
    expect(slope).toBe(0);
    expect(intercept).toBe(0);
  });
});

describe('daysUntilLimit', () => {
  it('divides the headroom by the slope', () => {
    // current 100, slope 10/day, limit 500 → (500-100)/10 = 40
    expect(daysUntilLimit(100, 10, 500)).toBe(40);
  });

  it('returns Infinity for zero slope', () => {
    expect(daysUntilLimit(100, 0, 500)).toBe(Infinity);
  });

  it('returns Infinity for a descending series', () => {
    expect(daysUntilLimit(100, -5, 500)).toBe(Infinity);
  });

  it('returns 0 when already over limit', () => {
    expect(daysUntilLimit(600, 5, 500)).toBe(0);
  });
});
