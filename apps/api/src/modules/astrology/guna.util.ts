/**
 * Ashtakoota "Bhakoot" koota score (max 7 points).
 *
 * Bhakoot dosha (score 0) applies when the two Moon signs are 2/12, 5/9, or
 * 6/8 apart; otherwise the pair earns the full 7. `signIdx` is 0-11
 * (Aries..Pisces). `signDiff` is the 1-indexed distance from sign1 to sign2
 * (same sign = 1). The bad set {2,5,6,8,9,12} is closed under the partner-swap
 * map k -> 14-k, so the score is order-independent (f(a,b) === f(b,a)) and
 * identical Moon signs (1/1) are auspicious — both required by the
 * "same math, every time" guarantee.
 */
export function computeBhakootScore(signIdx1: number, signIdx2: number): number {
  const signDiff = ((signIdx2 - signIdx1 + 12) % 12) + 1;
  return [2, 5, 6, 8, 9, 12].includes(signDiff) ? 0 : 7;
}
