/**
 * Offline Computation Engine for Jyotryx
 *
 * Provides fully local computations for features that don't need AI:
 * - Numerology (Chaldean & Pythagorean)
 * - Planetary hours (Hora)
 * - Panchang basics
 * - Day quality assessment
 * - Lucky number/color/time
 *
 * When converted to a mobile app, this module runs entirely offline.
 */

// ─── Numerology Engine ──────────────────────────────────────────────────────

const CHALDEAN_MAP: Record<string, number> = {
  a: 1, b: 2, c: 3, d: 4, e: 5, f: 8, g: 3, h: 5, i: 1,
  j: 1, k: 2, l: 3, m: 4, n: 5, o: 7, p: 8, q: 1, r: 2,
  s: 3, t: 4, u: 6, v: 6, w: 6, x: 5, y: 1, z: 7,
};

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

const NUMBER_MEANINGS: Record<number, {
  planet: string; meaning: string; strengths: string[];
  cautions: string[]; colors: string[]; days: string[];
}> = {
  1: { planet: 'Sun', meaning: 'Leadership & Independence', strengths: ['Leadership', 'Innovation', 'Confidence'], cautions: ['Ego', 'Stubbornness'], colors: ['Gold', 'Orange'], days: ['Sunday'] },
  2: { planet: 'Moon', meaning: 'Diplomacy & Sensitivity', strengths: ['Intuition', 'Cooperation', 'Empathy'], cautions: ['Indecisiveness', 'Over-sensitivity'], colors: ['White', 'Silver'], days: ['Monday'] },
  3: { planet: 'Jupiter', meaning: 'Expression & Creativity', strengths: ['Communication', 'Optimism', 'Artistic talent'], cautions: ['Scattered energy', 'Overindulgence'], colors: ['Yellow', 'Purple'], days: ['Thursday'] },
  4: { planet: 'Rahu', meaning: 'Stability & Hard Work', strengths: ['Discipline', 'Innovation', 'Foundation-building'], cautions: ['Rigidity', 'Unexpected changes'], colors: ['Blue', 'Grey'], days: ['Saturday'] },
  5: { planet: 'Mercury', meaning: 'Freedom & Versatility', strengths: ['Adaptability', 'Quick thinking', 'Business acumen'], cautions: ['Restlessness', 'Inconsistency'], colors: ['Green'], days: ['Wednesday'] },
  6: { planet: 'Venus', meaning: 'Harmony & Responsibility', strengths: ['Artistic', 'Nurturing', 'Beauty sense'], cautions: ['Over-responsibility', 'Possessiveness'], colors: ['Pink', 'White'], days: ['Friday'] },
  7: { planet: 'Ketu', meaning: 'Spirituality & Analysis', strengths: ['Research', 'Wisdom', 'Introspection'], cautions: ['Isolation', 'Overthinking'], colors: ['Violet'], days: ['Monday'] },
  8: { planet: 'Saturn', meaning: 'Power & Material Mastery', strengths: ['Authority', 'Wealth potential', 'Discipline'], cautions: ['Workaholism', 'Karma tests'], colors: ['Dark Blue', 'Black'], days: ['Saturday'] },
  9: { planet: 'Mars', meaning: 'Completion & Humanitarianism', strengths: ['Courage', 'Compassion', 'Leadership'], cautions: ['Aggression', 'Impatience'], colors: ['Red'], days: ['Tuesday'] },
};

function reduceToSingle(num: number): number {
  while (num > 9) {
    num = String(num).split('').reduce((s, d) => s + parseInt(d), 0);
  }
  return num || 1;
}

export function analyzeNameOffline(name: string) {
  const cleaned = name.toLowerCase().replace(/[^a-z]/g, '');
  if (!cleaned) return null;

  let destinyTotal = 0, soulTotal = 0, personalityTotal = 0;
  for (const ch of cleaned) {
    const val = CHALDEAN_MAP[ch] || 0;
    destinyTotal += val;
    if (VOWELS.has(ch)) soulTotal += val;
    else personalityTotal += val;
  }

  const destinyNumber = reduceToSingle(destinyTotal);
  const soulNumber = reduceToSingle(soulTotal);
  const personalityNumber = reduceToSingle(personalityTotal);

  const meaning = NUMBER_MEANINGS[destinyNumber];
  return {
    name,
    destinyNumber, soulNumber, personalityNumber,
    meaning: meaning.meaning,
    planet: meaning.planet,
    strengths: meaning.strengths,
    cautions: meaning.cautions,
    luckyColors: meaning.colors,
    luckyDays: meaning.days,
  };
}

export function getPersonalYearOffline(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  const sum = dob.getDate() + (dob.getMonth() + 1) + now.getFullYear();
  return reduceToSingle(sum);
}

// ─── Planetary Hours Engine ─────────────────────────────────────────────────

const HORA_ORDER = ['Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars'];
const DAY_RULERS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];

