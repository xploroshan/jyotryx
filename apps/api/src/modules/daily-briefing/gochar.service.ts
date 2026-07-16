import { Injectable, Logger, Optional } from '@nestjs/common';
import { EphemerisService } from '../../ephemeris/ephemeris.service';
import { GeoService } from '../geo/geo.service';
import {
  ALL_SIGNS,
  DayQuality,
  PANCHANG_NAKSHATRAS,
  PANCHANG_RAHU_KAALS,
  PANCHANG_TITHIS,
  PANCHANG_VARA_KEYS,
  PANCHANG_YOGAS,
  buildTransitAlert,
  computeChandraBala,
  computeJupiterTransit,
  computeSadeSati,
  computeTaraBala,
  moonSignLord,
  nakshatraIndexFromLongitude,
  personalizedDayQuality,
  personalizedFocusGraha,
  personalizedGuidance,
  personalizedLuckyColor,
  personalizedLuckyNumber,
  signIndexFromLongitude,
} from './gochar.util';

/** Birth fields needed to compute a natal chart. */
export interface GocharUserInput {
  dateOfBirth: Date | string | null;
  timeOfBirth: string | null;
  placeOfBirth: unknown; // expected JSON: { lat, lng, name }
}

/** The personalized overlay derived from a user's chart for a given day. */
export interface GocharPersonalization {
  moonSign: string;
  natalNakshatra: string;
  dayQuality: DayQuality;
  luckyColor: string;
  luckyNumber: number;
  transitAlert: string | null;
  /** A short clause to weave into the daily summary. */
  summaryInsight: string;
  /** Graha whose remedy/mantra is most relevant to the user's transits today. */
  focusGraha: string;
  /** The natal Moon-sign lord — used to pick the user's favourable hora window. */
  moonSignLord: string;
  /** One chart-based "do"/"avoid" clause to lead the daily lists. The `*Key`
   *  fields let the merge localize the clause via the KB briefing-phrase layer
   *  (same contract as the rest of the briefing prose); the text is the English
   *  fallback. */
  guidanceDo: string;
  guidanceAvoid: string;
  guidanceDoKey: string;
  guidanceAvoidKey: string;
}

/** Canonical panchang keys computed from real ephemeris longitudes. */
export interface EphemerisPanchang {
  pakshaKey: string;
  tithiKey: string;
  nakshatraKey: string;
  yogaKey: string;
  varaKey: string;
  rahukaal: string;
}

// Reference location for the (location-independent) tithi/nakshatra/yoga
// longitudes used by the shared panchang. Ujjain — the classical Indian
// prime meridian for Vedic almanacs.
const PANCHANG_REF_LAT = 23.1765;
const PANCHANG_REF_LNG = 75.7885;

@Injectable()
export class GocharService {
  private readonly logger = new Logger(GocharService.name);

  constructor(
    private readonly ephemerisService: EphemerisService,
    // Optional so the unit suite (which builds this service with only the
    // ephemeris) still works — the geocode fallback simply stays off.
    @Optional() private readonly geoService?: GeoService,
  ) {}

