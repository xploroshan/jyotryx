/**
 * Decision Room — deterministic electional-timing scoring.
 *
 * Given the Panchang of a specific moment (its tithi, nakshatra, yoga, weekday
 * and where the chosen clock time falls relative to Rahu Kaal), this scores how
 * auspicious that moment is for a given activity and explains *why* — emitting
 * the same `ChartFactor[]` "Show Your Work" shape the kundli reading uses.
 *
 * It is a pure, dependency-free transform: no DI, no I/O, no clock, no
 * ephemeris. The astronomy (deriving the Panchang for a date) happens in the
 * service; this module only reasons over the already-derived snapshot. That
 * keeps it trivially unit-testable and guarantees "same inputs → same verdict".
 *
 * The rules are simplified, widely-cited classical Muhurta guidelines (Rikta
 * tithis avoided, Rahu Kaal avoided, activity-specific favourable nakshatras
 * and weekdays). They are intended for guidance, not ritual prescription.
 */

import { ChartFactor } from './factors.util';

export type DecisionActivity =
  | 'marriage'
  | 'business'
  | 'travel'
  | 'griha_pravesh'
  | 'vehicle'
  | 'education'
  | 'medical'
  | 'general';

/** Canonical activity list — drives DTO validation and the web dropdown. */
export const DECISION_ACTIVITIES: readonly DecisionActivity[] = [
  'marriage',
  'business',
  'travel',
  'griha_pravesh',
  'vehicle',
  'education',
  'medical',
  'general',
] as const;

export type Recommendation = 'excellent' | 'good' | 'neutral' | 'caution' | 'avoid';

/**
 * A derived Panchang snapshot for one moment. Indices drive the rule logic;
 * the English canonical names are only used to compose factor labels (so this
 * module never needs its own copy of the 27 nakshatra / 30 tithi name tables).
 */
export interface PanchangSnapshot {
  /** 0 = Sunday … 6 = Saturday (JS `Date.getDay()`). */
  weekday: number;
  /** 0…29 lunar-day index. 0 = Shukla Pratipada, 14 = Purnima, 29 = Amavasya. */
  tithiIndex: number;
  /** 0…26 nakshatra index (Ashwini = 0 … Revati = 26). */
  nakshatraIndex: number;
  /** 0…26 yoga index (Vishkambha = 0 … Vaidhriti = 26). */
  yogaIndex: number;
  /** English canonical names, for human-readable factor labels. */
  tithiName: string;
  nakshatraName: string;
  yogaName: string;
  varaName: string;
  /** Chosen clock time in minutes after local midnight, or null for a date-only query. */
  timeMinutes: number | null;
  /** Rahu Kaal window in minutes after local midnight, or null if unknown. */
  rahuKaal: { startMinutes: number; endMinutes: number } | null;
}

export interface TimingDecision {
  activity: DecisionActivity;
  /** 0…100, higher is more auspicious. */
  score: number;
  recommendation: Recommendation;
  factors: ChartFactor[];
}

// ── Classical timing rules ───────────────────────────────────────────────────

// Rikta ("empty") tithis — the 4th, 9th and 14th of either paksha — are
// traditionally avoided for auspicious undertakings. Keyed on the within-paksha
// position (tithiIndex % 15): Chaturthi = 3, Navami = 8, Chaturdashi = 13.
const RIKTA_WITHIN_PAKSHA = new Set([3, 8, 13]);

// Yoga indices (Vishkambha = 0 … Vaidhriti = 26).
const INAUSPICIOUS_YOGAS = new Set([0, 5, 8, 9, 12, 14, 16, 18, 26]); // Vishkambha, Atiganda, Shoola, Ganda, Vyaghata, Vajra, Vyatipata, Parigha, Vaidhriti
const AUSPICIOUS_YOGAS = new Set([3, 4, 6, 7, 10, 11, 13, 15, 20, 22, 24, 25]); // Saubhagya, Shobhana, Sukarma, Dhriti, Vriddhi, Dhruva, Harshana, Siddhi, Siddha, Shubha, Brahma, Indra

interface ActivityRule {
  /** Nakshatra indices considered favourable for this activity. */
  favourableNakshatras: ReadonlySet<number>;
  /** Weekdays (0 = Sun … 6 = Sat) that favour this activity. */
  favourableWeekdays: ReadonlySet<number>;
  /** Weekdays traditionally cautioned against for this activity. */
  cautionWeekdays: ReadonlySet<number>;
  /** Lower-case human label, e.g. "marriage", woven into factor text. */
  label: string;
}