const PLANET_ACTIVITIES: Record<string, { do: string[]; avoid: string[] }> = {
  Sun:     { do: ['Leadership decisions', 'Government work', 'Authority meetings'], avoid: ['Starting partnerships', 'Lending money'] },
  Moon:    { do: ['Public relations', 'Creative work', 'Travel'], avoid: ['Surgery', 'Conflicts'] },
  Mars:    { do: ['Competitive tasks', 'Physical activity', 'Negotiations'], avoid: ['Signing contracts', 'Medical procedures'] },
  Mercury: { do: ['Coding', 'Communication', 'Trading', 'Writing'], avoid: ['Major purchases', 'Long commitments'] },
  Jupiter: { do: ['Financial planning', 'Teaching', 'Spiritual practice'], avoid: ['Risky investments', 'Gambling'] },
  Venus:   { do: ['Client meetings', 'Art/design', 'Sales', 'Relationships'], avoid: ['Legal disputes', 'Heavy exercise'] },
  Saturn:  { do: ['Planning', 'Auditing', 'Discipline tasks', 'Cleaning'], avoid: ['Starting new ventures', 'Travel'] },
};

export interface OfflinePlanetaryHour {
  planet: string;
  startTime: string;
  endTime: string;
  activities: string[];
  avoid: string[];
  isCurrent: boolean;
}

export function calculatePlanetaryHoursOffline(date: Date = new Date()): OfflinePlanetaryHour[] {
  const dayOfWeek = date.getDay();
  const dayRuler = DAY_RULERS[dayOfWeek];
  const startIdx = HORA_ORDER.indexOf(dayRuler);

  // Approximate sunrise 6:00, sunset 18:00
  const sunrise = 6 * 60; // minutes from midnight
  const sunset = 18 * 60;
  const dayDuration = (sunset - sunrise) / 12; // ~60 min per day hora
  const nightDuration = ((24 * 60 - sunset) + sunrise) / 12; // ~60 min per night hora

  const nowMinutes = date.getHours() * 60 + date.getMinutes();
  const hours: OfflinePlanetaryHour[] = [];

  for (let i = 0; i < 24; i++) {
    const planetIdx = (startIdx + i) % 7;
    const planet = HORA_ORDER[planetIdx];
    const isDayHour = i < 12;
    const duration = isDayHour ? dayDuration : nightDuration;
    const startMin = isDayHour ? sunrise + i * duration : sunset + (i - 12) * duration;
    const endMin = startMin + duration;

    const fmtTime = (m: number) => {
      const h = Math.floor(m / 60) % 24;
      const min = Math.round(m % 60);
      const ampm = h >= 12 ? 'PM' : 'AM';
      return `${((h % 12) || 12).toString().padStart(2, '0')}:${min.toString().padStart(2, '0')} ${ampm}`;
    };

    const activities = PLANET_ACTIVITIES[planet];
    hours.push({
      planet,
      startTime: fmtTime(startMin),
      endTime: fmtTime(endMin),
      activities: activities.do,
      avoid: activities.avoid,
      isCurrent: nowMinutes >= startMin && nowMinutes < endMin,
    });
  }

  return hours;
}

// ─── Panchang Engine ────────────────────────────────────────────────────────

const TITHIS = [
  'Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami',
  'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami',
  'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi', 'Purnima',
  'Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami',
  'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami',
  'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi', 'Amavasya',
];

const NAKSHATRAS = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira',
  'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha',
  'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati',
  'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha',
  'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
  'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
];

const YOGAS = [
  'Vishkambha', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana',
  'Atiganda', 'Sukarman', 'Dhriti', 'Shula', 'Ganda',
  'Vriddhi', 'Dhruva', 'Vyaghata', 'Harshana', 'Vajra',
  'Siddhi', 'Vyatipata', 'Variyan', 'Parigha', 'Shiva',
  'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma',
  'Indra', 'Vaidhriti',
];

const VARAS = ['Ravivaar', 'Somvaar', 'Mangalvaar', 'Budhvaar', 'Guruvaar', 'Shukravaar', 'Shanivaar'];

const RAHU_KAAL: Record<number, string> = {
  0: '04:30 PM - 06:00 PM',
  1: '07:30 AM - 09:00 AM',
  2: '03:00 PM - 04:30 PM',
  3: '12:00 PM - 01:30 PM',
  4: '01:30 PM - 03:00 PM',
  5: '10:30 AM - 12:00 PM',
  6: '09:00 AM - 10:30 AM',
};

export interface OfflinePanchang {
  date: string;
  tithi: string;
  paksha: string;
  nakshatra: string;
  yoga: string;
  vara: string;
  rahukaal: string;
  sunrise: string;
  sunset: string;
}

export function calculatePanchangOffline(date: Date = new Date()): OfflinePanchang {
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  const tithiIdx = dayOfYear % 30;
  const nakshatraIdx = dayOfYear % 27;
  const yogaIdx = (dayOfYear + 3) % 27;
  const dayOfWeek = date.getDay();

  return {
    date: date.toISOString().split('T')[0],
    tithi: (tithiIdx < 15 ? 'Shukla ' : 'Krishna ') + TITHIS[tithiIdx],
    paksha: tithiIdx < 15 ? 'Shukla Paksha' : 'Krishna Paksha',
    nakshatra: NAKSHATRAS[nakshatraIdx],
    yoga: YOGAS[yogaIdx],
    vara: VARAS[dayOfWeek],
    rahukaal: RAHU_KAAL[dayOfWeek],
    sunrise: '06:15 AM',
    sunset: '06:30 PM',
  };
}

