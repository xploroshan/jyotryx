/**
 * Gochar (transit) personalization — pure functions.
 *
 * These take a user's *natal* Moon position and *today's* transiting planet
 * positions (both sidereal/Lahiri longitudes) and derive the classical Vedic
 * day-to-day reading that is specific to that person: Sade Sati, Tara Bala,
 * Chandra Bala, Jupiter transit, and the personalized day quality / lucky
 * attributes that flow from them.
 *
 * Everything here is deterministic and dependency-free so it can be unit
 * tested without the Swiss Ephemeris binding.
 */

export type DayQuality = 'excellent' | 'good' | 'moderate' | 'challenging';

export const ALL_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;

// Lord of each sign (index 0 = Aries … 11 = Pisces).
export const SIGN_LORDS = [
  'Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury',
  'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter',
] as const;

// ─── Panchang reference tables (shared with the global almanac) ──────────────
// Nakshatra spelling matches the keys the KB/i18n layer expects ("Mula").
export const PANCHANG_TITHIS = [
  'Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi',
  'Saptami', 'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dwadashi',
  'Trayodashi', 'Chaturdashi', 'Purnima',
] as const;

export const PANCHANG_NAKSHATRAS = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
  'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni',
  'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha',
  'Jyeshtha', 'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana',
  'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
] as const;

export const PANCHANG_YOGAS = [
  'Vishkambha', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana', 'Atiganda',
  'Sukarman', 'Dhriti', 'Shula', 'Ganda', 'Vriddhi', 'Dhruva', 'Vyaghata',
  'Harshana', 'Vajra', 'Siddhi', 'Vyatipata', 'Variyan', 'Parigha', 'Shiva',
  'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma', 'Indra', 'Vaidhriti',
] as const;

export const PANCHANG_VARA_KEYS = [
  'Ravivaar', 'Somvaar', 'Mangalvaar', 'Budhvaar', 'Guruvaar', 'Shukravaar', 'Shanivaar',
] as const;

export const PANCHANG_RAHU_KAALS = [
  '4:30 PM - 6:00 PM', '7:30 AM - 9:00 AM', '3:00 PM - 4:30 PM',
  '12:00 PM - 1:30 PM', '1:30 PM - 3:00 PM', '10:30 AM - 12:00 PM',
  '9:00 AM - 10:30 AM',
] as const;

// Lucky colour by ruling planet of the natal Moon sign.
const PLANET_COLORS: Record<string, string> = {
  Sun: 'Ruby Red', Moon: 'Pearl White', Mars: 'Coral Red', Mercury: 'Emerald Green',
  Jupiter: 'Golden Yellow', Venus: 'Diamond White', Saturn: 'Sapphire Blue',
};

// Numerology number associated with each graha (psychic/Moon-sign number).
const PLANET_NUMBERS: Record<string, number> = {
  Sun: 1, Moon: 2, Jupiter: 3, Rahu: 4, Mercury: 5, Venus: 6, Ketu: 7, Saturn: 8, Mars: 9,
};

// The nine Taras in order, with their classical auspiciousness.
const TARA_TABLE: { name: string; favorable: boolean }[] = [
  { name: 'Janma', favorable: false },        // 1 — body/self, needs care
  { name: 'Sampat', favorable: true },         // 2 — wealth
  { name: 'Vipat', favorable: false },         // 3 — danger
  { name: 'Kshema', favorable: true },         // 4 — well-being
  { name: 'Pratyak', favorable: false },       // 5 — obstacles
  { name: 'Sadhana', favorable: true },        // 6 — achievement
  { name: 'Naidhana', favorable: false },      // 7 — death/loss
  { name: 'Mitra', favorable: true },          // 8 — friend
  { name: 'Parama Mitra', favorable: true },   // 9 — best friend
];

// ─── Position helpers ────────────────────────────────────────────────────────

export function signIndexFromLongitude(longitude: number): number {
  return Math.floor((((longitude % 360) + 360) % 360) / 30) % 12;
}

export function nakshatraIndexFromLongitude(longitude: number): number {
  return Math.floor((((longitude % 360) + 360) % 360) / (360 / 27)) % 27;
}

/** House (1..12) of a transiting sign counted from the natal Moon sign (= 1). */
export function houseFromMoon(transitSignIdx: number, natalMoonSignIdx: number): number {
  return ((transitSignIdx - natalMoonSignIdx + 12) % 12) + 1;
}

// ─── Sade Sati / Shani Dhaiya ────────────────────────────────────────────────

export interface SadeSatiResult {
  active: boolean;
  /** Which Saturn affliction is running relative to the natal Moon. */
  type: 'sadeSati' | 'dhaiya' | 'none';
  /** For Sade Sati: which of the 7.5-year phases. */
  phase: 'rising' | 'peak' | 'setting' | 'none';
}

export function computeSadeSati(saturnSignIdx: number, natalMoonSignIdx: number): SadeSatiResult {
  const house = houseFromMoon(saturnSignIdx, natalMoonSignIdx);
  if (house === 12) return { active: true, type: 'sadeSati', phase: 'rising' };
  if (house === 1) return { active: true, type: 'sadeSati', phase: 'peak' };
  if (house === 2) return { active: true, type: 'sadeSati', phase: 'setting' };
  // Kantaka (4th) and Ashtama (8th) Shani — the "small panoti" / Dhaiya.
  if (house === 4 || house === 8) return { active: true, type: 'dhaiya', phase: 'none' };
  return { active: false, type: 'none', phase: 'none' };
}

