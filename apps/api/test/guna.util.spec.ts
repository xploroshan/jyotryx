import { computeBhakootScore } from '../src/modules/astrology/guna.util';

describe('computeBhakootScore (Ashtakoota Bhakoot koota)', () => {
  it('is symmetric / order-independent for all 144 sign pairs', () => {
    for (let a = 0; a < 12; a++) {
      for (let b = 0; b < 12; b++) {
        expect(computeBhakootScore(a, b)).toBe(computeBhakootScore(b, a));
      }
    }
  });

  it('awards the full 7 points to identical Moon signs (1/1)', () => {
    for (let s = 0; s < 12; s++) {
      expect(computeBhakootScore(s, s)).toBe(7);
    }
  });

  it('flags only the 2/12, 5/9, 6/8 relationships as dosha (0 points)', () => {
    // From Aries (idx 0), signDiff = b + 1, so bad signDiffs {2,5,6,8,9,12}
    // correspond to b in {1,4,5,7,8,11}.
    const badFromAries = new Set([1, 4, 5, 7, 8, 11]);
    for (let b = 0; b < 12; b++) {
      expect(computeBhakootScore(0, b)).toBe(badFromAries.has(b) ? 0 : 7);
    }
  });

  it('regression: Aries<->Gemini (3 apart) is auspicious both ways (old formula was asymmetric)', () => {
    expect(computeBhakootScore(0, 2)).toBe(7);
    expect(computeBhakootScore(2, 0)).toBe(7);
  });
});