// ─── Day Quality Assessment ─────────────────────────────────────────────────

const GOOD_NAKSHATRAS = new Set(['Rohini', 'Pushya', 'Hasta', 'Shravana', 'Revati', 'Ashwini', 'Mrigashira', 'Chitra', 'Swati', 'Anuradha', 'Punarvasu']);
const CHALLENGING_NAKSHATRAS = new Set(['Ardra', 'Ashlesha', 'Jyeshtha', 'Mula', 'Bharani']);

export function assessDayQualityOffline(date: Date = new Date()): {
  quality: 'excellent' | 'good' | 'moderate' | 'challenging';
  summary: string;
  doList: string[];
  avoidList: string[];
  luckyColor: string;
  luckyNumber: number;
  luckyTime: string;
} {
  const panchang = calculatePanchangOffline(date);
  const isShukla = panchang.paksha === 'Shukla Paksha';
  const isGoodNakshatra = GOOD_NAKSHATRAS.has(panchang.nakshatra);
  const isChallenging = CHALLENGING_NAKSHATRAS.has(panchang.nakshatra);

  let quality: 'excellent' | 'good' | 'moderate' | 'challenging';
  if (isShukla && isGoodNakshatra) quality = 'excellent';
  else if (isShukla || isGoodNakshatra) quality = 'good';
  else if (isChallenging) quality = 'challenging';
  else quality = 'moderate';

  const dayOfWeek = date.getDay();
  const dayPlanet = DAY_RULERS[dayOfWeek];
  const activities = PLANET_ACTIVITIES[dayPlanet];
  const meaning = NUMBER_MEANINGS[reduceToSingle(date.getDate())];

  const summaryMap = {
    excellent: `An excellent day for new beginnings. ${panchang.nakshatra} nakshatra and ${panchang.paksha} create highly auspicious energy. ${panchang.vara} enhances ${dayPlanet} qualities.`,
    good: `A good day for steady progress. ${panchang.nakshatra} nakshatra supports productive work. Use ${dayPlanet} energy for ${activities.do[0].toLowerCase()}.`,
    moderate: `A moderate day — proceed with awareness. ${panchang.nakshatra} nakshatra suggests careful planning. Focus on routine tasks and avoid major decisions during Rahu Kaal (${panchang.rahukaal}).`,
    challenging: `A challenging day requiring patience. ${panchang.nakshatra} nakshatra brings intensity. Avoid confrontations and focus on inner work. Chanting and meditation are highly recommended.`,
  };

  return {
    quality,
    summary: summaryMap[quality],
    doList: [...activities.do, 'Meditation or prayer', `Wear ${meaning.colors[0]} for positive energy`],
    avoidList: [...activities.avoid, `Avoid decisions during Rahu Kaal (${panchang.rahukaal})`],
    luckyColor: meaning.colors[0],
    luckyNumber: reduceToSingle(date.getDate() + date.getMonth() + 1),
    luckyTime: dayOfWeek % 2 === 0 ? '09:00 AM - 10:30 AM' : '02:00 PM - 03:30 PM',
  };
}

// ─── Offline Data Cache (for mobile) ────────────────────────────────────────

const OFFLINE_CACHE_KEY = 'jyotryx-offline-data';

export interface OfflineCachedData {
  dailyBriefing: ReturnType<typeof assessDayQualityOffline> | null;
  panchang: OfflinePanchang | null;
  planetaryHours: OfflinePlanetaryHour[] | null;
  cachedDate: string;
  lastSyncedAt: string | null;
}

export function getOfflineCache(): OfflineCachedData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(OFFLINE_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setOfflineCache(data: Partial<OfflineCachedData>): void {
  if (typeof window === 'undefined') return;
  const existing = getOfflineCache() || {
    dailyBriefing: null, panchang: null, planetaryHours: null,
    cachedDate: '', lastSyncedAt: null,
  };
  localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify({
    ...existing,
    ...data,
    cachedDate: new Date().toISOString().split('T')[0],
  }));
}

/**
 * Generate a complete daily package for offline use.
 * Call this on app launch or when syncing daily data.
 */
export function generateOfflineDailyPackage(date: Date = new Date()) {
  const panchang = calculatePanchangOffline(date);
  const planetaryHours = calculatePlanetaryHoursOffline(date);
  const dayAssessment = assessDayQualityOffline(date);

  const data: OfflineCachedData = {
    dailyBriefing: dayAssessment,
    panchang,
    planetaryHours,
    cachedDate: date.toISOString().split('T')[0],
    lastSyncedAt: new Date().toISOString(),
  };

  setOfflineCache(data);
  return data;
}