const ACTIVITY_RULES: Record<DecisionActivity, ActivityRule> = {
  marriage: {
    favourableNakshatras: new Set([3, 4, 9, 11, 12, 14, 16, 18, 20, 25, 26]),
    favourableWeekdays: new Set([1, 3, 4, 5]), // Mon, Wed, Thu, Fri
    cautionWeekdays: new Set([2, 6]), // Tue, Sat
    label: 'marriage',
  },
  business: {
    favourableNakshatras: new Set([0, 7, 12, 13, 14, 16, 21, 22, 26]),
    favourableWeekdays: new Set([3, 4, 5]), // Wed, Thu, Fri
    cautionWeekdays: new Set([6]), // Sat
    label: 'a new venture',
  },
  travel: {
    favourableNakshatras: new Set([0, 4, 6, 7, 12, 16, 21, 26]),
    favourableWeekdays: new Set([1, 3, 4, 5]),
    cautionWeekdays: new Set([2, 6]),
    label: 'travel',
  },
  griha_pravesh: {
    favourableNakshatras: new Set([3, 4, 7, 11, 13, 16, 20, 25, 26]),
    favourableWeekdays: new Set([1, 3, 4, 5]),
    cautionWeekdays: new Set([2]), // Tue
    label: 'a housewarming',
  },
  vehicle: {
    favourableNakshatras: new Set([0, 3, 4, 6, 7, 12, 13, 14, 16, 21, 22, 26]),
    favourableWeekdays: new Set([1, 3, 4, 5]),
    cautionWeekdays: new Set([6]),
    label: 'buying a vehicle',
  },
  education: {
    favourableNakshatras: new Set([0, 6, 7, 12, 13, 14, 21, 22, 23, 26]),
    favourableWeekdays: new Set([3, 4, 5]),
    cautionWeekdays: new Set(),
    label: 'starting education',
  },
  medical: {
    favourableNakshatras: new Set([0, 7, 12, 16, 26]),
    favourableWeekdays: new Set([2]), // Tue (Mars) for procedures
    cautionWeekdays: new Set(),
    label: 'a medical procedure',
  },
  general: {
    favourableNakshatras: new Set(),
    favourableWeekdays: new Set([1, 3, 4, 5]),
    cautionWeekdays: new Set(),
    label: 'this',
  },
};

const VARA_LORDS: Record<number, string> = {
  0: 'Sun',
  1: 'Moon',
  2: 'Mars',
  3: 'Mercury',
  4: 'Jupiter',
  5: 'Venus',
  6: 'Saturn',
};

const BASE_SCORE = 60;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function recommendationFor(score: number): Recommendation {
  if (score >= 80) return 'excellent';
  if (score >= 65) return 'good';
  if (score >= 50) return 'neutral';
  if (score >= 35) return 'caution';
  return 'avoid';
}

