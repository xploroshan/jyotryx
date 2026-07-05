import { Injectable, Logger } from '@nestjs/common';
import { EphemerisService } from '../../ephemeris/ephemeris.service';
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
  nakshatraIndexFromLongitude,
  personalizedDayQuality,
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

  constructor(private readonly ephemerisService: EphemerisService) {}

  private parseLatLng(placeOfBirth: unknown): { lat: number; lng: number } | null {
    if (!placeOfBirth || typeof placeOfBirth !== 'object') return null;
    const p = placeOfBirth as { lat?: unknown; lng?: unknown };
    const lat = typeof p.lat === 'number' ? p.lat : Number(p.lat);
    const lng = typeof p.lng === 'number' ? p.lng : Number(p.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
    return { lat, lng };
  }

  /**
   * Compute the per-user Gochar personalization, or null when the user lacks
   * the birth data needed (date / time / geocoded place) to cast a chart.
   */
  async computePersonalization(user: GocharUserInput, today: Date): Promise<GocharPersonalization | null> {
    if (!user.dateOfBirth || !user.timeOfBirth) return null;
    const coords = this.parseLatLng(user.placeOfBirth);
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

      return {
        moonSign,
        natalNakshatra: PANCHANG_NAKSHATRAS[natalNakIdx],
        dayQuality,
        luckyColor: personalizedLuckyColor(natalMoonSignIdx),
        luckyNumber: personalizedLuckyNumber(dob.getUTCDate()),
        transitAlert,
        summaryInsight,
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
