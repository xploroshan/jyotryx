import {
  resolveUtHour,
  zonedNow,
  isValidTimeZone,
  resolveTimezoneFromCoords,
  birthMoment,
  DEFAULT_TZ,
} from '../src/common/timezone.util';

describe('birthMoment', () => {
  it('parses the calendar date straight from the string (server-zone independent)', () => {
    expect(birthMoment('1990-05-15', '14:30')).toEqual({
      year: 1990, month: 5, day: 15, hour: 14, minute: 30,
    });
  });

  it('takes the date portion of an ISO datetime (never the UTC-shifted day)', () => {
    // A datetime whose UTC instant is on the 14th must still read as the 15th.
    expect(birthMoment('1990-05-15T02:00:00.000+05:30', '06:00')).toMatchObject({
      year: 1990, month: 5, day: 15,
    });
  });

  it('defaults a missing or malformed time to 06:00', () => {
    expect(birthMoment('2000-01-01')).toMatchObject({ hour: 6, minute: 0 });
    expect(birthMoment('2000-01-01', 'oops')).toMatchObject({ hour: 6, minute: 0 });
    expect(birthMoment('2000-01-01', '25:99')).toMatchObject({ hour: 6, minute: 0 });
  });

  it('keeps midnight and noon distinct', () => {
    expect(birthMoment('2000-01-01', '00:00')).toMatchObject({ hour: 0, minute: 0 });
    expect(birthMoment('2000-01-01', '12:00')).toMatchObject({ hour: 12, minute: 0 });
  });
});

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

/**
 * Guards the My Day timezone fix. The bug: the briefing's date and greeting
 * were computed from the server clock (UTC), so a user in IST just past
 * local midnight saw the *previous* day and "Good Evening". zonedNow must
 * express an instant in the user's own zone, independent of the server's tz.
 */
describe('zonedNow', () => {
  // The exact instant from the bug report: 00:36 IST on Thu 25 Jun 2026,
  // which is 19:06 UTC on Wed 24 Jun 2026.
  const instant = new Date('2026-06-24T19:06:00Z');

  it('reports the local date/hour in Asia/Kolkata (next day, early morning)', () => {
    const z = zonedNow(instant, 'Asia/Kolkata');
    expect(z.dateStr).toBe('2026-06-25');
    expect(z.year).toBe(2026);
    expect(z.month).toBe(6);
    expect(z.day).toBe(25);
    expect(z.hour).toBe(0);
    expect(z.minute).toBe(36);
    expect(z.weekday).toBe(4); // Thursday
    expect(z.zone).toBe('Asia/Kolkata');
  });

  it('gives a different, locally-correct day for the SAME instant in New York', () => {
    const z = zonedNow(instant, 'America/New_York'); // EDT, UTC-4 in June
    expect(z.dateStr).toBe('2026-06-24');
    expect(z.hour).toBe(15);
    expect(z.weekday).toBe(3); // Wednesday
  });

  it('falls back to Asia/Kolkata for an invalid zone', () => {
    const z = zonedNow(instant, 'Mars/Phobos');
    expect(z.zone).toBe(DEFAULT_TZ);
    expect(z.dateStr).toBe('2026-06-25');
  });
});

describe('isValidTimeZone', () => {
  it('accepts real IANA zones', () => {
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidTimeZone('America/New_York')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
  });
  it('rejects junk, empty, and missing values', () => {
    expect(isValidTimeZone('Mars/Phobos')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone(undefined)).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
  });
});

describe('resolveTimezoneFromCoords', () => {
  it('resolves Indian coordinates to Asia/Kolkata', () => {
    expect(resolveTimezoneFromCoords(28.61, 77.2)).toBe('Asia/Kolkata'); // New Delhi
  });
  it('resolves New York coordinates to America/New_York', () => {
    expect(resolveTimezoneFromCoords(40.71, -74.0)).toBe('America/New_York');
  });
  it('falls back to the default zone when coords are missing/out of range', () => {
    expect(resolveTimezoneFromCoords(null, null)).toBe(DEFAULT_TZ);
    expect(resolveTimezoneFromCoords(undefined, undefined)).toBe(DEFAULT_TZ);
  });
});