/** Format minutes-after-midnight as a 12-hour clock string, e.g. 870 → "2:30 PM". */
export function formatMinutes(min: number): string {
  const total = ((Math.round(min) % 1440) + 1440) % 1440;
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

/**
 * Compute the Rahu Kaal window for a day from its weekday and sunrise/sunset.
 * The daytime is split into 8 equal parts; Rahu Kaal is the Nth part by
 * weekday (Mon 2nd, Tue 7th, Wed 5th, Thu 6th, Fri 4th, Sat 3rd, Sun 8th).
 */
export function rahuKaalWindow(
  weekday: number,
  sunriseMinutes: number,
  sunsetMinutes: number,
): { startMinutes: number; endMinutes: number } {
  // 1-based part number by weekday (index 0 = Sunday).
  const PART_BY_WEEKDAY = [8, 2, 7, 5, 6, 4, 3];
  const part = (sunsetMinutes - sunriseMinutes) / 8;
  const n = PART_BY_WEEKDAY[((weekday % 7) + 7) % 7];
  const startMinutes = sunriseMinutes + (n - 1) * part;
  return { startMinutes, endMinutes: startMinutes + part };
}

/**
 * Compose a human-readable tithi name from its 0–29 index, special-casing the
 * New Moon (index 29 → "Amavasya"), which the 15-entry Pratipada…Purnima name
 * table cannot represent — `29 % 15 === 14` would otherwise mislabel it
 * "Krishna Purnima" (a Full Moon). The canonical name table is supplied by the
 * caller so this stays a pure, table-free helper.
 */
export function tithiLabel(tithiIndex: number, names: readonly string[]): string {
  if (tithiIndex === 29) return 'Amavasya';
  const paksha = tithiIndex < 15 ? 'Shukla' : 'Krishna';
  return `${paksha} ${names[tithiIndex % 15]}`;
}

/** Number of days in a 1–12 month, leap-year aware. Day 0 of next month = last of this. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Score how auspicious a moment is for an activity, with a transparent list of
 * the factors behind the verdict. Pure and deterministic.
 */
export function scoreTiming(activity: DecisionActivity, p: PanchangSnapshot): TimingDecision {
  const rule = ACTIVITY_RULES[activity];
  const factors: ChartFactor[] = [];
  let score = BASE_SCORE;

  const add = (delta: number, factor: ChartFactor) => {
    score += delta;
    factors.push(factor);
  };

  // ── Weekday (vara) ──────────────────────────────────────────────────────
  const lord = VARA_LORDS[((p.weekday % 7) + 7) % 7];
  if (rule.favourableWeekdays.has(p.weekday)) {
    add(8, {
      code: `panchang.vara.${p.weekday}.favourable`,
      label: `${p.varaName} (ruled by ${lord}) favours ${rule.label}`,
      contribution: 'positive',
      source: 'panchang',
    });
  } else if (rule.cautionWeekdays.has(p.weekday)) {
    add(-8, {
      code: `panchang.vara.${p.weekday}.caution`,
      label: `${p.varaName} (ruled by ${lord}) is traditionally cautioned for ${rule.label}`,
      contribution: 'negative',
      source: 'panchang',
    });
  } else {
    factors.push({
      code: `panchang.vara.${p.weekday}.neutral`,
      label: `${p.varaName}, ruled by ${lord}`,
      contribution: 'neutral',
      source: 'panchang',
    });
  }

  // ── Tithi (lunar day) ───────────────────────────────────────────────────
  const withinPaksha = p.tithiIndex % 15;
  if (p.tithiIndex === 29) {
    add(-15, {
      code: 'panchang.tithi.amavasya',
      label: 'New Moon (Amavasya) — generally avoided for new beginnings',
      contribution: 'negative',
      source: 'panchang',
    });
  } else if (p.tithiIndex === 14) {
    add(6, {
      code: 'panchang.tithi.purnima',
      label: 'Full Moon (Purnima) — an auspicious tithi',
      contribution: 'positive',
      source: 'panchang',
    });
  } else if (RIKTA_WITHIN_PAKSHA.has(withinPaksha)) {
    add(-10, {
      code: `panchang.tithi.rikta.${p.tithiIndex}`,
      label: `Rikta tithi (${p.tithiName}) — traditionally avoided for important work`,
      contribution: 'negative',
      source: 'panchang',
    });
  } else {
    factors.push({
      code: `panchang.tithi.${p.tithiIndex}`,
      label: `Tithi: ${p.tithiName}`,
      contribution: 'neutral',
      source: 'panchang',
    });
  }

  // ── Nakshatra ───────────────────────────────────────────────────────────
  if (rule.favourableNakshatras.has(p.nakshatraIndex)) {
    add(12, {
      code: `panchang.nakshatra.${p.nakshatraIndex}.favourable`,
      label: `${p.nakshatraName} is a favourable nakshatra for ${rule.label}`,
      contribution: 'positive',
      source: 'panchang',
    });
  } else {
    factors.push({
      code: `panchang.nakshatra.${p.nakshatraIndex}`,
      label: `Moon in ${p.nakshatraName} nakshatra`,
      contribution: 'neutral',
      source: 'panchang',
    });
  }

  // ── Yoga ────────────────────────────────────────────────────────────────
  if (INAUSPICIOUS_YOGAS.has(p.yogaIndex)) {
    add(-10, {
      code: `panchang.yoga.${p.yogaIndex}.inauspicious`,
      label: `${p.yogaName} yoga — considered inauspicious`,
      contribution: 'negative',
      source: 'panchang',
    });
  } else if (AUSPICIOUS_YOGAS.has(p.yogaIndex)) {
    add(8, {
      code: `panchang.yoga.${p.yogaIndex}.auspicious`,
      label: `${p.yogaName} yoga — considered auspicious`,
      contribution: 'positive',
      source: 'panchang',
    });
  } else {
    factors.push({
      code: `panchang.yoga.${p.yogaIndex}`,
      label: `${p.yogaName} yoga`,
      contribution: 'neutral',
      source: 'panchang',
    });
  }

  // ── Rahu Kaal (only meaningful when a clock time was chosen) ─────────────
  if (p.rahuKaal) {
    const window = `${formatMinutes(p.rahuKaal.startMinutes)}–${formatMinutes(p.rahuKaal.endMinutes)}`;
    if (p.timeMinutes != null) {
      const inside = p.timeMinutes >= p.rahuKaal.startMinutes && p.timeMinutes < p.rahuKaal.endMinutes;
      if (inside) {
        add(-20, {
          code: 'panchang.rahukaal.inside',
          label: `Chosen time falls within Rahu Kaal (${window}) — strongly avoided`,
          contribution: 'negative',
          source: 'panchang',
        });
      } else {
        add(5, {
          code: 'panchang.rahukaal.clear',
          label: `Chosen time avoids Rahu Kaal (${window})`,
          contribution: 'positive',
          source: 'panchang',
        });
      }
    } else {
      factors.push({
        code: 'panchang.rahukaal.window',
        label: `Rahu Kaal on this day: ${window} (avoid)`,
        contribution: 'neutral',
        source: 'panchang',
      });
    }
  }

  score = clamp(Math.round(score), 0, 100);
  return { activity, score, recommendation: recommendationFor(score), factors };
}
