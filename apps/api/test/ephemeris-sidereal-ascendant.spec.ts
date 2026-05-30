import { EphemerisService } from '../src/ephemeris/ephemeris.service';

/**
 * Regression guard for two bugs that together put the Lagna (ascendant) a
 * whole sign off and shifted every house placement:
 *
 *   1. The ascendant was read from swe_houses() (TROPICAL) while planets used
 *      SEFLG_SIDEREAL (Lahiri) — a ~23.6° zodiac mismatch.
 *   2. Birth time → UT used longitude/15 (local mean solar time) instead of
 *      the birthplace's real IANA timezone.
 *
 * These drive the REAL EphemerisService (sync path) so the production wiring
 * — not a test reimplementation — is what's validated.
 */

const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];
const signOf = (lng: number) => SIGNS[Math.floor((((lng % 360) + 360) % 360) / 30) % 12];

function makeService(): EphemerisService {
  // workerCount '0' forces the deterministic in-process sync path (no worker
  // thread flakiness); cache always misses so every call recomputes.
  const config = { get: (_k: string, _d?: string) => '0' } as any;
  const cache = { get: async () => null, set: async () => undefined } as any;
  return new EphemerisService(config, cache);
}

describe('EphemerisService — sidereal ascendant (production path)', () => {
  const svc = makeService();

  it('India Independence chart (Aug 15 1947, 00:00 IST, Delhi) → Taurus lagna, not tropical Gemini', async () => {
    const chart = await svc.computeChart({
      year: 1947, month: 8, day: 15, hour: 0, minute: 0,
      lat: 28.6139, lng: 77.209,
    });
    // Externally documented Vrishabha (Taurus) lagna; the tropical bug gave Gemini.
    expect(signOf(chart.ascendant)).toBe('Taurus');
  });

  it('Sakaleshpura (Feb 28 1980, 05:30 IST) → Capricorn lagna, not Aquarius', async () => {
    const chart = await svc.computeChart({
      year: 1980, month: 2, day: 28, hour: 5, minute: 30,
      lat: 12.94, lng: 75.78,
    });
    expect(signOf(chart.ascendant)).toBe('Capricorn');

    // And the planet-in-house mapping that follows from it: a pre-dawn birth
    // with the Sun in Aquarius must place the Sun in the 2nd house (Aquarius
    // is the 2nd sign from a Capricorn ascendant), never the 1st.
    const ascIdx = Math.floor((((chart.ascendant % 360) + 360) % 360) / 30) % 12;
    const sun = chart.positions.find((p) => p.name === 'Sun')!;
    const sunSignIdx = Math.floor(sun.longitude / 30) % 12;
    const sunHouse = ((sunSignIdx - ascIdx + 12) % 12) + 1;
    expect(signOf(sun.longitude)).toBe('Aquarius');
    expect(sunHouse).toBe(2);
  });

  it('uses MEAN node for Rahu/Ketu (Indian Vedic convention), not true node', async () => {
    // Delhi 26 Jan 1990 14:30 IST: mean and true nodes fall in DIFFERENT
    // nakshatras (mean → Dhanishta ~Cap 23.4°, true → Shravana ~Cap 22.7°),
    // so this distinguishes the two. Production must match the mean node.
    const chart = await svc.computeChart({
      year: 1990, month: 1, day: 26, hour: 14, minute: 30,
      lat: 28.6139, lng: 77.209,
    });
    const rahu = chart.positions.find((p) => p.name === 'Rahu')!;
    expect(signOf(rahu.longitude)).toBe('Capricorn');
    // Mean node ≈ 23.4°; true node ≈ 22.7°. Assert we're on the mean side.
    expect(rahu.longitude % 30).toBeGreaterThan(23.0);

    // Ketu is exactly 180° opposite Rahu.
    const ketu = chart.positions.find((p) => p.name === 'Ketu')!;
    const opposed = (((ketu.longitude - rahu.longitude) % 360) + 360) % 360;
    expect(opposed).toBeCloseTo(180, 3);
  });
});
