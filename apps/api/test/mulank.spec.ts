import {
  computeMulank,
  computeBhagyank,
  reduceWithSteps,
  relationship,
  buildMulankReading,
  MULANK_INTERNALS,
  Digit,
  CompatRating,
} from '../src/modules/numerology/mulank';

// ── Independent reference implementations (do NOT call the module under test) ──
// Used to cross-check the engine so the test isn't just asserting the impl
// against itself.

function refDigitSum(n: number): number {
  return String(Math.abs(n))
    .split('')
    .reduce((s, d) => s + Number(d), 0);
}
function refReduce(n: number): number {
  let x = Math.abs(n);
  while (x > 9) x = refDigitSum(x);
  return x === 0 ? 9 : x;
}
/** Full-date-string digit sum reduced to 1–9 — the canonical Bhagyank. */
function refBhagyank(day: number, month: number, year: number): number {
  const all = `${day}${month}${year}`;
  return refReduce(all.split('').reduce((s, d) => s + Number(d), 0));
}

const DIGITS: Digit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

describe('Mulank engine — reduction & calculation', () => {
  describe('reduceWithSteps', () => {
    it('reduces every value 1..200 to a single digit 1–9 matching the reference', () => {
      for (let n = 1; n <= 200; n++) {
        const step = reduceWithSteps(n);
        expect(step.value).toBe(refReduce(n));
        expect(step.value).toBeGreaterThanOrEqual(1);
        expect(step.value).toBeLessThanOrEqual(9);
      }
    });

    it('keeps 9 and multiples of 9 as 9 (never 0)', () => {
      for (const n of [9, 18, 27, 36, 81, 99, 108]) {
        expect(reduceWithSteps(n).value).toBe(9);
      }
    });

    it('records master numbers 11, 22, 33 passed through during reduction', () => {
      expect(reduceWithSteps(11).master).toBe(11);
      expect(reduceWithSteps(29).master).toBe(11); // 29 → 11 → 2
      expect(reduceWithSteps(22).master).toBe(22);
      expect(reduceWithSteps(33).master).toBe(33);
      expect(reduceWithSteps(15).master).toBeUndefined();
    });

    it('builds a human-readable reduction expression', () => {
      expect(reduceWithSteps(29).expression).toBe('29 → 2 + 9 = 11 → 1 + 1 = 2');
      expect(reduceWithSteps(7).expression).toBe('7');
    });
  });

  describe('computeMulank (day of month → 1–9)', () => {
    // Exhaustive: every legal day 1..31 against the reference reducer.
    it('matches the reference for all days 1..31', () => {
      for (let day = 1; day <= 31; day++) {
        expect(computeMulank(day).value).toBe(refReduce(day));
      }
    });

    it('pins well-known cases', () => {
      const cases: Record<number, Digit> = {
        1: 1, 9: 9, 10: 1, 18: 9, 19: 1, 28: 1, 29: 2, 30: 3, 31: 4,
      };
      for (const [day, expected] of Object.entries(cases)) {
        expect(computeMulank(Number(day)).value).toBe(expected);
      }
    });
  });

  describe('computeBhagyank (full date → 1–9)', () => {
    it('matches the canonical full-digit-sum for a spread of dates', () => {
      const dates: [number, number, number][] = [
        [15, 8, 1990], [1, 1, 2000], [15, 8, 1947], [31, 12, 2023],
        [29, 2, 2000], [7, 7, 1977], [25, 12, 1989], [3, 11, 2011],
      ];
      for (const [d, m, y] of dates) {
        expect(computeBhagyank(d, m, y).value).toBe(refBhagyank(d, m, y));
      }
    });

    it('pins documented examples', () => {
      // 15-08-1990 → 1+5+0+8+1+9+9+0 = 33 → 6 (master 33)
      const a = computeBhagyank(15, 8, 1990);
      expect(a.value).toBe(6);
      expect(a.master).toBe(33);
      // 15-08-1947 → 35 → 8
      expect(computeBhagyank(15, 8, 1947).value).toBe(8);
      // 01-01-2000 → 4
      expect(computeBhagyank(1, 1, 2000).value).toBe(4);
    });

    it('is grouping-independent (sum-of-parts == sum-of-all-digits)', () => {
      for (let y = 1980; y <= 2024; y += 7) {
        for (let m = 1; m <= 12; m += 3) {
          for (const d of [1, 9, 15, 28, 31]) {
            expect(computeBhagyank(d, m, y).value).toBe(refBhagyank(d, m, y));
          }
        }
      }
    });
  });
});

describe('Mulank engine — compatibility relation', () => {
  it('is symmetric for every pair', () => {
    for (const a of DIGITS) {
      for (const b of DIGITS) {
        expect(relationship(a, b)).toBe(relationship(b, a));
      }
    }
  });

  it('rates a number against itself as best', () => {
    for (const a of DIGITS) {
      expect(relationship(a, a)).toBe('best');
    }
  });

  it('categorizes every cross pair into a valid rating', () => {
    const valid: CompatRating[] = ['best', 'friend', 'neutral', 'challenging'];
    for (const a of DIGITS) {
      for (const b of DIGITS) {
        expect(valid).toContain(relationship(a, b));
      }
    }
  });

  it('never marks a pair as both friend and enemy in the source data', () => {
    const { FRIENDS, ENEMIES } = MULANK_INTERNALS;
    for (const a of DIGITS) {
      for (const b of DIGITS) {
        const bothFriend = FRIENDS[a].includes(b) || FRIENDS[b].includes(a);
        const bothEnemy = ENEMIES[a].includes(b) || ENEMIES[b].includes(a);
        // A pair may be mixed (→ neutral), but a single direction must not list
        // the same pair as friend AND enemy.
        expect(FRIENDS[a].includes(b) && ENEMIES[a].includes(b)).toBe(false);
        // sanity: the symmetric reading agrees with the derived rating
        if (a !== b) {
          const r = relationship(a, b);
          if (bothFriend && !bothEnemy) expect(r).toBe('friend');
          if (bothEnemy && !bothFriend) expect(r).toBe('challenging');
        }
      }
    }
  });

  it('pins canonical planetary relationships', () => {
    expect(relationship(1, 2)).toBe('friend');       // Sun–Moon
    expect(relationship(1, 8)).toBe('challenging');   // Sun–Saturn
    expect(relationship(1, 6)).toBe('challenging');   // Sun–Venus
    expect(relationship(4, 7)).toBe('friend');        // Rahu–Ketu
    expect(relationship(3, 9)).toBe('friend');        // Jupiter–Mars
    expect(relationship(6, 8)).toBe('friend');        // Venus–Saturn
    expect(relationship(9, 5)).toBe('challenging');   // Mars–Mercury
  });
});