// ─── Tara Bala (today's Moon nakshatra vs natal nakshatra) ───────────────────

export interface TaraResult {
  index: number; // 1..9
  name: string;
  favorable: boolean;
}

export function computeTaraBala(transitMoonNakIdx: number, natalNakIdx: number): TaraResult {
  const count = ((transitMoonNakIdx - natalNakIdx + 27) % 27);
  const index = (count % 9) + 1;
  const entry = TARA_TABLE[index - 1];
  return { index, name: entry.name, favorable: entry.favorable };
}

// ─── Chandra Bala (today's Moon sign vs natal Moon sign) ─────────────────────
// The Moon is auspicious transiting the 1,3,6,7,10,11 houses from the natal Moon.
const GOOD_CHANDRA_HOUSES = new Set([1, 3, 6, 7, 10, 11]);

export function computeChandraBala(transitMoonSignIdx: number, natalMoonSignIdx: number): {
  house: number;
  favorable: boolean;
} {
  const house = houseFromMoon(transitMoonSignIdx, natalMoonSignIdx);
  return { house, favorable: GOOD_CHANDRA_HOUSES.has(house) };
}

// ─── Jupiter transit (Guru Gochar) ───────────────────────────────────────────
// Jupiter is benefic transiting the 2,5,7,9,11 houses from the natal Moon.
const GOOD_JUPITER_HOUSES = new Set([2, 5, 7, 9, 11]);

export function computeJupiterTransit(jupiterSignIdx: number, natalMoonSignIdx: number): {
  house: number;
  favorable: boolean;
} {
  const house = houseFromMoon(jupiterSignIdx, natalMoonSignIdx);
  return { house, favorable: GOOD_JUPITER_HOUSES.has(house) };
}

// ─── Personalized day quality ────────────────────────────────────────────────

const BASE_QUALITY_SCORE: Record<DayQuality, number> = {
  excellent: 4, good: 3, moderate: 2, challenging: 1,
};

export function personalizedDayQuality(
  base: DayQuality,
  factors: {
    tara: TaraResult;
    chandra: { favorable: boolean };
    jupiter: { favorable: boolean };
    sadeSati: SadeSatiResult;
  },
): DayQuality {
  let score = BASE_QUALITY_SCORE[base];

  if (factors.tara.favorable) score += 1;
  else if (factors.tara.index !== 1) score -= 1; // Janma is neutral, not penalised

  score += factors.chandra.favorable ? 1 : -1;
  if (factors.jupiter.favorable) score += 1;

  if (factors.sadeSati.type === 'sadeSati') {
    score -= factors.sadeSati.phase === 'peak' ? 2 : 1;
  } else if (factors.sadeSati.type === 'dhaiya') {
    score -= 1;
  }

  if (score >= 5) return 'excellent';
  if (score >= 3) return 'good';
  if (score >= 1) return 'moderate';
  return 'challenging';
}

// ─── Personalized lucky attributes ───────────────────────────────────────────

/** Psychic number — the single-digit reduction of the birth day-of-month. */
export function personalizedLuckyNumber(birthDayOfMonth: number): number {
  let n = ((birthDayOfMonth % 9) + 9) % 9;
  if (n === 0) n = 9;
  return n;
}

export function personalizedLuckyColor(natalMoonSignIdx: number): string {
  const lord = SIGN_LORDS[natalMoonSignIdx];
  return PLANET_COLORS[lord] ?? 'White';
}

export function moonSignNumber(natalMoonSignIdx: number): number {
  const lord = SIGN_LORDS[natalMoonSignIdx];
  return PLANET_NUMBERS[lord] ?? 1;
}

// ─── Human-readable transit alert ────────────────────────────────────────────

export function buildTransitAlert(factors: {
  moonSign: string;
  sadeSati: SadeSatiResult;
  jupiter: { house: number; favorable: boolean };
  tara: TaraResult;
}): string | null {
  const { sadeSati, jupiter, tara } = factors;

  // Saturn afflictions take priority — they are the headline transit.
  if (sadeSati.type === 'sadeSati') {
    const phaseText: Record<string, string> = {
      rising: 'rising (first) phase — responsibilities build; pace yourself',
      peak: 'peak (second) phase — the most testing stretch; lean on discipline and remedies',
      setting: 'setting (final) phase — pressures ease as you consolidate lessons learned',
    };
    return `Saturn is transiting your ${factors.moonSign} Moon — Sade Sati ${phaseText[sadeSati.phase]}.`;
  }
  if (sadeSati.type === 'dhaiya') {
    return `Shani Dhaiya (small Panoti) is active over your ${factors.moonSign} Moon — steady effort and patience are favoured over bold new moves.`;
  }

  // Otherwise lead with Jupiter's transit, which sets the tone for growth.
  if (jupiter.favorable) {
    return `Jupiter transits the ${ordinal(jupiter.house)} from your ${factors.moonSign} Moon — a supportive cycle for growth, learning and well-timed expansion.`;
  }

  // Fall back to today's Tara when nothing structural stands out.
  if (!tara.favorable && tara.index !== 1) {
    return `Today's Moon forms ${tara.name} Tara from your birth star — keep important launches light and let the day settle before big decisions.`;
  }
  if (tara.favorable) {
    return `Today's Moon forms the auspicious ${tara.name} Tara from your birth star — a naturally supportive day for you.`;
  }
  return null;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
