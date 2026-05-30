import { resolveUtHour } from '../src/common/timezone.util';

/**
 * Guards the birth-time → UT conversion. The previous longitude/15 (local
 * mean solar time) approximation was off by ~27 min for Indian longitudes,
 * which shifted the ascendant across a whole sign. These assert the real
 * IANA-zone offset is used instead.
 */
describe('resolveUtHour', () => {
  it('uses IST (+5:30) for an Indian birthplace, not longitude/15', () => {
    // Sakaleshpura ≈ 12.94°N, 75.78°E. longitude/15 = 5.052h (the old bug),
    // which would give utHour 0.448; the correct IST conversion gives 0.0.
    const ut = resolveUtHour({
      year: 1980, month: 2, day: 28, hour: 5, minute: 30,
      latitude: 12.94, longitude: 75.78,
    });
    expect(ut).toBeCloseTo(0.0, 5);
    // Explicitly assert we did NOT fall back to the longitude approximation.
    const longitudeApprox = 5 + 30 / 60 - 75.78 / 15;
    expect(Math.abs(ut - longitudeApprox)).toBeGreaterThan(0.4);
  });

  it('applies the correct offset for a non-Indian birthplace (no DST in winter)', () => {
    // New York ≈ 40.71°N, -74.0°W → EST (UTC-5) on 1990-01-15.
    // utHour = 12 + 0 - (-5) = 17.
    const ut = resolveUtHour({
      year: 1990, month: 1, day: 15, hour: 12, minute: 0,
      latitude: 40.71, longitude: -74.0,
    });
    expect(ut).toBeCloseTo(17.0, 5);
  });

  it('honours DST for a summer birth (New York EDT, UTC-4)', () => {
    // 1990-07-15 is EDT (UTC-4): utHour = 12 - 4 = 16.
    const ut = resolveUtHour({
      year: 1990, month: 7, day: 15, hour: 12, minute: 0,
      latitude: 40.71, longitude: -74.0,
    });
    expect(ut).toBeCloseTo(16.0, 5);
  });

  it('falls back to IST when coordinates are missing', () => {
    const ut = resolveUtHour({
      year: 2000, month: 6, day: 1, hour: 10, minute: 0,
      latitude: null, longitude: null,
    });
    expect(ut).toBeCloseTo(10 - 5.5, 5);
  });
});
