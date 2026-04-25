/**
 * MRR / MoM / projection helpers. Pure functions — no Prisma, no mocks.
 * Pinned here so the pricing configuration math stays stable when
 * other parts of StatsService change.
 */
import {
  computeMrrUsd,
  computeMomDelta,
  projectMrrSixMonths,
} from '../src/stats/stats.service';

describe('computeMrrUsd', () => {
  const pricing = [
    { key: 'pricing.monthly.price', value: '499' },
    { key: 'pricing.annual.price',  value: '4999' },
    { key: 'pricing.fx.inr_to_usd', value: '0.012' },
  ];

  it('blends MONTHLY and ANNUAL plans into one USD figure', () => {
    const subs = [
      { plan: 'MONTHLY', _count: { _all: 10 } },
      { plan: 'ANNUAL',  _count: { _all: 2 } },
    ];
    // 10 × 499 + 2 × (4999 / 12) = 4990 + 833.1666… = 5823.1666… INR
    // × 0.012 = 69.878 USD → rounds to 69.88 at 2-decimal precision.
    expect(computeMrrUsd(subs, pricing)).toBeCloseTo(69.88, 2);
  });

  it('returns 0 when there are no active subscriptions', () => {
    expect(computeMrrUsd([], pricing)).toBe(0);
  });

  it('ignores FREE plan rows', () => {
    const subs = [
      { plan: 'FREE', _count: { _all: 1000 } },
      { plan: 'MONTHLY', _count: { _all: 1 } },
    ];
    // 1 * 499 * 0.012 = 5.99
    expect(computeMrrUsd(subs, pricing)).toBeCloseTo(5.99, 2);
  });

  it('falls back to a default FX rate when the setting is missing', () => {
    const subs = [{ plan: 'MONTHLY', _count: { _all: 1 } }];
    const res = computeMrrUsd(subs, [
      { key: 'pricing.monthly.price', value: '499' },
    ]);
    // 499 * 0.012 (default) = 5.988 → 5.99
    expect(res).toBeCloseTo(5.99, 2);
  });
});

describe('computeMomDelta', () => {
  it('returns 0 when prior MRR is zero (bootstrap)', () => {
    expect(computeMomDelta(100, 0)).toBe(0);
  });
  it('computes positive growth as a fraction', () => {
    expect(computeMomDelta(120, 100)).toBeCloseTo(0.2, 4);
  });
  it('computes negative growth as a fraction', () => {
    expect(computeMomDelta(80, 100)).toBeCloseTo(-0.2, 4);
  });
});

describe('projectMrrSixMonths', () => {
  it('compounds the monthly growth rate six times', () => {
    // 100 * 1.1^6 = 177.16
    expect(projectMrrSixMonths(100, 0.1)).toBeCloseTo(177.16, 2);
  });
  it('clips to zero for unrealistic negative runs', () => {
    expect(projectMrrSixMonths(100, -2)).toBe(0);
  });
});
