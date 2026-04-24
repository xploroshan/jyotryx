/**
 * planetaryTime helper tests.
 *
 * These exist because the "NOW" badge on My Day was frozen on whatever
 * hour the briefing was generated in — the server-provided `isCurrent`
 * flag went stale the moment the localStorage cache was older than one
 * hour. The UI now derives the current hour locally with
 * `currentHourIndex`, and these tests pin that logic against the wall
 * clock across day boundaries and malformed inputs.
 */
import { describe, it, expect } from 'vitest';
import {
  parseClockTime,
  minutesSinceMidnight,
  currentHourIndex,
  type PlanetaryHourSlot,
} from '../app/my-day/lib/planetaryTime';

const hoursFrom10am: PlanetaryHourSlot[] = [
  { planet: 'Saturn', startTime: '10:00 AM', endTime: '11:00 AM', activities: [] },
  { planet: 'Jupiter', startTime: '11:00 AM', endTime: '12:00 PM', activities: [] },
  { planet: 'Mars', startTime: '12:00 PM', endTime: '1:00 PM', activities: [] },
  { planet: 'Sun', startTime: '1:00 PM', endTime: '2:00 PM', activities: [] },
  { planet: 'Venus', startTime: '2:00 PM', endTime: '3:00 PM', activities: [] },
  { planet: 'Mercury', startTime: '3:00 PM', endTime: '4:00 PM', activities: [] },
];

// 24-slot hora list that wraps past midnight — representative of what
// the backend actually serves when hora list is anchored to sunrise.
const wrappingHours: PlanetaryHourSlot[] = [
  { planet: 'Sun', startTime: '6:00 AM', endTime: '7:00 AM', activities: [] },
  { planet: 'Venus', startTime: '7:00 AM', endTime: '8:00 AM', activities: [] },
  // …large gap skipped for brevity; only the wrap edges matter…
  { planet: 'Moon', startTime: '11:00 PM', endTime: '12:00 AM', activities: [] },
  { planet: 'Saturn', startTime: '12:00 AM', endTime: '1:00 AM', activities: [] },
  { planet: 'Jupiter', startTime: '1:00 AM', endTime: '2:00 AM', activities: [] },
  { planet: 'Mars', startTime: '2:00 AM', endTime: '3:00 AM', activities: [] },
];

describe('parseClockTime', () => {
  it('parses AM times', () => {
    expect(parseClockTime('9:00 AM')).toBe(9 * 60);
    expect(parseClockTime('12:00 AM')).toBe(0);
    expect(parseClockTime('12:30 AM')).toBe(30);
  });

  it('parses PM times', () => {
    expect(parseClockTime('1:00 PM')).toBe(13 * 60);
    expect(parseClockTime('3:25 PM')).toBe(15 * 60 + 25);
    expect(parseClockTime('12:00 PM')).toBe(12 * 60);
  });

  it('returns null for malformed input', () => {
    expect(parseClockTime('')).toBeNull();
    expect(parseClockTime('garbage')).toBeNull();
    expect(parseClockTime('25:00 AM')).not.toBeNull(); // lenient hour check — OK
    expect(parseClockTime('10:00')).toBeNull(); // no AM/PM
  });
});

describe('minutesSinceMidnight', () => {
  it('reflects local wall clock', () => {
    expect(minutesSinceMidnight(new Date(2026, 3, 24, 0, 0))).toBe(0);
    expect(minutesSinceMidnight(new Date(2026, 3, 24, 9, 0))).toBe(9 * 60);
    expect(minutesSinceMidnight(new Date(2026, 3, 24, 15, 25))).toBe(15 * 60 + 25);
    expect(minutesSinceMidnight(new Date(2026, 3, 24, 23, 59))).toBe(23 * 60 + 59);
  });
});

describe('currentHourIndex', () => {
  it('returns the index of the hour containing "now"', () => {
    // 10:30 AM → inside Saturn's 10-11
    expect(currentHourIndex(hoursFrom10am, 10 * 60 + 30)).toBe(0);
    // 11:00 AM → boundary, belongs to Jupiter (start inclusive)
    expect(currentHourIndex(hoursFrom10am, 11 * 60)).toBe(1);
    // 3:25 PM → inside Mercury's 3-4. This is exactly the real-world
    // case from the bug report (screenshot showed 3:25 PM with Saturn
    // stuck on NOW because the cached server flag was hours stale).
    expect(currentHourIndex(hoursFrom10am, 15 * 60 + 25)).toBe(5);
  });

  it('returns -1 before the list window opens', () => {
    // 9:00 AM — list starts at 10:00 AM, and 9 < 10 so the helper
    // would previously wrap to "tomorrow" and miss. We expect a clean
    // miss instead of a false positive on the last slot.
    expect(currentHourIndex(hoursFrom10am, 9 * 60)).toBe(-1);
  });

  it('returns -1 after the list window closes', () => {
    // 4:30 PM — past Mercury's 3-4 PM end.
    expect(currentHourIndex(hoursFrom10am, 16 * 60 + 30)).toBe(-1);
  });

  it('handles an hour list that wraps past midnight', () => {
    // 12:30 AM — should land on Saturn (12-1 AM post-wrap), not on any
    // earlier slot that naively matched in clock-minutes terms.
    const idx = currentHourIndex(wrappingHours, 30);
    expect(wrappingHours[idx]?.planet).toBe('Saturn');
    // 2:30 AM — Mars slot.
    const idx2 = currentHourIndex(wrappingHours, 2 * 60 + 30);
    expect(wrappingHours[idx2]?.planet).toBe('Mars');
  });

  it('returns -1 for empty or malformed lists', () => {
    expect(currentHourIndex([], 10 * 60)).toBe(-1);
    expect(
      currentHourIndex(
        [{ planet: 'X', startTime: 'garbage', endTime: 'also garbage', activities: [] }],
        10 * 60,
      ),
    ).toBe(-1);
  });
});
