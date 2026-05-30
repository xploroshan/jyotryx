import tzLookup from 'tz-lookup';

/**
 * Birth-time → UTC conversion for astrology charts.
 *
 * Birth times are recorded as CIVIL (clock/zone) time, not local mean solar
 * time. The old code approximated the offset as `longitude / 15`, which is
 * local *mean solar* time and can be tens of minutes off the actual zone
 * (≈27 min for a place near 75.8°E on IST) — enough to push the ascendant
 * across a sign boundary. We instead resolve the IANA timezone from the
 * birthplace coordinates and ask the runtime (ICU/tzdata) for the real UTC
 * offset on the birth date, which correctly accounts for historical DST.
 */

// Resolve the UTC offset (in hours, east-positive) that applies to a given
// local wall-clock instant in an IANA timezone. Uses Intl, which carries the
// full historical tz database including DST transitions.
function offsetHoursForWallTime(
  zone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): number {
  // Interpret the wall-clock fields as if they were UTC, then read back what
  // the zone calls that instant. The delta between the two is the offset.
  // (Near a DST transition this is accurate to within the DST step, which is
  // far better than the longitude approximation and irrelevant for India.)
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    hour12: false,
  });
  const parts = dtf.formatToParts(new Date(asUtc));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  let h = get('hour');
  if (h === 24) h = 0; // some ICU builds emit hour 24 for midnight
  const localAsIfUtc = Date.UTC(
    get('year'), get('month') - 1, get('day'), h, get('minute'), get('second'),
  );
  return (localAsIfUtc - asUtc) / 3_600_000;
}

/**
 * Given birth coordinates and local clock fields, return the UT decimal hour
 * (which may be negative or ≥24, signalling the date rolled — callers building
 * a Julian Day with swe_julday handle fractional/over-range hours fine).
 *
 * Falls back to IST (+5:30) when coordinates are missing or the zone can't be
 * resolved — this app is India-first, so IST is the safest default.
 */
export function resolveUtHour(params: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  latitude?: number | null;
  longitude?: number | null;
}): number {
  const { year, month, day, hour, minute, latitude, longitude } = params;
  let offset = 5.5; // IST default
  if (latitude != null && longitude != null) {
    try {
      const zone = tzLookup(latitude, longitude);
      offset = offsetHoursForWallTime(zone, year, month, day, hour, minute);
    } catch {
      // tz-lookup throws on out-of-range coords; keep the IST fallback.
    }
  }
  return hour + minute / 60 - offset;
}
