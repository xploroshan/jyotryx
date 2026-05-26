/**
 * Pure, deterministic astrology helpers used by the tradition landing
 * dashboards to compute a few headline placements without burning a
 * paid /astrology/kundli credit on every visit.
 *
 * Limited on purpose — these are the read-at-a-glance facts the
 * editorial dashboards show in their hero/sidebar. Anything richer
 * (rising sign, dasha periods, full bāzī) still goes through the
 * proper feature page (e.g. /kundli, /bazi).
 */

// ─── Western tropical zodiac ─────────────────────────────────────────

const WESTERN_SIGNS = [
  { name: 'Capricorn', element: 'Earth', mode: 'Cardinal', ruler: 'Saturn', start: [12, 22] as const, end: [1, 19] as const },
  { name: 'Aquarius',  element: 'Air',   mode: 'Fixed',    ruler: 'Saturn', start: [1, 20]  as const, end: [2, 18] as const },
  { name: 'Pisces',    element: 'Water', mode: 'Mutable',  ruler: 'Jupiter',start: [2, 19]  as const, end: [3, 20] as const },
  { name: 'Aries',     element: 'Fire',  mode: 'Cardinal', ruler: 'Mars',   start: [3, 21]  as const, end: [4, 19] as const },
  { name: 'Taurus',    element: 'Earth', mode: 'Fixed',    ruler: 'Venus',  start: [4, 20]  as const, end: [5, 20] as const },
  { name: 'Gemini',    element: 'Air',   mode: 'Mutable',  ruler: 'Mercury',start: [5, 21]  as const, end: [6, 20] as const },
  { name: 'Cancer',    element: 'Water', mode: 'Cardinal', ruler: 'Moon',   start: [6, 21]  as const, end: [7, 22] as const },
  { name: 'Leo',       element: 'Fire',  mode: 'Fixed',    ruler: 'Sun',    start: [7, 23]  as const, end: [8, 22] as const },
  { name: 'Virgo',     element: 'Earth', mode: 'Mutable',  ruler: 'Mercury',start: [8, 23]  as const, end: [9, 22] as const },
  { name: 'Libra',     element: 'Air',   mode: 'Cardinal', ruler: 'Venus',  start: [9, 23]  as const, end: [10, 22] as const },
  { name: 'Scorpio',   element: 'Water', mode: 'Fixed',    ruler: 'Mars',   start: [10, 23] as const, end: [11, 21] as const },
  { name: 'Sagittarius',element: 'Fire', mode: 'Mutable',  ruler: 'Jupiter',start: [11, 22] as const, end: [12, 21] as const },
];

export interface WesternSign {
  name: string;
  element: 'Fire' | 'Earth' | 'Air' | 'Water';
  mode: 'Cardinal' | 'Fixed' | 'Mutable';
  ruler: string;
}

export function westernSunSign(dob: string | Date): WesternSign | null {
  const d = typeof dob === 'string' ? new Date(dob) : dob;
  if (Number.isNaN(d.getTime())) return null;
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  for (const sign of WESTERN_SIGNS) {
    const [sm, sd] = sign.start;
    const [em, ed] = sign.end;
    // Capricorn wraps the year boundary
    if (sm > em) {
      if ((m === sm && day >= sd) || (m === em && day <= ed)) {
        return { name: sign.name, element: sign.element as WesternSign['element'], mode: sign.mode as WesternSign['mode'], ruler: sign.ruler };
      }
    } else if ((m === sm && day >= sd) || (m === em && day <= ed)) {
      return { name: sign.name, element: sign.element as WesternSign['element'], mode: sign.mode as WesternSign['mode'], ruler: sign.ruler };
    }
  }
  return null;
}

/** Returns today's sun sign — used for the "Today" panel. */
export function westernSunSignToday(now: Date = new Date()): WesternSign | null {
  return westernSunSign(now);
}