describe('Mulank engine — buildMulankReading', () => {
  it('throws on an invalid date', () => {
    expect(() => buildMulankReading('not-a-date')).toThrow(/Invalid dateOfBirth/);
  });

  it('is fully deterministic (same input → deep-equal output)', () => {
    const a = buildMulankReading('1990-08-15');
    const b = buildMulankReading('1990-08-15');
    expect(a).toEqual(b);
  });

  it('reads the correct calendar parts regardless of server timezone', () => {
    const r = buildMulankReading('1990-08-15');
    expect(r.day).toBe(15);
    expect(r.month).toBe(8);
    expect(r.year).toBe(1990);
    expect(r.dateOfBirth).toBe('1990-08-15');
    expect(r.mulank).toBe(6);
    expect(r.bhagyank).toBe(6);
  });

  it('returns a complete, well-formed reading', () => {
    const r = buildMulankReading('1988-03-23');
    expect(r.mulank).toBeGreaterThanOrEqual(1);
    expect(r.mulank).toBeLessThanOrEqual(9);
    expect(r.bhagyank).toBeGreaterThanOrEqual(1);
    expect(r.bhagyank).toBeLessThanOrEqual(9);
    expect(r.mulankProfile.number).toBe(r.mulank);
    expect(r.bhagyankProfile.number).toBe(r.bhagyank);
    expect(r.calculation.mulank.expression).toBeTruthy();
    expect(r.calculation.bhagyank.expression).toContain('→');
    expect(r.summary).toContain('Mulank');
    expect(r.innerHarmony.note).toBeTruthy();
  });

  it('produces a compatibility row for every number 1–9, partitioned into disjoint buckets', () => {
    for (const dob of ['1990-08-15', '1991-01-01', '1985-11-09', '2000-07-07']) {
      const r = buildMulankReading(dob);
      expect(r.compatibility).toHaveLength(9);
      expect(r.compatibility.map((c) => c.number).sort()).toEqual(DIGITS);

      const union = [
        ...r.bestMatches,
        ...r.friendlyMatches,
        ...r.neutralMatches,
        ...r.challengingMatches,
      ].sort((x, y) => x - y);
      // disjoint + complete = a permutation of 1..9
      expect(union).toEqual(DIGITS);
      // the person's own number is always a "best" match (self-harmony)
      expect(r.bestMatches).toContain(r.mulank);
      // lucky numbers = best ∪ friendly
      expect(r.luckyNumbers.sort((x, y) => x - y)).toEqual(
        [...r.bestMatches, ...r.friendlyMatches].sort((x, y) => x - y),
      );
    }
  });

  it('flags single-pointed focus when Mulank equals Bhagyank', () => {
    // 1990-08-15 → mulank 6, bhagyank 6
    const r = buildMulankReading('1990-08-15');
    expect(r.mulank).toBe(r.bhagyank);
    expect(r.innerHarmony.rating).toBe('best');
    expect(r.innerHarmony.note.toLowerCase()).toContain('both');
  });

  it('carries master numbers through to the reading', () => {
    // day 29 → master 11
    const r = buildMulankReading('1995-06-29');
    expect(r.mulankMaster).toBe(11);
    expect(r.mulank).toBe(2);
  });
});

describe('Mulank engine — number profiles', () => {
  const { PROFILES } = MULANK_INTERNALS;
  const expectedPlanets: Record<Digit, string> = {
    1: 'Sun', 2: 'Moon', 3: 'Jupiter', 4: 'Rahu', 5: 'Mercury',
    6: 'Venus', 7: 'Ketu', 8: 'Saturn', 9: 'Mars',
  };

  it('defines a profile for all nine numbers with the correct ruling planet', () => {
    for (const n of DIGITS) {
      expect(PROFILES[n]).toBeDefined();
      expect(PROFILES[n].number).toBe(n);
      expect(PROFILES[n].planet).toBe(expectedPlanets[n]);
    }
  });

  it('has non-empty content in every field of every profile', () => {
    for (const n of DIGITS) {
      const p = PROFILES[n];
      for (const key of ['title', 'essence', 'personality', 'gemstone', 'metal', 'deity', 'mantra', 'direction', 'healthNote'] as const) {
        expect(typeof p[key]).toBe('string');
        expect((p[key] as string).length).toBeGreaterThan(0);
      }
      for (const key of ['strengths', 'weaknesses', 'careers', 'luckyDays', 'luckyColors', 'remedies'] as const) {
        expect(Array.isArray(p[key])).toBe(true);
        expect(p[key].length).toBeGreaterThan(0);
      }
    }
  });
});
