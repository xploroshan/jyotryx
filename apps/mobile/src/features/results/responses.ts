/**
 * API response shapes for the Vedic features, transcribed from the web clients
 * (only the fields the mobile result screens render). The backend remains the
 * source of truth; these are the render contracts.
 */

// ── Birth-chart family ──
export interface DashaPeriod {
  planet: string;
  startDate: string;
  endDate: string;
  subPeriods?: { planet: string; startDate: string; endDate: string }[];
}
export interface KundliData {
  id: string;
  ascendant: string;
  moonSign: string;
  sunSign: string;
  nakshatra: string;
  houses: { house: number; sign: string; planets: string[] }[];
  planetaryPositions: {
    planet: string;
    sign: string;
    house: number;
    degree: number;
    isRetrograde: boolean;
    nakshatra?: string;
  }[];
  dashas: DashaPeriod[];
  yogas: { name: string; description: string; effect: string }[];
}
export interface DoshaData {
  userId: string;
  doshas: { name: string; present: boolean; severity: string; description: string; remedies: string[] }[];
}
export interface DivisionalData {
  type: string;
  divisor: number;
  positions: { planet: string; sign: string; degree: number }[];
}
export interface KpData {
  system: string;
  cusps: { cusp: number; sign: string; nakshatra: string; starLord: string; subLord: string; longitude: number }[];
  planets: { planet: string; sign: string; nakshatra: string; starLord: string; subLord: string; degree: number }[];
  significators: Record<string, string[]>;
}
export interface MatchingData {
  totalScore: number;
  maxScore: number;
  manglikA: boolean;
  manglikB: boolean;
  gunaDetails: { guna: string; description: string; obtainedPoints: number; maxPoints: number }[];
  compatibility: string;
  recommendation: string;
}

// ── Time/calendar family ──
export interface HoroscopeData {
  prediction?: string;
  forecast?: string;
  love?: string;
  career?: string;
  health?: string;
  luckyNumber?: string | number;
  lucky_number?: string | number;
  luckyColor?: string;
  lucky_color?: string;
  compatibility?: string;
  mood?: string;
}
export interface PanchangData {
  date: string;
  tithi: string;
  nakshatra: string;
  yoga: string;
  karana: string;
  vara: string;
  sunrise: string;
  sunset: string;
  moonrise: string;
  rahukaal: string;
  gulikakaal: string;
  yamakantaka: string;
}
export interface MuhuratData {
  purpose: string;
  auspiciousTimes: { date: string; startTime: string; endTime: string; quality: string; reason: string }[];
}
export interface CosmicData {
  year: number;
  month: number;
  activity: string;
  location: string;
  days: { date: string; tithi: string; nakshatra: string; score: number; recommendation: string }[];
}
export interface DecisionData {
  activity: string;
  date: string;
  time: string | null;
  location: string;
  score: number;
  recommendation: string;
  factors: { code: string; label: string; detail?: string; contribution: string }[];
  panchang: { tithi: string; nakshatra: string; yoga: string; vara: string; rahuKaal: string };
}

// ── Misc family ──
export interface NameData {
  name: string;
  destinyNumber: number;
  soulNumber: number;
  personalityNumber: number;
  destinyMeaning: string;
  soulMeaning: string;
  personalityMeaning: string;
  overallVerdict: string;
  strengths: string[];
  cautions: string[];
  luckyColors: string[];
  rulingPlanet: string;
  suggestion: string;
}
export interface BrandData {
  brandName: string;
  nameNumber: number;
  vibration: string;
  planetaryRuler: string;
  suitableFor: string[];
  avoidFor: string[];
  overallScore: number;
  recommendation: string;
  luckyColors: string[];
}
export interface PersonalYearData {
  personalYear: number;
  theme: string;
  description: string;
  career: string;
  finance: string;
  relationships: string;
  health: string;
  months: { month: string; focus: string }[];
}
export interface MulankData {
  hasBirthDetails?: boolean;
  mulank: number;
  bhagyank: number;
  summary: string;
  luckyNumbers: number[];
  mulankProfile?: { title?: string; planet?: string; essence?: string; strengths?: string[]; remedies?: string[] };
  bhagyankProfile?: { title?: string; planet?: string };
}
export interface TarotData {
  id: string;
  spread: string;
  cards: { name: string; position: string; isReversed: boolean; meaning: string; reversed: string; arcana: string }[];
  interpretation: {
    overall: string;
    cardInterpretations: { card: string; position: string; meaning: string }[];
    advice: string;
    spiritualGuidance: string;
  };
}
export interface VastuData {
  propertyType: string;
  entrance: { direction: string; score: number; verdict: string; deity: string; element: string };
  directions: { direction: string; deity: string; element: string; suitableRooms: string[]; avoid: string[] }[];
  propertyTips: string[];
  insights: { summary: string; remedies: string[]; gemstone: string; mantra: string; favorableChanges: string[] };
}
