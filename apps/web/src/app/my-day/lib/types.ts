/**
 * Shared types for the My Day briefing. Extracted from page.tsx so the
 * caching helpers (briefingCache.ts) and unit tests can import them
 * without pulling the whole page component.
 */

export interface PlanetaryHour {
  planet: string;
  startTime: string;
  endTime: string;
  activities: string[];
  avoid: string[];
  isCurrent: boolean;
}

export interface DailyBriefing {
  greeting: string;
  date: string;
  dayQuality: 'excellent' | 'good' | 'moderate' | 'challenging';
  summary: string;
  doList: string[];
  avoidList: string[];
  planetaryHours: PlanetaryHour[];
  currentHora: PlanetaryHour | null;
  luckyColor: string;
  luckyNumber: number;
  luckyTime: string;
  professionInsight: string;
  remedy: string;
  mantra: string;
  panchang: {
    tithi: string;
    nakshatra: string;
    yoga: string;
    vara: string;
    rahukaal: string;
  };
  transitAlert: string | null;
  /** Natal Moon sign (Rashi) when the briefing is personalized to the user's
   *  birth chart; null when only the shared almanac is available. */
  moonSign?: string | null;
  /** True when the reading is derived from the user's own birth chart. When
   *  false, the card is the shared almanac and we prompt for birth details. */
  personalized?: boolean;
  /** Why the chart layer is / isn't active — drives the prompt copy. */
  personalizationReason?: 'ok' | 'no_birth_data' | 'missing_time' | 'missing_place' | 'unavailable';
}
