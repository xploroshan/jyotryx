/**
 * Shared client-side helpers for resolving "which planetary hour is
 * happening right now" against the wall clock.
 *
 * The daily briefing is cached in localStorage for a full 24 hours (see
 * BRIEFING_CACHE_KEY in my-day/page.tsx), so the server-provided
 * `isCurrent` flag and `currentHora` payload go stale within an hour of
 * being generated. These helpers let both `my-day/page.tsx` and the
 * PlanetaryHoursSection re-derive "now" locally.
 */

export interface PlanetaryHourSlot {
  planet: string;
  startTime: string;
  endTime: string;
  activities: string[];
  avoid?: string[];
  isCurrent?: boolean;
}

/** Parse "9:00 AM" / "10:30 PM" into minutes since midnight, or null. */
export function parseClockTime(raw: string): number | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i.exec(raw);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ampm = m[3].toUpperCase();
  if (h === 12) h = 0;
  if (ampm === 'PM') h += 12;
  return h * 60 + min;
}

/** Minutes since midnight for the given Date in local time. */
export function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Index into `hours` that corresponds to the currently active slot.
 * Handles past-midnight wrap — a 24-hour list anchored at sunrise
 * regularly has entries that land on "tomorrow" in wall-clock terms.
 * Returns -1 when the list is empty or malformed.
 */
export function currentHourIndex(
  hours: readonly PlanetaryHourSlot[],
  nowMin: number,
): number {
  if (!hours.length) return -1;
  const firstStart = parseClockTime(hours[0].startTime);
  if (firstStart == null) return -1;
  let now = nowMin;
  if (now < firstStart) now += 24 * 60;
  let accum = 0;
  let prev = firstStart;
  for (let i = 0; i < hours.length; i++) {
    const s = parseClockTime(hours[i].startTime);
    const e = parseClockTime(hours[i].endTime);
    if (s == null || e == null) continue;
    if (i > 0 && s < prev) accum += 24 * 60;
    const startAbs = s + accum;
    const endAbs = e + accum + (e <= s ? 24 * 60 : 0);
    if (now >= startAbs && now < endAbs) return i;
    prev = s;
  }
  return -1;
}
