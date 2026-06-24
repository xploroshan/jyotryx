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

/** App is India-first; the safest default when a zone can't be resolved. */
export const DEFAULT_TZ = 'Asia/Kolkata';

/** True if `zone` is an IANA timezone the runtime (ICU/tzdata) understands. */
export function isValidTimeZone(zone: string | null | undefined): zone is string {
  if (!zone) return false;
  try {
    // Throws RangeError for unknown zones.
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve an IANA timezone from coordinates (e.g. a user's birthplace),
 * falling back to {@link DEFAULT_TZ} when coords are missing/out of range.
 */
export function resolveTimezoneFromCoords(
  latitude?: number | null,
  longitude?: number | null,
): string {
  if (latitude != null && longitude != null) {
    try {
      return tzLookup(latitude, longitude);
    } catch {
      // tz-lookup throws on out-of-range coords; fall through to default.
    }
  }
  return DEFAULT_TZ;
}

/** A moment expressed as wall-clock parts in a specific timezone. */
export interface ZonedNow {
  /** Local calendar date as `YYYY-MM-DD` in the zone. */
  dateStr: string;
  /** Local year (e.g. 2026). */
  year: number;
  /** Local month, 1–12. */
  month: number;
  /** Local day of month, 1–31. */
  day: number;
  /** Local hour, 0–23. */
  hour: number;
  /** Local minute, 0–59. */
  minute: number;
  /** Local day of week, 0=Sunday … 6=Saturday. */
  weekday: number;
  /** The resolved zone actually used (after validation/fallback). */
  zone: string;
}

/**
 * Express an instant as wall-clock parts in `zone`. Uses `Intl` rather than
 * `Date`'s local accessors, so the result is independent of the server's own
 * timezone — the bug this replaces was the server (UTC) deciding the date and
 * greeting for users in other zones. Invalid zones fall back to {@link DEFAULT_TZ}.
 */
export function zonedNow(instant: Date, zone: string): ZonedNow {
  const tz = isValidTimeZone(zone) ? zone : DEFAULT_TZ;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(instant);
  const num = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const year = num('year');
  const month = num('month');
  const day = num('day');
  let hour = num('hour');
  if (hour === 24) hour = 0; // some ICU builds emit hour 24 at midnight
  const minute = num('minute');
  // `getUTCDay` of the local Y/M/D is the local weekday, with no tz ambiguity.
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const dateStr = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { dateStr, year, month, day, hour, minute, weekday, zone: tz };
}