// ─── Chinese zodiac ──────────────────────────────────────────────────
// Solar / sidereal start of Chinese year is around Feb 4 (Lichun). For
// the editorial dashboard's read-at-a-glance use we approximate with
// Jan 1 — close enough for everyone not born in January/early February.
// Birth in late Jan or before ~Feb 4 should still consult /bazi.

const ANIMALS = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'] as const;
const ELEMENTS = ['Wood', 'Wood', 'Fire', 'Fire', 'Earth', 'Earth', 'Metal', 'Metal', 'Water', 'Water'] as const;
// Year 4 in the cycle was a Rat year (1924 = Wood Rat). Use that as anchor.
const RAT_ANCHOR_YEAR = 1924;

export interface ChineseSign {
  animal: typeof ANIMALS[number];
  element: typeof ELEMENTS[number];
  polarity: 'Yang' | 'Yin';
}

export function chineseZodiac(dob: string | Date): ChineseSign | null {
  const d = typeof dob === 'string' ? new Date(dob) : dob;
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  // Anyone born Jan 1 → ~Feb 4 belongs to the previous lunar year — flag
  // it conservatively by subtracting 1 if month is January.
  const effectiveYear = d.getUTCMonth() === 0 ? year - 1 : year;
  const offset = ((effectiveYear - RAT_ANCHOR_YEAR) % 60 + 60) % 60;
  return {
    animal: ANIMALS[offset % 12],
    element: ELEMENTS[offset % 10],
    polarity: offset % 2 === 0 ? 'Yang' : 'Yin',
  };
}

export function chineseZodiacToday(now: Date = new Date()): ChineseSign | null {
  return chineseZodiac(now);
}

// ─── Hellenistic annual profections ──────────────────────────────────
// Each year of life, the locus of activity moves one house clockwise
// starting from the Ascendant. The profected house's ruler becomes
// "Lord of the Year" — the period's headline planet. Without a chart
// we can't name the lord, but we can tell the user which house they're
// in this year and what that house traditionally signifies.

const HOUSE_TOPICS = [
  'Self, body, vitality',
  'Money, possessions, livelihood',
  'Siblings, short trips, communication',
  'Home, family, foundations',
  'Children, creativity, pleasure',
  'Work, health, daily routine',
  'Partnerships, open enemies',
  'Death, debts, shared resources',
  'Long journeys, philosophy, faith',
  'Career, public reputation',
  'Friends, hopes, alliances',
  'Hidden things, undoing, solitude',
];

export interface Profection {
  age: number;
  house: number;        // 1..12
  topic: string;
}

export function profectionForAge(dob: string | Date, now: Date = new Date()): Profection | null {
  const d = typeof dob === 'string' ? new Date(dob) : dob;
  if (Number.isNaN(d.getTime())) return null;
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const hasHadBirthday =
    now.getUTCMonth() > d.getUTCMonth() ||
    (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() >= d.getUTCDate());
  if (!hasHadBirthday) age -= 1;
  if (age < 0) return null;
  const house = (age % 12) + 1;
  return { age, house, topic: HOUSE_TOPICS[house - 1] };
}

// ─── Medical (decumbiture) body-part correspondences ─────────────────
// Each sign rules a body region in the melothesia. Useful for the
// medical-astrology landing to show "your sun rules X" at a glance.

export const SIGN_BODY_PART: Record<string, string> = {
  Aries:       'Head, brain, eyes',
  Taurus:      'Neck, throat, thyroid',
  Gemini:      'Lungs, arms, hands, nervous system',
  Cancer:      'Stomach, breasts, digestion',
  Leo:         'Heart, spine, upper back',
  Virgo:       'Intestines, pancreas, spleen',
  Libra:       'Kidneys, lower back, skin',
  Scorpio:     'Reproductive organs, bladder',
  Sagittarius: 'Hips, thighs, liver',
  Capricorn:   'Knees, bones, joints',
  Aquarius:    'Ankles, circulation, calves',
  Pisces:      'Feet, lymphatic system, immunity',
};