  private parseLatLng(placeOfBirth: unknown): { lat: number; lng: number } | null {
    if (!placeOfBirth || typeof placeOfBirth !== 'object') return null;
    const p = placeOfBirth as { lat?: unknown; lng?: unknown };
    const lat = typeof p.lat === 'number' ? p.lat : Number(p.lat);
    const lng = typeof p.lng === 'number' ? p.lng : Number(p.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
    return { lat, lng };
  }

  /** Extract the place NAME from either a `{ name }` object or a bare string. */
  private placeName(placeOfBirth: unknown): string | null {
    if (typeof placeOfBirth === 'string') return placeOfBirth.trim() || null;
    if (placeOfBirth && typeof placeOfBirth === 'object') {
      const n = (placeOfBirth as { name?: unknown }).name;
      if (typeof n === 'string' && n.trim()) return n.trim();
    }
    return null;
  }

  /**
   * Resolve birth coordinates: use stored lat/lng when present, else geocode
   * the stored place NAME via the shared geo proxy (top hit). This lets a user
   * who only ever typed a city name (the common case — coordinates are only
   * captured when a place is picked from the autocomplete) still get a
   * chart-personalized reading, instead of being stuck on the shared almanac.
   */
  private async resolveCoords(placeOfBirth: unknown): Promise<{ lat: number; lng: number } | null> {
    const stored = this.parseLatLng(placeOfBirth);
    if (stored) return stored;
    const name = this.placeName(placeOfBirth);
    if (!name || !this.geoService) return null;
    try {
      const hits = await this.geoService.search(name, 1);
      if (hits[0]) return { lat: hits[0].lat, lng: hits[0].lng };
    } catch (err) {
      this.logger.warn(`Geocode of "${name}" failed: ${(err as Error)?.message ?? err}`);
    }
    return null;
  }

  /**
   * Compute the per-user Gochar personalization, or null when the user lacks
   * the birth data needed (date / time / geocoded place) to cast a chart.
   */
  async computePersonalization(user: GocharUserInput, today: Date): Promise<GocharPersonalization | null> {
    if (!user.dateOfBirth || !user.timeOfBirth) return null;
    const coords = await this.resolveCoords(user.placeOfBirth);
    if (!coords) return null;

    try {
      const dob = new Date(user.dateOfBirth);
      const [hh, mm] = (user.timeOfBirth || '6:0').split(':');
      const natal = await this.ephemerisService.computeChart({
        // UTC accessors: a stored DateTime read with server-local getFullYear/
        // getMonth/getDate shifts the natal date by a day on any non-UTC server.
        year: dob.getUTCFullYear(),
        month: dob.getUTCMonth() + 1,
        day: dob.getUTCDate(),
        hour: parseInt(hh, 10) || 0,
        minute: parseInt(mm, 10) || 0,
        lat: coords.lat,
        lng: coords.lng,
      });
      const transit = await this.ephemerisService.computeCurrentChart(coords.lat, coords.lng);

      const natalMoon = natal.positions.find((p) => p.name === 'Moon');
      if (!natalMoon) return null;
      const natalMoonSignIdx = signIndexFromLongitude(natalMoon.longitude);
      const natalNakIdx = nakshatraIndexFromLongitude(natalMoon.longitude);
      const moonSign = ALL_SIGNS[natalMoonSignIdx];

      const tMoon = transit.positions.find((p) => p.name === 'Moon');
      const tSaturn = transit.positions.find((p) => p.name === 'Saturn');
      const tJupiter = transit.positions.find((p) => p.name === 'Jupiter');
      if (!tMoon || !tSaturn || !tJupiter) return null;

      const sadeSati = computeSadeSati(signIndexFromLongitude(tSaturn.longitude), natalMoonSignIdx);
      const tara = computeTaraBala(nakshatraIndexFromLongitude(tMoon.longitude), natalNakIdx);
      const chandra = computeChandraBala(signIndexFromLongitude(tMoon.longitude), natalMoonSignIdx);
      const jupiter = computeJupiterTransit(signIndexFromLongitude(tJupiter.longitude), natalMoonSignIdx);

      // Base the personalized quality off a neutral "moderate" so it is driven
      // entirely by the user's own transits rather than the global day.
      const dayQuality = personalizedDayQuality('moderate', { tara, chandra, jupiter, sadeSati });

      const transitAlert = buildTransitAlert({ moonSign, sadeSati, jupiter, tara });
      const summaryInsight =
        `For your ${moonSign} Moon, today's Moon forms ${tara.name} Tara` +
        `${tara.favorable ? ' (supportive)' : tara.index === 1 ? ' (handle yourself gently)' : ' (stay measured)'}.`;

      const focusGraha = personalizedFocusGraha({ natalMoonSignIdx, tara, chandra, sadeSati });
      const guidance = personalizedGuidance({ tara, chandra, jupiter, sadeSati });

      return {
        moonSign,
        natalNakshatra: PANCHANG_NAKSHATRAS[natalNakIdx],
        dayQuality,
        luckyColor: personalizedLuckyColor(natalMoonSignIdx),
        luckyNumber: personalizedLuckyNumber(dob.getUTCDate()),
        transitAlert,
        summaryInsight,
        focusGraha,
        moonSignLord: moonSignLord(natalMoonSignIdx),
        guidanceDo: guidance.doItem,
        guidanceAvoid: guidance.avoidItem,
        guidanceDoKey: guidance.doKey,
        guidanceAvoidKey: guidance.avoidKey,
      };
    } catch (err) {
      this.logger.warn(`Gochar personalization failed: ${(err as Error)?.message ?? err}`);
      return null;
    }
  }

  /**
   * Real-ephemeris panchang for the shared/global almanac. Tithi, nakshatra
   * and yoga come from the true Sun/Moon sidereal longitudes; vara and
   * rahu-kaal remain weekday-derived.
   */
  async computeEphemerisPanchang(today: Date): Promise<EphemerisPanchang> {
    const chart = await this.ephemerisService.computeCurrentChart(PANCHANG_REF_LAT, PANCHANG_REF_LNG);
    const sun = chart.positions.find((p) => p.name === 'Sun');
    const moon = chart.positions.find((p) => p.name === 'Moon');
    if (!sun || !moon) throw new Error('Ephemeris returned no Sun/Moon position');

    const sunLong = ((sun.longitude % 360) + 360) % 360;
    const moonLong = ((moon.longitude % 360) + 360) % 360;

    // Tithi from Moon–Sun elongation (12° each).
    const elongation = ((moonLong - sunLong) % 360 + 360) % 360;
    const tithiIdx = Math.floor(elongation / 12) % 30;
    const pakshaKey = tithiIdx < 15 ? 'Shukla' : 'Krishna';

    // Nakshatra from the Moon's sidereal longitude (already Lahiri sidereal).
    const nakIdx = nakshatraIndexFromLongitude(moonLong);

    // Yoga from the sum of sidereal Sun + Moon longitudes (27 divisions).
    const yogaIdx = Math.floor((((moonLong + sunLong) % 360 + 360) % 360) / (360 / 27)) % 27;

    return {
      pakshaKey,
      // tithiIdx 29 is the new moon (Amavasya); % 15 would mislabel it 'Purnima'.
      tithiKey: tithiIdx === 29 ? 'Amavasya' : PANCHANG_TITHIS[tithiIdx % 15],
      nakshatraKey: PANCHANG_NAKSHATRAS[nakIdx],
      yogaKey: PANCHANG_YOGAS[yogaIdx],
      varaKey: PANCHANG_VARA_KEYS[today.getDay()],
      rahukaal: PANCHANG_RAHU_KAALS[today.getDay()],
    };
  }
}
