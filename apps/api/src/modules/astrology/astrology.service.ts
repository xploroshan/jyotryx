import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { OpenAIService } from '../../openai/openai.service';
import { MemoryCacheService } from '../../common/cache.service';
import { KnowledgeService } from '../../knowledge/knowledge.service';
import { getLocaleInstruction } from '../../common/locale';
import * as path from 'path';

// ─── Swiss Ephemeris Setup ──────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-var-requires
const swisseph = require('swisseph');
const EPHE_PATH = path.join(path.dirname(require.resolve('swisseph')), 'ephe');
swisseph.swe_set_ephe_path(EPHE_PATH);
swisseph.swe_set_sid_mode(swisseph.SE_SIDM_LAHIRI, 0, 0);

// ─── Vedic Astrology Constants ──────────────────────────────────────────────
const ALL_SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'] as const;
const NAKSHATRA_NAMES = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Moola', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'] as const;
const DASHA_LORDS = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'] as const;
const DASHA_YEARS = [7, 20, 6, 10, 7, 18, 16, 19, 17] as const;

// Sign lords: Aries=Mars, Taurus=Venus, Gemini=Mercury, Cancer=Moon, Leo=Sun, Virgo=Mercury, Libra=Venus, Scorpio=Mars, Sagittarius=Jupiter, Capricorn=Saturn, Aquarius=Saturn, Pisces=Jupiter
const SIGN_LORDS = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'] as const;

// Planet exaltation signs (index in ALL_SIGNS): Sun=Aries, Moon=Taurus, Mars=Capricorn, Mercury=Virgo, Jupiter=Cancer, Venus=Pisces, Saturn=Libra
const EXALTATION: Record<string, number> = { Sun: 0, Moon: 1, Mars: 9, Mercury: 5, Jupiter: 3, Venus: 11, Saturn: 6 };
// Own signs
const OWN_SIGNS: Record<string, number[]> = { Sun: [4], Moon: [3], Mars: [0, 7], Mercury: [2, 5], Jupiter: [8, 11], Venus: [1, 6], Saturn: [9, 10] };

export interface BirthDetails {
  dateOfBirth: string;
  timeOfBirth: string;
  placeOfBirth: string;
  latitude?: number;
  longitude?: number;
}

export interface KundliResult {
  id: string;
  userId: string;
  birthDetails: BirthDetails;
  ascendant: string;
  moonSign: string;
  sunSign: string;
  nakshatra: string;
  houses: HousePlacement[];
  planetaryPositions: PlanetPosition[];
  dashas: DashaPeriod[];
  yogas: Yoga[];
  createdAt: string;
}

export interface HousePlacement {
  house: number;
  sign: string;
  planets: string[];
}

export interface PlanetPosition {
  planet: string;
  sign: string;
  house: number;
  degree: number;
  isRetrograde: boolean;
  nakshatra: string;
}

export interface DashaPeriod {
  planet: string;
  startDate: string;
  endDate: string;
  subPeriods?: DashaPeriod[];
}

export interface Yoga {
  name: string;
  description: string;
  effect: 'benefic' | 'malefic' | 'neutral';
}

export interface MatchingResult {
  id: string;
  partner1: BirthDetails;
  partner2: BirthDetails;
  totalScore: number;
  maxScore: number;
  gunaDetails: GunaDetail[];
  compatibility: string;
  recommendation: string;
}

export interface GunaDetail {
  guna: string;
  maxPoints: number;
  obtainedPoints: number;
  description: string;
}

export interface HoroscopeResult {
  sign: string;
  date: string;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  prediction: string;
  career: string;
  health: string;
  love: string;
  luckyNumber: number;
  luckyColor: string;
  mood: string;
  compatibility: string;
}

export interface PanchangResult {
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

export interface MuhuratRequest {
  purpose: string;
  fromDate: string;
  toDate: string;
  location: string;
}

export interface MuhuratResult {
  purpose: string;
  auspiciousTimes: {
    date: string;
    startTime: string;
    endTime: string;
    quality: 'excellent' | 'good' | 'average';
    reason: string;
  }[];
}

export interface DoshaResult {
  userId: string;
  doshas: {
    name: string;
    present: boolean;
    severity: 'none' | 'mild' | 'moderate' | 'severe';
    description: string;
    remedies: string[];
  }[];
}

@Injectable()
export class AstrologyService {
  private readonly logger = new Logger(AstrologyService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private userService: UserService,
    private openaiService: OpenAIService,
    private cacheService: MemoryCacheService,
    private knowledgeService: KnowledgeService,
  ) {}

  private async callOpenAI(
    systemPrompt: string,
    userPrompt: string,
    jsonMode: boolean = true,
    maxTokens: number = 1500,
    temperature: number = 0.7,
    featureTier: 'default' | 'precision' | 'vision' = 'default',
    locale?: string,
    context?: { userId?: string | null; feature?: string },
  ): Promise<any | null> {
    const localizedPrompt = systemPrompt + getLocaleInstruction(locale);
    return this.openaiService.chatCompletion({
      messages: [
        { role: 'system', content: localizedPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens,
      temperature,
      jsonMode,
      model: this.openaiService.getModelForFeature(featureTier),
      userId: context?.userId,
      feature: context?.feature || 'astrology',
    });
  }

  async generateKundli(userId: string, birthDetails: BirthDetails, locale?: string): Promise<KundliResult> {
    this.logger.log(`Generating Kundli for user: ${userId}`);

    const creditCost = this.configService.get<number>('credits.kundliCost', 2);
    const deducted = await this.userService.deductCredits(userId, creditCost, 'Kundli generation');
    if (!deducted) {
      throw new BadRequestException('Insufficient credits. Please purchase more credits to continue.');
    }

    const chartData = await this.generateAIKundli(birthDetails);

    const kundli = await this.prisma.kundliChart.create({
      data: {
        userId,
        name: 'Kundli Chart',
        dateOfBirth: new Date(birthDetails.dateOfBirth),
        timeOfBirth: birthDetails.timeOfBirth,
        placeOfBirth: {
          name: birthDetails.placeOfBirth,
          lat: birthDetails.latitude || 0,
          lng: birthDetails.longitude || 0,
        },
        chartData,
      },
    });

    return {
      id: kundli.id,
      userId,
      birthDetails,
      ...chartData,
      createdAt: kundli.createdAt.toISOString(),
    };
  }

  // ─── Swiss Ephemeris Helper: compute Julian Day from birth details ────────
  private computeJulianDay(bd: BirthDetails): number {
    const date = new Date(bd.dateOfBirth);
    const timeParts = bd.timeOfBirth?.split(':') || ['6', '0'];
    const hour = parseInt(timeParts[0], 10);
    const minute = parseInt(timeParts[1], 10) || 0;
    // Derive timezone offset from longitude if available, otherwise default to IST (+5:30)
    const tzOffset = bd.longitude != null ? bd.longitude / 15 : 5.5;
    const utHour = hour + minute / 60 - tzOffset;
    return swisseph.swe_julday(
      date.getFullYear(), date.getMonth() + 1, date.getDate(),
      utHour, swisseph.SE_GREG_CAL,
    );
  }

  // ─── Swiss Ephemeris: precise planetary positions ───────────────────────────
  private computePlanetaryPositions(jd: number): { name: string; longitude: number; speed: number }[] {
    const PLANETS = [
      { id: swisseph.SE_SUN, name: 'Sun' },
      { id: swisseph.SE_MOON, name: 'Moon' },
      { id: swisseph.SE_MARS, name: 'Mars' },
      { id: swisseph.SE_MERCURY, name: 'Mercury' },
      { id: swisseph.SE_JUPITER, name: 'Jupiter' },
      { id: swisseph.SE_VENUS, name: 'Venus' },
      { id: swisseph.SE_SATURN, name: 'Saturn' },
      { id: swisseph.SE_TRUE_NODE, name: 'Rahu' },
    ];
    const flags = swisseph.SEFLG_SIDEREAL | swisseph.SEFLG_SPEED;
    const positions = PLANETS.map(p => {
      const result = swisseph.swe_calc_ut(jd, p.id, flags);
      const lng = ((result.longitude % 360) + 360) % 360;
      return { name: p.name, longitude: lng, speed: result.longitudeSpeed || 0 };
    });
    // Ketu is always 180° from Rahu
    const rahu = positions.find(p => p.name === 'Rahu')!;
    positions.push({ name: 'Ketu', longitude: (rahu.longitude + 180) % 360, speed: rahu.speed });
    return positions;
  }

  // ─── Swiss Ephemeris: compute ascendant via swe_houses ──────────────────────
  private computeAscendant(jd: number, lat: number, lng: number): number {
    const houses = swisseph.swe_houses(jd, lat, lng, 'E'); // Equal house system
    return ((houses.ascendant % 360) + 360) % 360;
  }

  // ─── Deterministic Yoga Detection ───────────────────────────────────────────
  private detectYogas(positions: PlanetPosition[]): Yoga[] {
    const yogas: Yoga[] = [];
    const find = (name: string) => positions.find(p => p.planet === name);
    const findHouse = (name: string) => find(name)?.house;
    const findSign = (name: string) => find(name)?.sign;
    const signIndex = (sign: string) => ALL_SIGNS.indexOf(sign as any);
    const isKendra = (h: number) => [1, 4, 7, 10].includes(h);
    const isKendraFromMoon = (planetHouse: number, moonHouse: number) => {
      const diff = ((planetHouse - moonHouse + 12) % 12) + 1;
      return [1, 4, 7, 10].includes(diff);
    };

    const jupH = findHouse('Jupiter');
    const moonH = findHouse('Moon');
    const sunH = findHouse('Sun');
    const mercH = findHouse('Mercury');
    const venH = findHouse('Venus');
    const satH = findHouse('Saturn');
    const marsH = findHouse('Mars');

    const marsSign = signIndex(findSign('Mars') || '');
    const mercSign = signIndex(findSign('Mercury') || '');
    const jupSign = signIndex(findSign('Jupiter') || '');
    const venSign = signIndex(findSign('Venus') || '');
    const satSign = signIndex(findSign('Saturn') || '');

    const isInOwnOrExalted = (planet: string, signIdx: number): boolean => {
      return signIdx === EXALTATION[planet] || (OWN_SIGNS[planet] || []).includes(signIdx);
    };

    // ── Pancha Mahapurusha Yogas ──
    if (marsH && isKendra(marsH) && isInOwnOrExalted('Mars', marsSign)) {
      yogas.push({ name: 'Ruchaka Yoga', description: 'Mars in own/exalted sign in Kendra — strong physique, courage, leadership, success in military/sports/police', effect: 'benefic' });
    }
    if (mercH && isKendra(mercH) && isInOwnOrExalted('Mercury', mercSign)) {
      yogas.push({ name: 'Bhadra Yoga', description: 'Mercury in own/exalted sign in Kendra — exceptional intelligence, eloquent speech, success in business/academics', effect: 'benefic' });
    }
    if (jupH && isKendra(jupH) && isInOwnOrExalted('Jupiter', jupSign)) {
      yogas.push({ name: 'Hamsa Yoga', description: 'Jupiter in own/exalted sign in Kendra — righteous, learned, spiritually evolved, respected by scholars', effect: 'benefic' });
    }
    if (venH && isKendra(venH) && isInOwnOrExalted('Venus', venSign)) {
      yogas.push({ name: 'Malavya Yoga', description: 'Venus in own/exalted sign in Kendra — beautiful appearance, artistic talent, luxurious lifestyle, happy marriage', effect: 'benefic' });
    }
    if (satH && isKendra(satH) && isInOwnOrExalted('Saturn', satSign)) {
      yogas.push({ name: 'Shasha Yoga', description: 'Saturn in own/exalted sign in Kendra — authority through hard work, political power, lasting respect', effect: 'benefic' });
    }

    // ── Gaja Kesari Yoga ──
    if (jupH != null && moonH != null && isKendraFromMoon(jupH, moonH)) {
      yogas.push({ name: 'Gaja Kesari Yoga', description: 'Jupiter in Kendra from Moon — wisdom, fame, prosperity, leadership in community', effect: 'benefic' });
    }

    // ── Budhaditya Yoga ──
    if (sunH != null && mercH != null && sunH === mercH) {
      const sunDeg = find('Sun')?.degree || 0;
      const mercDeg = find('Mercury')?.degree || 0;
      const isCombust = Math.abs(sunDeg - mercDeg) < 3;
      yogas.push({
        name: 'Budhaditya Yoga',
        description: isCombust
          ? 'Sun-Mercury conjunction but Mercury is combust (within 3°) — intellect present but may be overshadowed by ego'
          : 'Sun-Mercury conjunction — sharp intellect, communication skills, success in education',
        effect: isCombust ? 'neutral' : 'benefic',
      });
    }

    // ── Chandra Yogas: Sunapha, Anapha, Durudhura ──
    if (moonH != null) {
      const houseAfterMoon = (moonH % 12) + 1; // 2nd from Moon
      const houseBeforeMoon = ((moonH - 2 + 12) % 12) + 1; // 12th from Moon
      const planetsAfter = positions.filter(p => p.house === houseAfterMoon && !['Moon', 'Rahu', 'Ketu'].includes(p.planet));
      const planetsBefore = positions.filter(p => p.house === houseBeforeMoon && !['Moon', 'Rahu', 'Ketu'].includes(p.planet));

      if (planetsAfter.length > 0 && planetsBefore.length === 0) {
        yogas.push({ name: 'Sunapha Yoga', description: `${planetsAfter.map(p => p.planet).join(', ')} in 2nd from Moon — self-made wealth, good intellect`, effect: 'benefic' });
      }
      if (planetsBefore.length > 0 && planetsAfter.length === 0) {
        yogas.push({ name: 'Anapha Yoga', description: `${planetsBefore.map(p => p.planet).join(', ')} in 12th from Moon — good health, virtuous character, comfort`, effect: 'benefic' });
      }
      if (planetsAfter.length > 0 && planetsBefore.length > 0) {
        yogas.push({ name: 'Durudhura Yoga', description: 'Planets on both sides of Moon — wealth, generous nature, fame, vehicles', effect: 'benefic' });
      }
      if (planetsAfter.length === 0 && planetsBefore.length === 0) {
        // Check if Moon has conjunction or benefic aspect for cancellation
        const moonConjunct = positions.filter(p => p.house === moonH && p.planet !== 'Moon');
        if (moonConjunct.length === 0) {
          yogas.push({ name: 'Kemadruma Yoga', description: 'No planets in 2nd/12th from Moon and no conjunction — may face difficulties, loneliness; check cancellation conditions', effect: 'malefic' });
        }
      }
    }

    // ── Dhana Yoga (simplified: 2nd lord + 11th lord connection) ──
    const ascSign = positions.find(p => p.house === 1)?.sign;
    if (ascSign) {
      const ascIdx = signIndex(ascSign);
      const lord2Sign = SIGN_LORDS[(ascIdx + 1) % 12];
      const lord11Sign = SIGN_LORDS[(ascIdx + 10) % 12];
      const lord2House = positions.find(p => p.planet === lord2Sign)?.house;
      const lord11House = positions.find(p => p.planet === lord11Sign)?.house;
      if (lord2House && lord11House && lord2House === lord11House) {
        yogas.push({ name: 'Dhana Yoga', description: `2nd lord (${lord2Sign}) and 11th lord (${lord11Sign}) conjunct — strong wealth potential`, effect: 'benefic' });
      }
    }

    // ── Raja Yoga (Kendra-Trikona lord connection) ──
    if (ascSign) {
      const ascIdx = signIndex(ascSign);
      const kendraHouses = [0, 3, 6, 9]; // 1st, 4th, 7th, 10th sign offsets
      const trikonaHouses = [0, 4, 8]; // 1st, 5th, 9th sign offsets
      const kendraLords = new Set(kendraHouses.map(h => SIGN_LORDS[(ascIdx + h) % 12]));
      const trikonaLords = new Set(trikonaHouses.map(h => SIGN_LORDS[(ascIdx + h) % 12]));
      for (const kl of kendraLords) {
        for (const tl of trikonaLords) {
          if (kl !== tl) {
            const klHouse = findHouse(kl);
            const tlHouse = findHouse(tl);
            if (klHouse && tlHouse && klHouse === tlHouse) {
              yogas.push({ name: 'Raja Yoga', description: `Kendra lord (${kl}) and Trikona lord (${tl}) conjunct — power, authority, fame, success`, effect: 'benefic' });
              break;
            }
          }
        }
        if (yogas.some(y => y.name === 'Raja Yoga')) break;
      }
    }

    // ── Viparita Raja Yoga (dusthana lords in dusthana) ──
    if (ascSign) {
      const ascIdx = signIndex(ascSign);
      const dusthanaOffsets = [5, 7, 11]; // 6th, 8th, 12th
      const dusthanaLords = dusthanaOffsets.map(h => ({ lord: SIGN_LORDS[(ascIdx + h) % 12], houseNum: h + 1 }));
      for (const dl of dusthanaLords) {
        const dlHouse = findHouse(dl.lord);
        if (dlHouse && [6, 8, 12].includes(dlHouse) && dlHouse !== dl.houseNum) {
          yogas.push({ name: 'Viparita Raja Yoga', description: `${dl.lord} (lord of ${dl.houseNum}th) placed in dusthana house ${dlHouse} — success through adversity`, effect: 'benefic' });
          break;
        }
      }
    }

    return yogas;
  }

  // ─── Deterministic Dosha Detection ──────────────────────────────────────────
  private detectDoshas(positions: PlanetPosition[]): DoshaResult['doshas'] {
    const doshas: DoshaResult['doshas'] = [];
    const findHouse = (name: string) => positions.find(p => p.planet === name)?.house;
    const findSign = (name: string) => positions.find(p => p.planet === name)?.sign;
    const signIndex = (sign: string) => ALL_SIGNS.indexOf(sign as any);

    const marsHouse = findHouse('Mars');
    const marsSign = findSign('Mars') || '';
    const marsSignIdx = signIndex(marsSign);

    // ── Mangal Dosha ──
    const manglikHouses = [1, 2, 4, 7, 8, 12];
    const isManglik = marsHouse != null && manglikHouses.includes(marsHouse);
    let manglikCancelled = false;
    if (isManglik) {
      // Cancellation: Mars in own sign or exalted
      if (marsSignIdx === EXALTATION.Mars || (OWN_SIGNS.Mars || []).includes(marsSignIdx)) manglikCancelled = true;
      // Cancellation: Mars conjunct/aspected by Jupiter
      const jupHouse = findHouse('Jupiter');
      if (jupHouse === marsHouse) manglikCancelled = true;
      // Jupiter aspects: 5th, 7th, 9th from its position
      if (jupHouse != null) {
        const jupAspects = [jupHouse, (jupHouse + 4 - 1) % 12 + 1, (jupHouse + 6 - 1) % 12 + 1, (jupHouse + 8 - 1) % 12 + 1];
        if (jupAspects.includes(marsHouse)) manglikCancelled = true;
      }
    }
    const manglikSeverity = !isManglik ? 'none' : manglikCancelled ? 'mild' : (marsHouse === 7 || marsHouse === 8) ? 'severe' : 'moderate';
    doshas.push({
      name: 'Mangal Dosha (Manglik)',
      present: isManglik && !manglikCancelled,
      severity: manglikSeverity,
      description: !isManglik
        ? 'No Mangal Dosha detected. Mars is well-placed in your chart.'
        : manglikCancelled
          ? `Mars is in house ${marsHouse} (Manglik position) but the dosha is cancelled due to ${marsSignIdx === EXALTATION.Mars ? 'Mars being exalted' : 'Jupiter\'s benefic influence'}.`
          : `Mars is placed in the ${marsHouse}${marsHouse === 1 ? 'st' : marsHouse === 2 ? 'nd' : 'th'} house, creating Mangal Dosha. This may affect marital harmony.${marsHouse === 7 ? ' Mars in 7th house is the most severe form.' : ''}`,
      remedies: isManglik && !manglikCancelled
        ? ['Perform Mangal Shanti Puja on Tuesdays', 'Chant Hanuman Chalisa on Tuesdays', 'Wear red coral gemstone (consult astrologer first)', 'Kumbh Vivah ritual before marriage']
        : [],
    });

    // ── Kaal Sarp Dosha ──
    const rahuHouse = findHouse('Rahu');
    const ketuHouse = findHouse('Ketu');
    let isKaalSarp = false;
    if (rahuHouse != null && ketuHouse != null) {
      const otherPlanets = positions.filter(p => !['Rahu', 'Ketu'].includes(p.planet));
      // Check if all planets are between Rahu and Ketu (going forward from Rahu)
      const span = ((ketuHouse - rahuHouse + 12) % 12);
      const allBetween = otherPlanets.every(p => {
        const dist = ((p.house - rahuHouse + 12) % 12);
        return dist > 0 && dist < span;
      });
      const allBetweenReverse = otherPlanets.every(p => {
        const dist = ((p.house - ketuHouse + 12) % 12);
        return dist > 0 && dist < ((rahuHouse - ketuHouse + 12) % 12);
      });
      isKaalSarp = allBetween || allBetweenReverse;
    }
    doshas.push({
      name: 'Kaal Sarp Dosha',
      present: isKaalSarp,
      severity: isKaalSarp ? 'moderate' : 'none',
      description: isKaalSarp
        ? `All planets are hemmed between Rahu (house ${rahuHouse}) and Ketu (house ${ketuHouse}), forming Kaal Sarp Dosha. This may cause sudden ups and downs in life. The dosha weakens after age 33.`
        : 'No Kaal Sarp Dosha present. Planets are well-distributed across the chart.',
      remedies: isKaalSarp
        ? ['Perform Kaal Sarp Dosha Nivaran Puja at Trimbakeshwar', 'Chant Rahu Beej Mantra on Saturdays', 'Donate black sesame seeds on Saturdays', 'Worship Lord Shiva with Abhishekam on Mondays']
        : [],
    });

    // ── Nadi Dosha ──
    // Nadi (pulse type) based on nakshatra: cyclic Aadi(0), Madhya(1), Antya(2)
    const moonPos = positions.find(p => p.planet === 'Moon');
    if (moonPos) {
      const moonLng = moonPos.degree + (ALL_SIGNS.indexOf(moonPos.sign as any) * 30);
      const moonNakIdx = Math.floor(((moonLng % 360 + 360) % 360) / (360 / 27)) % 27;
      const nadiTypes = ['Aadi (Vata)', 'Madhya (Pitta)', 'Antya (Kapha)'];
      const nadiIdx = moonNakIdx % 3;
      const nadiType = nadiTypes[nadiIdx];
      doshas.push({
        name: 'Nadi Dosha',
        present: false, // Standalone detection — presence determined during matching
        severity: 'none',
        description: `Your Nadi type is ${nadiType}, derived from Moon nakshatra. Nadi Dosha occurs when both partners share the same Nadi type in matching.`,
        remedies: [],
      });
    }

    // ── Pitra Dosha ──
    const sunHouse = findHouse('Sun');
    const sunRahuConjunct = sunHouse != null && rahuHouse != null && sunHouse === rahuHouse;
    doshas.push({
      name: 'Pitra Dosha',
      present: sunRahuConjunct,
      severity: sunRahuConjunct ? 'mild' : 'none',
      description: sunRahuConjunct
        ? `Sun-Rahu conjunction in house ${sunHouse} indicates ancestral karmic debt. This may affect family harmony and career growth.`
        : 'No significant Pitra Dosha detected in your chart.',
      remedies: sunRahuConjunct
        ? ['Perform Pitra Shanti Puja on Amavasya', 'Offer Tarpan for ancestors during Pitru Paksha', 'Donate food to Brahmins on Saturdays', 'Plant a Peepal tree and water it regularly']
        : [],
    });

    return doshas;
  }

  // ─── Primary Kundli generation using Swiss Ephemeris (deterministic) ────────
  private generateSwissEphKundli(birthDetails: BirthDetails): any {
    const jd = this.computeJulianDay(birthDetails);
    const lat = birthDetails.latitude || 28.6139;
    const lng = birthDetails.longitude || 77.2090;

    // 1. Compute precise planetary positions via Swiss Ephemeris
    const rawPositions = this.computePlanetaryPositions(jd);

    // 2. Compute ascendant
    const ascLongitude = this.computeAscendant(jd, lat, lng);
    const ascIdx = Math.floor(ascLongitude / 30) % 12;
    const ascendant = ALL_SIGNS[ascIdx];

    // 3. Build houses (Equal House system from ascendant)
    const houses: HousePlacement[] = Array.from({ length: 12 }, (_, i) => ({
      house: i + 1,
      sign: ALL_SIGNS[(ascIdx + i) % 12],
      planets: [] as string[],
    }));

    // 4. Map planets to positions
    const planetaryPositions: PlanetPosition[] = rawPositions.map(p => {
      const signIdx = Math.floor(p.longitude / 30) % 12;
      const houseNum = ((signIdx - ascIdx + 12) % 12) + 1;
      houses[houseNum - 1].planets.push(p.name);
      const nakIdx = Math.floor(p.longitude / (360 / 27)) % 27;
      return {
        planet: p.name,
        sign: ALL_SIGNS[signIdx],
        house: houseNum,
        degree: parseFloat((p.longitude % 30).toFixed(2)),
        isRetrograde: p.name === 'Rahu' || p.name === 'Ketu' ? true : p.speed < 0,
        nakshatra: NAKSHATRA_NAMES[nakIdx],
      };
    });

    // 5. Moon data for nakshatra and dasha
    const moon = rawPositions.find(p => p.name === 'Moon')!;
    const moonNakIdx = Math.floor(moon.longitude / (360 / 27)) % 27;
    const nakshatra = NAKSHATRA_NAMES[moonNakIdx];
    const moonSign = ALL_SIGNS[Math.floor(moon.longitude / 30) % 12];

    const sun = rawPositions.find(p => p.name === 'Sun')!;
    const sunSign = ALL_SIGNS[Math.floor(sun.longitude / 30) % 12];

    // 6. Vimshottari Dasha calculation
    const date = new Date(birthDetails.dateOfBirth);
    const year = date.getFullYear();
    const nakshatraSpan = 360 / 27; // 13.333°
    const posInNak = moon.longitude % nakshatraSpan;
    const fractionElapsed = posInNak / nakshatraSpan;
    const startIdx = moonNakIdx % 9;
    const firstDashaBalance = DASHA_YEARS[startIdx] * (1 - fractionElapsed);

    const dashas: DashaPeriod[] = [];
    let dashaStartYear = year - (DASHA_YEARS[startIdx] - firstDashaBalance);
    for (let i = 0; i < 9; i++) {
      const idx = (startIdx + i) % 9;
      const years = i === 0 ? firstDashaBalance : DASHA_YEARS[idx];
      const startDate = `${Math.round(dashaStartYear)}-01-01`;
      dashaStartYear += years;
      const endDate = `${Math.round(dashaStartYear)}-01-01`;

      // Sub-periods (Antardashas) with Pratyantardashas
      const subPeriods: DashaPeriod[] = [];
      let subStart = parseFloat(startDate.split('-')[0]);
      for (let j = 0; j < 9; j++) {
        const subIdx = (idx + j) % 9;
        const subYears = (DASHA_YEARS[idx] * DASHA_YEARS[subIdx]) / 120;
        const actualSubYears = i === 0 && j === 0 ? subYears * (1 - fractionElapsed) : subYears;

        // Pratyantardashas (3rd level)
        const pratyPeriods: DashaPeriod[] = [];
        let pratyStart = subStart;
        for (let k = 0; k < 9; k++) {
          const pratyIdx = (subIdx + k) % 9;
          const pratyYears = (DASHA_YEARS[idx] * DASHA_YEARS[subIdx] * DASHA_YEARS[pratyIdx]) / (120 * 120);
          const actualPratyYears = i === 0 && j === 0 && k === 0 ? pratyYears * (1 - fractionElapsed) : pratyYears;
          pratyPeriods.push({
            planet: DASHA_LORDS[pratyIdx],
            startDate: `${Math.round(pratyStart)}-01-01`,
            endDate: `${Math.round(pratyStart + actualPratyYears)}-01-01`,
          });
          pratyStart += actualPratyYears;
        }

        subPeriods.push({
          planet: DASHA_LORDS[subIdx],
          startDate: `${Math.round(subStart)}-01-01`,
          endDate: `${Math.round(subStart + actualSubYears)}-01-01`,
          subPeriods: pratyPeriods,
        });
        subStart += actualSubYears;
      }

      dashas.push({ planet: DASHA_LORDS[idx], startDate, endDate, subPeriods });
    }

    // 7. Deterministic yoga detection
    const yogas = this.detectYogas(planetaryPositions);

    return {
      ascendant,
      moonSign,
      sunSign,
      nakshatra,
      houses,
      planetaryPositions,
      dashas,
      yogas,
    };
  }

  private async generateAIKundli(birthDetails: BirthDetails): Promise<any> {
    // PRIMARY: Use Swiss Ephemeris for precise deterministic calculations.
    // The chart is a pure function of (date, time, place, lat, lng) so it is safe
    // to memoize across users. This eliminates the dominant Swiss Ephemeris cost
    // for the 2nd+ kundli request with identical inputs (e.g. a user re-opening
    // their own chart or matching both partners repeatedly).
    const cacheKey = `kundli:chart:${birthDetails.dateOfBirth}:${birthDetails.timeOfBirth}:${birthDetails.placeOfBirth}:${birthDetails.latitude ?? ''}:${birthDetails.longitude ?? ''}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;
    const chartData = this.generateSwissEphKundli(birthDetails);
    // 24h TTL — birth charts are fully deterministic so TTL is a safety net only.
    await this.cacheService.set(cacheKey, chartData, 24 * 60 * 60 * 1000);
    return chartData;
  }

  // ─── Swiss Ephemeris: get Moon data for matching ─────────────────────────────
  private getMoonDataFromSwissEph(bd: BirthDetails): { signIdx: number; nakIdx: number } {
    const jd = this.computeJulianDay(bd);
    const flags = swisseph.SEFLG_SIDEREAL | swisseph.SEFLG_SPEED;
    const result = swisseph.swe_calc_ut(jd, swisseph.SE_MOON, flags);
    const lng = ((result.longitude % 360) + 360) % 360;
    return {
      signIdx: Math.floor(lng / 30) % 12,
      nakIdx: Math.floor(lng / (360 / 27)) % 27,
    };
  }

  async getMatching(userId: string, partner1: BirthDetails, partner2: BirthDetails, locale?: string): Promise<MatchingResult> {
    this.logger.log('Performing Kundli matching');

    const creditCost = this.configService.get<number>('credits.kundliCost', 2);
    const deducted = await this.userService.deductCredits(userId, creditCost, 'Kundli matching');
    if (!deducted) {
      throw new BadRequestException('Insufficient credits. Please purchase more credits to continue.');
    }

    // PRIMARY: Deterministic Guna matching using Swiss Ephemeris for Moon positions
    const gunaDetails = this.calculateGunaScores(partner1, partner2);
    const totalScore = gunaDetails.reduce((s, g) => s + g.obtainedPoints, 0);
    const compatibility = totalScore >= 25 ? 'Excellent' : totalScore >= 21 ? 'Very Good' : totalScore >= 18 ? 'Good' : totalScore >= 14 ? 'Average' : 'Below Average';
    const recommendation = `The match score of ${totalScore}/36 indicates ${compatibility.toLowerCase()} compatibility. ${totalScore >= 18 ? 'The couple shares promising foundations for a harmonious relationship.' : 'Remedial measures may be recommended for a balanced relationship.'}`;

    // Detect Manglik status for each partner — use the cached chart pipeline so
    // re-running the same matching (or matching when a partner's chart was
    // already computed elsewhere) skips the expensive Swiss Ephemeris pass.
    const [chart1, chart2] = await Promise.all([
      this.generateAIKundli(partner1),
      this.generateAIKundli(partner2),
    ]);
    const doshas1 = this.detectDoshas(chart1.planetaryPositions);
    const doshas2 = this.detectDoshas(chart2.planetaryPositions);
    const manglikA = doshas1.some(d => d.name === 'Mangal Dosha (Manglik)' && d.present);
    const manglikB = doshas2.some(d => d.name === 'Mangal Dosha (Manglik)' && d.present);

    const result = await this.prisma.matchingResult.create({
      data: {
        userId,
        personAName: 'Partner A',
        personADob: new Date(partner1.dateOfBirth),
        personATime: partner1.timeOfBirth,
        personAPlace: { name: partner1.placeOfBirth, lat: partner1.latitude || 0, lng: partner1.longitude || 0 },
        personBName: 'Partner B',
        personBDob: new Date(partner2.dateOfBirth),
        personBTime: partner2.timeOfBirth,
        personBPlace: { name: partner2.placeOfBirth, lat: partner2.latitude || 0, lng: partner2.longitude || 0 },
        gunaScore: totalScore,
        manglikA,
        manglikB,
        resultData: JSON.parse(JSON.stringify({ gunaDetails, compatibility, recommendation, manglikA, manglikB })),
      },
    });

    return { id: result.id, partner1, partner2, totalScore, maxScore: 36, gunaDetails, compatibility, recommendation };
  }

  private calculateGunaScores(p1: BirthDetails, p2: BirthDetails): GunaDetail[] {
    // Use Swiss Ephemeris for precise Moon positions
    const m1 = this.getMoonDataFromSwissEph(p1);
    const m2 = this.getMoonDataFromSwissEph(p2);

    // Varna (1 pt): Based on sign's Varna classification
    // Brahmin(Cancer,Scorpio,Pisces), Kshatriya(Aries,Leo,Sag), Vaishya(Taurus,Virgo,Cap), Shudra(Gemini,Libra,Aquarius)
    const varnaMap = [1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0]; // Aries=Kshatriya(1), Taurus=Vaishya(2), etc.
    const v1 = varnaMap[m1.signIdx];
    const v2 = varnaMap[m2.signIdx];
    const varnaScore = v1 >= v2 ? 1 : 0;

    // Vashya (2 pts): Traditional 5-category system
    // 0=Chatushpada(quadruped), 1=Manava(human), 2=Jalachara(water), 3=Vanachara(wild), 4=Keeta(insect)
    // Aries=Chatush, Taurus=Chatush, Gemini=Manava, Cancer=Jalachara, Leo=Vanachara, Virgo=Manava,
    // Libra=Manava, Scorpio=Keeta, Sag=half-Chatush/half-Manava(1), Cap=half-Jalachara/half-Chatush(0), Aquarius=Manava, Pisces=Jalachara
    const vashyaGroups = [0, 0, 1, 2, 3, 1, 1, 4, 1, 0, 1, 2];
    // Compatibility: same=2, Manava controls all except Vanachara=1, others partial
    const vashyaCompat: Record<string, number> = {
      '0-0': 2, '1-1': 2, '2-2': 2, '3-3': 2, '4-4': 2,
      '1-0': 1, '0-1': 1, '1-2': 1, '2-1': 1, '1-4': 1, '4-1': 1,
      '0-2': 1, '2-0': 1, '0-3': 0, '3-0': 0, '0-4': 0, '4-0': 0,
      '1-3': 0, '3-1': 1, '2-3': 0, '3-2': 0, '2-4': 1, '4-2': 1,
      '3-4': 0, '4-3': 0,
    };
    const vashyaKey = `${vashyaGroups[m1.signIdx]}-${vashyaGroups[m2.signIdx]}`;
    const vashyaScore = vashyaCompat[vashyaKey] ?? 0;

    // Tara (3 pts): Count nakshatras from bride to groom, divide by 9, check remainder
    const taraDiff = ((m2.nakIdx - m1.nakIdx + 27) % 27);
    const taraRemainder = taraDiff % 9;
    const auspiciousTara = [1, 2, 4, 6, 8]; // 2nd, 3rd, 5th, 7th, 9th are favorable
    const taraScore = auspiciousTara.includes(taraRemainder) ? 3 : taraRemainder === 0 ? 1 : 0;

    // Yoni (4 pts): Traditional 14-animal system based on nakshatra
    // 0=Horse, 1=Elephant, 2=Sheep, 3=Serpent, 4=Dog, 5=Cat, 6=Rat, 7=Cow, 8=Buffalo, 9=Tiger, 10=Deer, 11=Monkey, 12=Mongoose, 13=Lion
    const yoniAnimals = [0, 1, 2, 5, 3, 6, 4, 2, 5, 7, 8, 9, 10, 11, 7, 8, 12, 13, 0, 1, 13, 10, 11, 3, 6, 12, 1];
    // Enemy pairs: Horse-Buffalo, Elephant-Lion, Sheep-Monkey, Serpent-Mongoose, Dog-Deer, Cat-Rat, Cow-Tiger
    const yoniEnemies: Record<number, number> = { 0: 8, 8: 0, 1: 13, 13: 1, 2: 11, 11: 2, 3: 12, 12: 3, 4: 10, 10: 4, 5: 6, 6: 5, 7: 9, 9: 7 };
    const y1 = yoniAnimals[m1.nakIdx];
    const y2 = yoniAnimals[m2.nakIdx];
    const yoniScore = y1 === y2 ? 4 : yoniEnemies[y1] === y2 ? 0 : 2;

    // Graha Maitri (5 pts): Based on Moon sign lords with traditional friendship table
    // Lords: 0=Sun, 1=Moon, 2=Mars, 3=Mercury, 4=Jupiter, 5=Venus, 6=Saturn
    const signLords = [2, 5, 3, 1, 0, 3, 5, 2, 4, 6, 6, 4]; // Aries=Mars, Taurus=Venus, etc.
    const lord1 = signLords[m1.signIdx];
    const lord2 = signLords[m2.signIdx];
    // Friendship matrix: 2=best friend, 1=friend, 0=neutral, -1=enemy, -2=bitter enemy
    const friendshipTable: Record<string, number> = {
      '0-1': 1, '0-2': 1, '0-4': 1, '0-3': -1, '0-5': -1, '0-6': -1,
      '1-0': 1, '1-3': 1, '1-2': 0, '1-4': 0, '1-5': 0, '1-6': 0,
      '2-0': 1, '2-1': 1, '2-4': 1, '2-3': -1, '2-5': 0, '2-6': 0,
      '3-0': -1, '3-5': 1, '3-1': 0, '3-2': 0, '3-4': 0, '3-6': 0,
      '4-0': 1, '4-1': 1, '4-2': 1, '4-3': -1, '4-5': -1, '4-6': 0,
      '5-3': 1, '5-6': 1, '5-0': -1, '5-1': 0, '5-2': 0, '5-4': 0,
      '6-3': 1, '6-5': 1, '6-0': -1, '6-1': -1, '6-2': -1, '6-4': 0,
    };
    const fKey = `${lord1}-${lord2}`;
    const f1 = lord1 === lord2 ? 2 : (friendshipTable[fKey] ?? 0);
    const f2 = lord1 === lord2 ? 2 : (friendshipTable[`${lord2}-${lord1}`] ?? 0);
    const combinedFriendship = f1 + f2; // Range: -4 to 4
    const graha = combinedFriendship >= 3 ? 5 : combinedFriendship >= 1 ? 4 : combinedFriendship === 0 ? 3 : combinedFriendship >= -2 ? 1 : 0;

    // Gana (6 pts): Deva, Manushya, Rakshasa based on nakshatra (standard mapping)
    // 0=Deva, 1=Manushya, 2=Rakshasa
    // Ashwini=D, Bharani=M, Krittika=R, Rohini=M, Mrig=D, Ardra=M, Punarvasu=D, Pushya=D, Ashlesha=R,
    // Magha=R, PPhalguni=M, UPhalguni=M, Hasta=D, Chitra=R, Swati=D, Vishakha=R, Anuradha=D, Jyeshtha=R,
    // Mula=R, PAshad=M, UAshad=M, Shravan=D, Dhanishta=R, Shatab=R, PBhadra=M, UBhadra=M, Revati=D
    const ganaMap = [0, 1, 2, 1, 0, 1, 0, 0, 2, 2, 1, 1, 0, 2, 0, 2, 0, 2, 2, 1, 1, 0, 2, 2, 1, 1, 0];
    const g1 = ganaMap[m1.nakIdx];
    const g2 = ganaMap[m2.nakIdx];
    const ganaScore = g1 === g2 ? 6 : (g1 === 0 && g2 === 1) || (g1 === 1 && g2 === 0) ? 3 : 0;

    // Bhakoot (7 pts): Based on relative sign positions (2-12, 6-8, 5-9 are inauspicious)
    const signDiff = ((m2.signIdx - m1.signIdx + 12) % 12) + 1;
    const badBhakoot = [2, 6, 8, 12].includes(signDiff) || [2, 6, 8, 12].includes(13 - signDiff);
    const bhakootScore = badBhakoot ? 0 : 7;

    // Nadi (8 pts): Based on nakshatra's Nadi (Aadi, Madhya, Antya)
    const nadiMap = [0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2];
    const n1 = nadiMap[m1.nakIdx];
    const n2 = nadiMap[m2.nakIdx];
    const nadiScore = n1 !== n2 ? 8 : 0; // Same Nadi = 0 (Nadi Dosha)

    return [
      { guna: 'Varna', maxPoints: 1, obtainedPoints: varnaScore, description: 'Spiritual compatibility and ego levels' },
      { guna: 'Vashya', maxPoints: 2, obtainedPoints: vashyaScore, description: 'Mutual attraction and dominance' },
      { guna: 'Tara', maxPoints: 3, obtainedPoints: taraScore, description: 'Birth star compatibility and destiny' },
      { guna: 'Yoni', maxPoints: 4, obtainedPoints: yoniScore, description: 'Sexual and physical compatibility' },
      { guna: 'Graha Maitri', maxPoints: 5, obtainedPoints: graha, description: 'Planetary friendship and mental compatibility' },
      { guna: 'Gana', maxPoints: 6, obtainedPoints: ganaScore, description: 'Temperament and behavior compatibility' },
      { guna: 'Bhakoot', maxPoints: 7, obtainedPoints: bhakootScore, description: 'Emotional compatibility and financial prosperity' },
      { guna: 'Nadi', maxPoints: 8, obtainedPoints: nadiScore, description: 'Health compatibility and genetic factors' },
    ];
  }

  async getHoroscope(sign: string, period?: 'daily' | 'weekly' | 'monthly' | 'yearly', locale?: string): Promise<HoroscopeResult> {
    const activePeriod = period || 'daily';
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `horoscope:${sign.toLowerCase()}:${activePeriod}:${today}`;
    const cached = await this.cacheService.get<HoroscopeResult>(cacheKey);
    if (cached) return cached;

    this.logger.log(`Fetching ${activePeriod} horoscope for: ${sign}`);
    const formattedSign = sign.charAt(0).toUpperCase() + sign.slice(1).toLowerCase();

    // Enrich with sign-specific KB context
    const signKB = await this.knowledgeService.search(formattedSign, 'signs', 3);
    const signKBContext = this.knowledgeService.assembleContext(signKB);
    const signKBSection = signKBContext ? `\n\nReference Knowledge about ${formattedSign}:\n${signKBContext}` : '';

    const periodDescriptions: Record<string, string> = {
      daily: `today's (${today})`,
      weekly: `this week's (starting ${today})`,
      monthly: `this month's (${new Date().toLocaleString('en', { month: 'long', year: 'numeric' })})`,
      yearly: `this year's (${new Date().getFullYear()})`,
    };

    const aiPrediction = await this.callOpenAI(
      `You are an expert Vedic astrologer with deep knowledge of planetary transits, Nakshatras, and Dasha periods. Generate a ${activePeriod} horoscope prediction for the given zodiac sign. Return a JSON object with:
- prediction: string (${activePeriod === 'daily' ? '3-4' : '5-7'} sentences, specific overview referencing current planetary positions and transits relevant to this sign)
- career: string (${activePeriod === 'daily' ? '2-3' : '3-5'} sentences about career and financial outlook, referencing specific planetary influences on the 2nd, 6th, 10th houses)
- health: string (${activePeriod === 'daily' ? '2-3' : '3-5'} sentences about health and wellness, referencing planetary effects on the 6th and 8th houses, suggest specific remedies or practices)
- love: string (${activePeriod === 'daily' ? '2-3' : '3-5'} sentences about love and relationships, referencing Venus, 7th house lord, and relationship dynamics)
- luckyNumber: number (1-9, based on ruling planet numerology)
- luckyColor: string (based on the sign's ruling planet)
- mood: string (one word reflecting dominant planetary energy)
- compatibility: string (most compatible sign based on current transits)

Make each section unique and specific to the sign. Avoid generic advice. Reference actual Vedic concepts like Nakshatras, Dashas, and planetary lordships.${signKBSection}`,
      `Generate ${periodDescriptions[activePeriod]} Vedic horoscope for ${formattedSign}. Consider the sign's ruling planet, current planetary transits, and Nakshatra influences. Provide specific, actionable guidance unique to this sign.`,
      true, 1500, 0.7, 'default', locale,
      { feature: `horoscope:${activePeriod}` },
    );

    if (aiPrediction) {
      const result: HoroscopeResult = {
        sign: formattedSign,
        date: today,
        period: activePeriod,
        prediction: aiPrediction.prediction,
        career: aiPrediction.career || `${formattedSign}'s professional sector is influenced by favorable planetary transits. Focus on strategic decisions and networking opportunities.`,
        health: aiPrediction.health || `${formattedSign} benefits from mindful practices aligned with your ruling planet's energy. Pay attention to your body's signals and maintain a balanced routine.`,
        love: aiPrediction.love || `Relationship dynamics are enhanced by Venus's current transit. ${formattedSign} can expect meaningful connections and deeper emotional bonds.`,
        luckyNumber: aiPrediction.luckyNumber,
        luckyColor: aiPrediction.luckyColor,
        mood: aiPrediction.mood,
        compatibility: aiPrediction.compatibility,
      };
      await this.cacheService.set(cacheKey, result, 24 * 60 * 60 * 1000); // 24h TTL
      return result;
    }

    // Fallback: generate based on current date and period for variety
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const signIdx = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'].indexOf(sign.toLowerCase());
    const periodOffset = { daily: 0, weekly: 1, monthly: 2, yearly: 3 }[activePeriod] || 0;
    const seed = (dayOfYear + signIdx + periodOffset * 3) % 7;

    const periodPredictions: Record<string, string[]> = {
      daily: [
        `Today brings positive energy for ${formattedSign}. The Moon's transit through your sector of creativity sparks new ideas. Financial matters look promising as Jupiter aspects your 2nd house. A social connection may lead to an unexpected opportunity.`,
        `${formattedSign}, the planetary alignment today favors introspection and planning. Mercury's influence sharpens your communication skills. This is an excellent day for important conversations and negotiations. Trust your instincts in matters of the heart.`,
        `A dynamic day awaits ${formattedSign} as Mars energizes your chart. Professional endeavors get a boost from the Sun's favorable position. Health and vitality are strong today. An old friend may reconnect with meaningful news.`,
        `${formattedSign}, Venus blesses your relationships today. Creative pursuits are highly favored under the current Nakshatra. Financial caution is advised in the afternoon hours. Evening brings joy through family connections.`,
        `The stars align favorably for ${formattedSign} today. Saturn's steady influence supports long-term goals and disciplined effort. A property or investment matter may reach a positive conclusion. Practice gratitude for the best results.`,
        `${formattedSign}, today's Rahu transit brings unexpected twists that work in your favor. Technology and innovation sectors are highlighted. Your analytical skills are sharp - use them for important decisions. Romance blooms in the evening hours.`,
        `A transformative day for ${formattedSign} as Ketu activates your spiritual sector. Deep insights come through meditation or quiet reflection. Career matters require patience but show promising long-term signs. Health benefits from outdoor activities.`,
      ],
      weekly: [
        `This week brings a surge of confidence for ${formattedSign}. The Sun-Jupiter conjunction early in the week opens doors for career advancement. Mid-week Mercury retrograde demands careful communication. The weekend favors romance and creative pursuits as Venus enters a harmonious aspect.`,
        `${formattedSign}, a week of transformation awaits. Mars energizes your ambition sector from Monday through Wednesday. Thursday brings a financial opportunity worth exploring. The week closes with Saturn rewarding your recent discipline and patience with tangible results.`,
        `A balanced week for ${formattedSign} with planetary support across multiple areas. Early week focuses on health and wellness as the Moon transits your 6th house. Mid-week highlights partnerships and collaboration. Weekend planetary shifts bring clarity to a long-standing personal matter.`,
        `${formattedSign}, expect an eventful week as multiple planetary transits activate your chart. Professional recognition comes early in the week. Wednesday's lunar phase supports family decisions. The latter half emphasizes spiritual growth and learning new skills.`,
        `This week's cosmic blueprint for ${formattedSign} emphasizes growth and expansion. Jupiter's benevolent gaze supports educational pursuits and travel plans. Rahu's mid-week influence brings exciting surprises in technology or innovation. Close the week by nurturing important relationships.`,
        `${formattedSign}, the weekly stars favor bold moves and decisive action. The first half highlights financial planning and investment. A creative breakthrough arrives around mid-week courtesy of Venus-Neptune alignment. The weekend is ideal for rest, reflection, and recharging.`,
        `A week of deep insights for ${formattedSign} as Ketu activates your wisdom sector. Early days favor completing pending projects. The mid-week lunar energy supports networking and social expansion. End the week with gratitude practices for amplified positive results.`,
      ],
      monthly: [
        `This month holds powerful potential for ${formattedSign}. The first ten days are marked by Jupiter's expansion in your career house, bringing professional opportunities and recognition. Mid-month, Venus enters your relationship sector, deepening bonds and attracting new connections. The final week brings a financial breakthrough as Saturn's disciplined energy rewards your persistence. Focus on long-term planning for maximum benefit.`,
        `${formattedSign}, a month of significant shifts awaits. Mars empowers your ambition during the opening weeks, making it ideal for launching projects. Around the 15th, Mercury's transit sharpens intellectual pursuits and communication. The month's latter half sees the Sun illuminating your health sector - prioritize wellness routines. A property or investment decision may finalize favorably before month's end.`,
        `An enriching month for ${formattedSign} with cosmic energies supporting multiple life areas. The first week's lunar phases favor family harmony and domestic improvements. Weeks two and three highlight career momentum with planetary support from Jupiter and Sun. The final stretch brings romantic energy and creative inspiration as Venus makes a powerful aspect to your natal chart.`,
        `${formattedSign}, this month's planetary dance creates a tapestry of opportunities. Early month Rahu energy brings unexpected but positive career developments. The mid-month full moon illuminates your financial sector, clarifying investment paths. The third week is ideal for travel and higher learning. Close the month by focusing on spiritual practices - Ketu's influence deepens your intuitive abilities.`,
        `This month is transformative for ${formattedSign}. Saturn's steady hand guides your professional development through the first two weeks. A mid-month Venus-Jupiter conjunction brings joy to relationships and social life. The latter half activates your creative sector - artistic and innovative projects thrive. Health improves steadily, especially if you maintain consistent wellness habits.`,
        `${formattedSign}, the month ahead balances action and reflection. Mercury's extended stay in your communication sector enhances negotiations and agreements in the first half. A mid-month Mars transit energizes your fitness and wellness goals. The final ten days are especially auspicious for financial decisions, as Jupiter aspects your wealth house with full force.`,
        `A month of steady growth for ${formattedSign}. The opening days bring clarity to personal relationships through Moon's nurturing transit. By mid-month, Sun and Mars combine to boost your leadership qualities at work. The last week's planetary configuration is ideal for new beginnings - consider starting projects or routines you've been contemplating. Spiritual insights peak around the full moon.`,
      ],
      yearly: [
        `${new Date().getFullYear()} is a landmark year for ${formattedSign}. Jupiter's extended transit through your chart brings expansive growth in career and finances during the first quarter. The mid-year Saturn shift deepens your commitment to long-term goals and relationships. A major professional milestone arrives around the third quarter. The year closes with Venus blessing your personal life, making the final months warm with love, creativity, and fulfillment. Prioritize health throughout and you'll close the year stronger than ever.`,
        `${formattedSign}, this year brings a powerful cycle of reinvention. The first few months focus on laying foundations - career planning, skill development, and financial restructuring yield enormous returns later. A mid-year Jupiter transit opens international opportunities and higher education paths. Relationships undergo beautiful transformation in the second half as Venus and Rahu align to bring depth and excitement. The year's final quarter rewards patience with tangible success and recognition.`,
        `A year of balance and abundance awaits ${formattedSign}. The first quarter's Mars energy drives professional ambition to new heights. Spring and early summer bring relationship deepening and possible travel opportunities. The mid-year planetary shift supports creative ventures and artistic expression. Autumn highlights financial growth and smart investments. The year concludes with Saturn's blessing on your spiritual evolution, bringing wisdom and inner peace alongside material success.`,
        `${formattedSign}, ${new Date().getFullYear()} unfolds as a year of meaningful transitions. Career shifts in the first quarter align you with your true calling. Mid-year eclipses activate growth in relationships and self-understanding. The second half brings financial improvements through disciplined Saturn energy. Health and wellness peak when you establish consistent routines by mid-year. The closing months bring recognition, celebration, and seeds planted for an even more prosperous year ahead.`,
        `This year's cosmic map for ${formattedSign} reveals extraordinary potential. Jupiter's transit in the first half expands your social circle and opens collaborative ventures. A mid-year Rahu shift brings exciting change in your daily routines and work environment. The third quarter is powerful for investments and financial growth. Love and family life flourish in the year's final stretch. Key advice: embrace change in the first half and consolidate gains in the second.`,
        `${formattedSign}, the planetary alignments of ${new Date().getFullYear()} strongly favor personal evolution. Early months bring introspective energy - use it for planning and goal-setting. Spring activates career momentum with Sun and Mars supporting bold moves. The summer months highlight relationships and partnerships. An autumn Jupiter aspect brings travel or educational opportunities. The year's final phase emphasizes health, spiritual growth, and preparing for an exciting new cycle.`,
        `A defining year for ${formattedSign} as major planetary shifts reshape multiple life areas. The first quarter builds professional momentum through Mercury and Sun transits. Mid-year brings a pivotal relationship development under Venus's guiding light. The third quarter's Saturn energy supports building lasting structures - in career, finances, and personal habits. The year ends with Ketu illuminating your spiritual path, offering profound insights that shape your direction for years to come.`,
      ],
    };

    const predictions = periodPredictions[activePeriod] || periodPredictions.daily;
    const colors = ['Crimson Red', 'Royal Blue', 'Emerald Green', 'Golden Yellow', 'Deep Purple', 'Coral Orange', 'Silver White', 'Turquoise', 'Maroon'];
    const moods = ['Optimistic', 'Energetic', 'Reflective', 'Confident', 'Creative', 'Peaceful', 'Adventurous'];
    const signs = ['Aries', 'Leo', 'Sagittarius', 'Gemini', 'Libra', 'Aquarius', 'Taurus', 'Cancer', 'Virgo', 'Scorpio', 'Capricorn', 'Pisces'];

    // Sign-specific ruling planets and elements for accurate predictions
    const signData: Record<string, { ruler: string; element: string; house: string }> = {
      aries: { ruler: 'Mars', element: 'Fire', house: '1st' },
      taurus: { ruler: 'Venus', element: 'Earth', house: '2nd' },
      gemini: { ruler: 'Mercury', element: 'Air', house: '3rd' },
      cancer: { ruler: 'Moon', element: 'Water', house: '4th' },
      leo: { ruler: 'Sun', element: 'Fire', house: '5th' },
      virgo: { ruler: 'Mercury', element: 'Earth', house: '6th' },
      libra: { ruler: 'Venus', element: 'Air', house: '7th' },
      scorpio: { ruler: 'Mars', element: 'Water', house: '8th' },
      sagittarius: { ruler: 'Jupiter', element: 'Fire', house: '9th' },
      capricorn: { ruler: 'Saturn', element: 'Earth', house: '10th' },
      aquarius: { ruler: 'Saturn', element: 'Air', house: '11th' },
      pisces: { ruler: 'Jupiter', element: 'Water', house: '12th' },
    };

    const sd = signData[sign.toLowerCase()] || signData.aries;
    const periodLabel = activePeriod === 'daily' ? 'today' : `this ${activePeriod.replace('ly', '')}`;

    const careerPredictions: string[] = [
      `${sd.ruler}'s influence on your 10th house strengthens professional authority ${periodLabel}. ${formattedSign} natives may find new avenues for financial growth as Jupiter aspects your 2nd house. Negotiations and business deals are favored — trust your instincts on major career decisions.`,
      `The ${sd.element} energy of ${formattedSign} combines with Mercury's transit to sharpen your analytical skills at work ${periodLabel}. Financial discipline pays off as Saturn steadies your 2nd house. A promotion or recognition may be on the horizon through consistent effort.`,
      `${formattedSign}, ${sd.ruler}'s conjunction with the Sun illuminates your career path ${periodLabel}. Investments made now, particularly in ${sd.element === 'Earth' ? 'real estate or gold' : sd.element === 'Fire' ? 'technology or startups' : sd.element === 'Water' ? 'healthcare or education' : 'communication or media'}, show promise. Avoid impulsive financial decisions during Rahu Kaal hours.`,
      `Professional networking yields unexpected rewards for ${formattedSign} ${periodLabel}. ${sd.ruler}'s trine to Jupiter expands your earning potential through collaborative ventures. The 6th house planetary transit supports overcoming workplace challenges with ease.`,
      `${formattedSign}'s ruling planet ${sd.ruler} empowers your career sector with renewed ambition ${periodLabel}. Financial planning and budgeting are strongly supported by Saturn's disciplined gaze on your wealth house. A mentor or senior colleague may offer valuable guidance.`,
      `Creative approaches to work challenges bring success for ${formattedSign} ${periodLabel}. Venus's aspect on your 10th house adds charm to professional interactions. Income from multiple sources is indicated — explore freelance or side opportunities.`,
      `${sd.ruler}'s transit through your career house marks a period of steady professional growth for ${formattedSign} ${periodLabel}. The Nakshatra energy supports strategic thinking and long-term financial planning. Avoid lending money during this transit.`,
    ];

    const healthPredictions: string[] = [
      `${formattedSign}'s vitality is governed by ${sd.ruler} ${periodLabel}, which strengthens your overall constitution. ${sd.element === 'Fire' ? 'Cooling pranayama like Sheetali and light cardio' : sd.element === 'Earth' ? 'Grounding yoga asanas like Tadasana and nature walks' : sd.element === 'Water' ? 'Swimming or gentle stretching with deep breathing' : 'Breathing exercises like Anulom Vilom and brisk walking'} are especially beneficial. Stay hydrated and avoid heavy meals during the afternoon hours.`,
      `The Moon's transit affects your 6th house of health ${periodLabel}, ${formattedSign}. ${sd.element === 'Fire' ? 'Guard against acidity and inflammation — include cooling foods like cucumber and coconut water' : sd.element === 'Earth' ? 'Digestive health needs attention — favor warm, cooked foods and ginger tea' : sd.element === 'Water' ? 'Emotional well-being is key — practice meditation and limit caffeine intake' : 'Respiratory health is highlighted — practice deep breathing and avoid cold beverages'}. An evening walk under the stars aligns your energy with beneficial planetary vibrations.`,
      `${sd.ruler}'s energy pattern suggests focusing on ${sd.element === 'Fire' ? 'managing body heat and stress through meditation' : sd.element === 'Earth' ? 'strengthening bones and joints through gentle exercise' : sd.element === 'Water' ? 'kidney and lymphatic health through adequate water intake' : 'nervous system balance through regular sleep patterns'} ${periodLabel}. ${formattedSign} natives benefit from chanting the ${sd.ruler === 'Mars' ? 'Mangal' : sd.ruler === 'Venus' ? 'Shukra' : sd.ruler === 'Mercury' ? 'Budha' : sd.ruler === 'Moon' ? 'Chandra' : sd.ruler === 'Sun' ? 'Surya' : sd.ruler === 'Jupiter' ? 'Guru' : 'Shani'} mantra for enhanced vitality.`,
      `Physical energy levels are strong for ${formattedSign} ${periodLabel} thanks to ${sd.ruler}'s favorable transit. ${sd.element === 'Fire' ? 'Channel this energy into vigorous exercise but avoid overexertion in the heat' : sd.element === 'Earth' ? 'Steady, consistent workouts yield the best results — try weight training or hiking' : sd.element === 'Water' ? 'Water-based activities and yoga are ideal for balancing your constitution' : 'Group activities and outdoor sports align well with your elemental energy'}. Include turmeric milk before bed for restorative sleep.`,
      `${formattedSign}, pay special attention to ${sd.element === 'Fire' ? 'head, eyes, and blood pressure' : sd.element === 'Earth' ? 'throat, skin, and digestive system' : sd.element === 'Water' ? 'chest, stomach, and emotional balance' : 'lungs, nervous system, and mental clarity'} ${periodLabel}. ${sd.ruler}'s aspect on your 8th house suggests building immunity through Ayurvedic herbs like Ashwagandha and Tulsi. Morning sun exposure for 15 minutes aligns your circadian rhythm.`,
      `Wellness and self-care are highlighted for ${formattedSign} ${periodLabel}. The current Nakshatra supports detox and cleansing routines. ${sd.element === 'Fire' ? 'Avoid spicy foods and practice Shitali pranayama for cooling' : sd.element === 'Earth' ? 'Include more fiber and green vegetables in your diet' : sd.element === 'Water' ? 'Reduce salt intake and practice Jal Neti for sinus health' : 'Practice alternate nostril breathing for mental clarity'}. Rest and recovery are as important as activity.`,
      `${sd.ruler} governs ${formattedSign}'s constitution ${periodLabel}, suggesting a focus on preventive health. Regular meal times and early sleep patterns amplify your natural vitality. ${sd.element === 'Fire' ? 'Aloe vera juice and pomegranate support your fiery metabolism' : sd.element === 'Earth' ? 'Root vegetables and whole grains nourish your earthly constitution' : sd.element === 'Water' ? 'Coconut water and fresh fruits support your fluid balance' : 'Light salads and herbal teas harmonize your airy nature'}. Avoid stress-inducing situations where possible.`,
    ];

    const lovePredictions: string[] = [
      `Venus's influence on ${formattedSign}'s 7th house enhances romantic energy ${periodLabel}. ${sd.ruler}'s harmonious aspect brings warmth to existing relationships and magnetism for new connections. Communication with your partner flows naturally — express your feelings openly.`,
      `${formattedSign}, the Moon's transit through your relationship sector deepens emotional bonds ${periodLabel}. ${sd.element === 'Fire' ? 'Your passionate nature attracts admirers — channel this energy into meaningful connections' : sd.element === 'Earth' ? 'Stability and loyalty define your romantic interactions — small gestures of love matter most' : sd.element === 'Water' ? 'Your intuitive understanding of your partner strengthens the bond — trust your emotional intelligence' : 'Intellectual conversations spark romance — share your ideas and listen actively'}. Singles may encounter someone through ${sd.element === 'Fire' ? 'social events or sports activities' : sd.element === 'Earth' ? 'work or community gatherings' : sd.element === 'Water' ? 'spiritual or artistic circles' : 'online platforms or intellectual forums'}.`,
      `${sd.ruler}'s conjunction with Venus creates a potent romantic period for ${formattedSign} ${periodLabel}. Existing couples benefit from planning quality time together. The Nakshatra influence supports heartfelt conversations and resolving any lingering misunderstandings. Family relationships also experience harmony.`,
      `Relationship dynamics are evolving positively for ${formattedSign} ${periodLabel}. Jupiter's benevolent gaze on your 7th house expands your capacity for love and understanding. ${sd.element === 'Fire' ? 'Surprise your partner with a spontaneous gesture' : sd.element === 'Earth' ? 'Create a comfortable, nurturing environment for your loved ones' : sd.element === 'Water' ? 'Share your dreams and innermost feelings with your partner' : 'Engage in stimulating activities together to strengthen your bond'}.`,
      `${formattedSign}, your natural ${sd.element === 'Fire' ? 'passion and enthusiasm' : sd.element === 'Earth' ? 'devotion and reliability' : sd.element === 'Water' ? 'empathy and emotional depth' : 'wit and adaptability'} is amplified ${periodLabel} by ${sd.ruler}'s favorable position. This is an excellent time for deepening commitments or taking relationships to the next level. Trust the cosmic timing for matters of the heart.`,
      `Love and harmony surround ${formattedSign} ${periodLabel} as Venus transits your Nakshatra. Past misunderstandings clear naturally — approach relationships with forgiveness and openness. ${sd.element === 'Fire' ? 'Your charisma is at its peak — use it to inspire your loved ones' : sd.element === 'Earth' ? 'Show love through acts of service and practical support' : sd.element === 'Water' ? 'Emotional vulnerability becomes your strength in relationships' : 'Your ability to see both sides helps resolve relationship tensions'}.`,
      `${formattedSign}'s love life receives a cosmic boost ${periodLabel} from the ${sd.ruler}-Venus alignment. Married couples find renewed appreciation for each other. Singles should pay attention to connections that feel karmic or destined — Rahu's North Node influence suggests fated encounters. Family bonds strengthen through shared meals and celebrations.`,
    ];

    const fallbackResult: HoroscopeResult = {
      sign: formattedSign,
      date: today,
      period: activePeriod,
      prediction: predictions[seed],
      career: careerPredictions[seed],
      health: healthPredictions[seed],
      love: lovePredictions[seed],
      luckyNumber: ((dayOfYear + signIdx + periodOffset) % 9) + 1,
      luckyColor: colors[(dayOfYear + signIdx + periodOffset) % colors.length],
      mood: moods[(seed + periodOffset) % moods.length],
      compatibility: signs[(signIdx + dayOfYear + periodOffset) % 12],
    };
    await this.cacheService.set(cacheKey, fallbackResult, 24 * 60 * 60 * 1000);
    return fallbackResult;
  }

  async getPanchang(lat?: number, lng?: number): Promise<PanchangResult> {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    // Default to Delhi if no location provided
    const pLat = lat ?? 28.6139;
    const pLng = lng ?? 77.2090;
    const locationLabel = (lat != null && lng != null) ? `${pLat.toFixed(4)}°N, ${pLng.toFixed(4)}°E` : 'New Delhi, India (28.6139°N, 77.2090°E)';
    const cacheKey = `panchang:${dateStr}:${pLat.toFixed(2)}:${pLng.toFixed(2)}`;
    const cached = await this.cacheService.get<PanchangResult>(cacheKey);
    if (cached) return cached;

    // Enrich with panchang KB context
    const panchangKB = await this.knowledgeService.getByCategory('panchang', 10);
    const panchangKBContext = this.knowledgeService.assembleContext(panchangKB);
    const panchangKBSection = panchangKBContext ? `\n\nReference Knowledge:\n${panchangKBContext}` : '';

    const aiResult = await this.callOpenAI(
      `You are a Vedic Panchang calculator. Calculate today's Panchang details accurately. Return a JSON object with:
- tithi: string (current Tithi name with Paksha, e.g. "Shukla Dashami")
- nakshatra: string (current Nakshatra)
- yoga: string (current Yoga)
- karana: string (current Karana)
- vara: string (day name in Sanskrit)
- sunrise: string (approximate time in HH:MM AM/PM format for India)
- sunset: string
- moonrise: string
- rahukaal: string (Rahu Kaal time range)
- gulikakaal: string (Gulika Kaal time range)
- yamakantaka: string (Yama Kantaka time range)${panchangKBSection}`,
      `Calculate the Panchang for today: ${dateStr} for location: ${locationLabel}. Use the Vedic Hindu calendar with Lahiri ayanamsa.`,
      true, 1500, 0.7, 'default', undefined,
      { feature: 'panchang' },
    );

    if (aiResult) {
      const result = { date: dateStr, ...aiResult };
      await this.cacheService.set(cacheKey, result, 24 * 60 * 60 * 1000);
      return result;
    }

    // Fallback: compute Panchang using Swiss Ephemeris for precision
    const dayNames = ['Ravivaar', 'Somvaar', 'Mangalvaar', 'Budhvaar', 'Guruvaar', 'Shukravaar', 'Shanivaar'];
    const tithiNames = ['Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi', 'Purnima'];
    const yogaNames = ['Vishkambha', 'Preeti', 'Ayushman', 'Saubhagya', 'Shobhana', 'Atiganda', 'Sukarma', 'Dhriti', 'Shoola', 'Ganda', 'Vriddhi', 'Dhruva', 'Vyaghata', 'Harshana', 'Vajra', 'Siddhi', 'Vyatipata', 'Variyan', 'Parigha', 'Shiva', 'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma', 'Indra', 'Vaidhriti'];
    const karanaNames = ['Bava', 'Balava', 'Kaulava', 'Taitila', 'Garaja', 'Vanija', 'Vishti', 'Shakuni', 'Chatushpada', 'Nagava', 'Kimstughna'];

    // Swiss Ephemeris: compute Sun & Moon tropical longitudes at ~6:00 IST (0:30 UT)
    const jd = swisseph.swe_julday(today.getFullYear(), today.getMonth() + 1, today.getDate(), 0.5, swisseph.SE_GREG_CAL);
    const flags = swisseph.SEFLG_SIDEREAL | swisseph.SEFLG_SPEED;
    const sunResult = swisseph.swe_calc_ut(jd, swisseph.SE_SUN, flags);
    const moonResult = swisseph.swe_calc_ut(jd, swisseph.SE_MOON, flags);
    const sunSid = ((sunResult.longitude % 360) + 360) % 360;
    const moonSid = ((moonResult.longitude % 360) + 360) % 360;

    // For tithi we need tropical elongation (Moon - Sun)
    const sunTropical = swisseph.swe_calc_ut(jd, swisseph.SE_SUN, swisseph.SEFLG_SPEED);
    const moonTropical = swisseph.swe_calc_ut(jd, swisseph.SE_MOON, swisseph.SEFLG_SPEED);
    const elongation = ((moonTropical.longitude - sunTropical.longitude) % 360 + 360) % 360;
    const tithiIdx = Math.floor(elongation / 12) % 30;
    const paksha = tithiIdx < 15 ? 'Shukla' : 'Krishna';
    const tithiName = tithiNames[tithiIdx % 15];

    // Nakshatra from Moon's sidereal longitude
    const nakIdx = Math.floor(moonSid / (360 / 27)) % 27;

    // Yoga: (Sun sidereal + Moon sidereal) / 13.333°
    const yogaAngle = ((moonSid + sunSid) % 360 + 360) % 360;
    const yogaIdx = Math.floor(yogaAngle / (360 / 27)) % 27;

    // Karana: half of tithi
    const karanaIdx = (tithiIdx * 2) % 11;

    // Sunrise/sunset using astronomical formula (Swiss Eph swe_rise_trans is unreliable in this binding)
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
    const declination = 23.45 * Math.sin(2 * Math.PI * (284 + dayOfYear) / 365);
    const latRad = pLat * Math.PI / 180;
    const decRad = declination * Math.PI / 180;
    const hourAngle = Math.acos(-Math.tan(latRad) * Math.tan(decRad)) * 180 / Math.PI;
    const solarNoon = 12 + (pLng - 82.5) / 15; // IST meridian = 82.5°E
    const sunriseHour = solarNoon - hourAngle / 15;
    const sunsetHour = solarNoon + hourAngle / 15;
    const formatHour = (h: number) => {
      const hr = Math.floor(((h % 24) + 24) % 24);
      const min = Math.round((h - Math.floor(h)) * 60);
      const period = hr >= 12 ? 'PM' : 'AM';
      const hr12 = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr;
      return `${hr12.toString().padStart(2, '0')}:${Math.abs(min).toString().padStart(2, '0')} ${period}`;
    };

    // Moonrise approximation
    const moonriseBase = 6.0 + (tithiIdx * 50) / 60;
    const moonriseHour = ((moonriseBase + (pLng - 82.5) / 15) % 24 + 24) % 24;

    // Rahu Kaal varies by day of week
    const rahuKaals = ['04:30 PM - 06:00 PM', '07:30 AM - 09:00 AM', '03:00 PM - 04:30 PM', '12:00 PM - 01:30 PM', '01:30 PM - 03:00 PM', '10:30 AM - 12:00 PM', '09:00 AM - 10:30 AM'];

    const result: PanchangResult = {
      date: dateStr,
      tithi: `${paksha} ${tithiName}`,
      nakshatra: NAKSHATRA_NAMES[nakIdx],
      yoga: yogaNames[yogaIdx],
      karana: karanaNames[karanaIdx],
      vara: dayNames[today.getDay()],
      sunrise: formatHour(sunriseHour),
      sunset: formatHour(sunsetHour),
      moonrise: formatHour(moonriseHour),
      rahukaal: rahuKaals[today.getDay()],
      gulikakaal: ['03:00 PM - 04:30 PM', '01:30 PM - 03:00 PM', '12:00 PM - 01:30 PM', '10:30 AM - 12:00 PM', '09:00 AM - 10:30 AM', '07:30 AM - 09:00 AM', '06:00 AM - 07:30 AM'][today.getDay()],
      yamakantaka: ['12:00 PM - 01:30 PM', '10:30 AM - 12:00 PM', '09:00 AM - 10:30 AM', '07:30 AM - 09:00 AM', '06:00 AM - 07:30 AM', '03:00 PM - 04:30 PM', '01:30 PM - 03:00 PM'][today.getDay()],
    };
    await this.cacheService.set(cacheKey, result, 24 * 60 * 60 * 1000);
    return result;
  }

  async getMuhurat(dto: MuhuratRequest): Promise<MuhuratResult> {
    // Enrich with muhurat KB context for the specific purpose
    const muhuratKB = await this.knowledgeService.search(dto.purpose, 'muhurat', 5);
    const muhuratKBContext = this.knowledgeService.assembleContext(muhuratKB);
    const muhuratKBSection = muhuratKBContext ? `\n\nReference Knowledge:\n${muhuratKBContext}` : '';

    const aiResult = await this.callOpenAI(
      `You are a Vedic Muhurat specialist. Calculate auspicious times for the given purpose. Return a JSON object with:
- auspiciousTimes: array of 3-5 objects { date: string (YYYY-MM-DD), startTime: string, endTime: string, quality: "excellent"|"good"|"average", reason: string (explain why this time is auspicious, reference Tithi, Nakshatra, planetary positions) }

Consider Rahu Kaal, Gulika Kaal, and other inauspicious periods. Factor in the specific purpose to recommend the most suitable Muhurat.${muhuratKBSection}`,
      `Find auspicious Muhurat for: ${dto.purpose}
Location: ${dto.location}
Date range: ${dto.fromDate} to ${dto.toDate}`,
      true, 1500, 0.7, 'default', undefined,
      { feature: 'muhurat' },
    );

    if (aiResult?.auspiciousTimes) {
      return { purpose: dto.purpose, auspiciousTimes: aiResult.auspiciousTimes };
    }

    // Fallback: generate varied muhurats based on dates
    const from = new Date(dto.fromDate);
    const to = new Date(dto.toDate);
    const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86400000));
    const count = Math.min(days, 4);

    const morningSlots = ['06:30 AM', '07:15 AM', '08:00 AM', '09:15 AM', '10:00 AM'];
    const eveningSlots = ['02:30 PM', '03:15 PM', '04:00 PM', '05:15 PM'];
    const reasons = [
      'Siddhi Yoga active with benefic planetary hour - highly favorable for new beginnings',
      'Amrit Kaal period with Moon in auspicious Nakshatra - excellent for commitments',
      'Abhijit Muhurat - the most auspicious mid-day period ruled by Vishnu',
      'Shubh Choghadiya with Jupiter hora - prosperity and success indicated',
      'Brahma Muhurat approaching, Pushya Nakshatra active - sacred and auspicious timing',
    ];

    const auspiciousTimes = Array.from({ length: count }, (_, i) => {
      const date = new Date(from.getTime() + i * 86400000);
      const seed = (date.getDate() + date.getMonth()) % 5;
      return {
        date: date.toISOString().split('T')[0],
        startTime: i % 2 === 0 ? morningSlots[seed] : eveningSlots[seed % eveningSlots.length],
        endTime: i % 2 === 0 ? morningSlots[(seed + 1) % morningSlots.length] : eveningSlots[(seed + 1) % eveningSlots.length],
        quality: (seed < 2 ? 'excellent' : seed < 4 ? 'good' : 'average') as 'excellent' | 'good' | 'average',
        reason: reasons[seed],
      };
    });

    return { purpose: dto.purpose, auspiciousTimes };
  }

  async getDosha(userId: string): Promise<DoshaResult> {
    // Fetch user's birth details for deterministic analysis
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { dateOfBirth: true, timeOfBirth: true, placeOfBirth: true },
    });

    if (user?.dateOfBirth) {
      // PRIMARY: Deterministic dosha detection using Swiss Ephemeris
      const birthDetails: BirthDetails = {
        dateOfBirth: user.dateOfBirth.toISOString().split('T')[0],
        timeOfBirth: user.timeOfBirth || '06:00',
        placeOfBirth: (user.placeOfBirth as any)?.name || 'Delhi',
        latitude: (user.placeOfBirth as any)?.lat,
        longitude: (user.placeOfBirth as any)?.lng,
      };
      const chart = this.generateSwissEphKundli(birthDetails);
      const doshas = this.detectDoshas(chart.planetaryPositions);
      return { userId, doshas };
    }

    // No birth details available — return empty analysis
    return {
      userId,
      doshas: [
        { name: 'Mangal Dosha (Manglik)', present: false, severity: 'none', description: 'Birth details required for accurate Mangal Dosha analysis. Please update your profile.', remedies: [] },
        { name: 'Kaal Sarp Dosha', present: false, severity: 'none', description: 'Birth details required for accurate Kaal Sarp Dosha analysis. Please update your profile.', remedies: [] },
        { name: 'Pitra Dosha', present: false, severity: 'none', description: 'Birth details required for accurate Pitra Dosha analysis. Please update your profile.', remedies: [] },
      ],
    };
  }

  // ─── Sade Sati Detection ─────────────────────────────────────────────────────
  detectSadeSati(natalMoonLongitude: number): { active: boolean; phase: string; description: string } {
    // Get current Saturn position
    const now = new Date();
    const jdNow = swisseph.swe_julday(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate(), now.getUTCHours() + now.getUTCMinutes() / 60, swisseph.SE_GREG_CAL);
    const flags = swisseph.SEFLG_SIDEREAL | swisseph.SEFLG_SPEED;
    const satResult = swisseph.swe_calc_ut(jdNow, swisseph.SE_SATURN, flags);
    const satLng = ((satResult.longitude % 360) + 360) % 360;

    const moonSign = Math.floor(natalMoonLongitude / 30);
    const satSign = Math.floor(satLng / 30);

    const diff = ((satSign - moonSign + 12) % 12);

    if (diff === 11) {
      return { active: true, phase: 'Rising (Ascending)', description: `Saturn is transiting the 12th house from your Moon sign, beginning the Sade Sati period. You may experience increased responsibilities, introspection, and gradual changes. This phase lasts approximately 2.5 years.` };
    } else if (diff === 0) {
      return { active: true, phase: 'Peak', description: `Saturn is transiting over your natal Moon sign — the peak phase of Sade Sati. This is the most intense period, bringing transformation, emotional challenges, and karmic lessons. Patience and discipline are key.` };
    } else if (diff === 1) {
      return { active: true, phase: 'Setting (Descending)', description: `Saturn is transiting the 2nd house from your Moon sign, the final phase of Sade Sati. Financial pressures may ease, and lessons learned during this period begin to integrate. Relief is approaching.` };
    }

    return { active: false, phase: 'Not Active', description: 'Sade Sati is not currently active for your chart. Saturn is well-placed relative to your Moon sign.' };
  }

  async getSadeSati(userId: string): Promise<{ userId: string; sadeSati: { active: boolean; phase: string; description: string } }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { dateOfBirth: true, timeOfBirth: true, placeOfBirth: true },
    });

    if (!user?.dateOfBirth) {
      return { userId, sadeSati: { active: false, phase: 'Unknown', description: 'Birth details required for Sade Sati analysis.' } };
    }

    const bd: BirthDetails = {
      dateOfBirth: user.dateOfBirth.toISOString().split('T')[0],
      timeOfBirth: user.timeOfBirth || '06:00',
      placeOfBirth: (user.placeOfBirth as any)?.name || 'Delhi',
      latitude: (user.placeOfBirth as any)?.lat,
      longitude: (user.placeOfBirth as any)?.lng,
    };

    const jd = this.computeJulianDay(bd);
    const flags = swisseph.SEFLG_SIDEREAL | swisseph.SEFLG_SPEED;
    const moonResult = swisseph.swe_calc_ut(jd, swisseph.SE_MOON, flags);
    const moonLng = ((moonResult.longitude % 360) + 360) % 360;

    return { userId, sadeSati: this.detectSadeSati(moonLng) };
  }

  // ─── Divisional Charts ───────────────────────────────────────────────────────
  computeDivisionalChart(planetLongitudes: { planet: string; longitude: number }[], divisor: number): { planet: string; sign: string; degree: number }[] {
    return planetLongitudes.map(({ planet, longitude }) => {
      const lng = ((longitude % 360) + 360) % 360;
      const signIdx = Math.floor(lng / 30);

      if (divisor === 9) {
        // D9 Navamsa: Each navamsa = 3°20' = 3.333°
        const posInSign = lng % 30;
        const navamsaIdx = Math.floor(posInSign / (30 / 9));
        // Navamsa starts from the element's first sign:
        // Fire signs (0,4,8) start from Aries(0), Earth(1,5,9) from Cap(9), Air(2,6,10) from Libra(6), Water(3,7,11) from Cancer(3)
        const elementStarts = [0, 9, 6, 3]; // Fire, Earth, Air, Water
        const element = signIdx % 4;
        const navamsaSign = (elementStarts[element] + navamsaIdx) % 12;
        return { planet, sign: ALL_SIGNS[navamsaSign], degree: parseFloat((posInSign % (30 / 9) * 9).toFixed(2)) };
      } else if (divisor === 10) {
        // D10 Dashamsha: Each dashamsha = 3°
        const posInSign = lng % 30;
        const dashamshaIdx = Math.floor(posInSign / 3);
        // Odd signs start from same sign, Even signs start from 9th sign
        const startSign = signIdx % 2 === 0 ? signIdx : (signIdx + 8) % 12;
        const dashamshaSign = (startSign + dashamshaIdx) % 12;
        return { planet, sign: ALL_SIGNS[dashamshaSign], degree: parseFloat((posInSign % 3 * 10).toFixed(2)) };
      } else {
        // Generic divisional chart
        const posInSign = lng % 30;
        const divIdx = Math.floor(posInSign / (30 / divisor));
        const divSign = (signIdx * divisor + divIdx) % 12;
        return { planet, sign: ALL_SIGNS[divSign], degree: parseFloat((posInSign % (30 / divisor) * divisor).toFixed(2)) };
      }
    });
  }

  async getDivisionalChart(userId: string, birthDetails: BirthDetails, type: string): Promise<any> {
    const creditCost = this.configService.get<number>('credits.kundliCost', 2);
    const deducted = await this.userService.deductCredits(userId, creditCost, `Divisional chart D${type}`);
    if (!deducted) {
      throw new BadRequestException('Insufficient credits.');
    }

    const divisorMap: Record<string, number> = { '9': 9, '10': 10, 'navamsa': 9, 'dashamsha': 10 };
    const divisor = divisorMap[type.toLowerCase()] || parseInt(type, 10);
    if (!divisor || divisor < 2 || divisor > 60) {
      throw new BadRequestException('Invalid divisional chart type. Use 9 (Navamsa), 10 (Dashamsha), or a number 2-60.');
    }

    // Reuse the cached deterministic chart computation.
    const chart = await this.generateAIKundli(birthDetails);
    const planetLongitudes = chart.planetaryPositions.map((p: PlanetPosition) => ({
      planet: p.planet,
      longitude: ALL_SIGNS.indexOf(p.sign as any) * 30 + p.degree,
    }));

    const divisionalPositions = this.computeDivisionalChart(planetLongitudes, divisor);

    return {
      type: `D${divisor}`,
      divisor,
      birthDetails,
      positions: divisionalPositions,
      rasiBhava: chart.planetaryPositions,
    };
  }

  // ─── KP Astrology ────────────────────────────────────────────────────────────
  async generateKPChart(userId: string, birthDetails: BirthDetails): Promise<any> {
    const creditCost = this.configService.get<number>('credits.kundliCost', 2);
    const deducted = await this.userService.deductCredits(userId, creditCost, 'KP chart generation');
    if (!deducted) {
      throw new BadRequestException('Insufficient credits.');
    }

    // KP charts are a pure function of birth details — cache the expensive
    // Placidus house + sub-lord computation across requests.
    const cacheKey = `kp:${birthDetails.dateOfBirth}:${birthDetails.timeOfBirth}:${birthDetails.placeOfBirth}:${birthDetails.latitude ?? ''}:${birthDetails.longitude ?? ''}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return { ...cached, birthDetails };

    const jd = this.computeJulianDay(birthDetails);
    const lat = birthDetails.latitude || 28.6139;
    const lng = birthDetails.longitude || 77.2090;

    // Placidus house cusps for KP system
    const houseResult = swisseph.swe_houses(jd, lat, lng, 'P');
    const cusps = houseResult.house || houseResult.cusps || [];
    const ascmc = houseResult.ascmc || [];

    // KP Sub-lord determination: 249 sub-divisions of the zodiac
    // Each nakshatra lord is a star-lord; sub-lord is derived from Vimshottari proportion within each nakshatra
    const nakshatraSpan = 360 / 27; // 13.333°
    const subLordTable = this.buildKPSubLordTable();

    const flags = swisseph.SEFLG_SIDEREAL | swisseph.SEFLG_SPEED;
    const planets = [
      { id: swisseph.SE_SUN, name: 'Sun' },
      { id: swisseph.SE_MOON, name: 'Moon' },
      { id: swisseph.SE_MARS, name: 'Mars' },
      { id: swisseph.SE_MERCURY, name: 'Mercury' },
      { id: swisseph.SE_JUPITER, name: 'Jupiter' },
      { id: swisseph.SE_VENUS, name: 'Venus' },
      { id: swisseph.SE_SATURN, name: 'Saturn' },
      { id: swisseph.SE_MEAN_NODE, name: 'Rahu' },
    ];

    const planetPositions = planets.map(p => {
      const result = swisseph.swe_calc_ut(jd, p.id, flags);
      let pLng = ((result.longitude % 360) + 360) % 360;
      const nakIdx = Math.floor(pLng / nakshatraSpan) % 27;
      const starLord = DASHA_LORDS[nakIdx % 9];
      const subLord = this.getKPSubLord(pLng, subLordTable);
      const signIdx = Math.floor(pLng / 30) % 12;

      return {
        planet: p.name,
        longitude: parseFloat(pLng.toFixed(4)),
        sign: ALL_SIGNS[signIdx],
        nakshatra: NAKSHATRA_NAMES[nakIdx],
        starLord,
        subLord,
        degree: parseFloat((pLng % 30).toFixed(4)),
      };
    });

    // Add Ketu as 180° from Rahu
    const rahu = planetPositions.find(p => p.planet === 'Rahu')!;
    const ketuLng = (rahu.longitude + 180) % 360;
    const ketuNakIdx = Math.floor(ketuLng / nakshatraSpan) % 27;
    planetPositions.push({
      planet: 'Ketu',
      longitude: parseFloat(ketuLng.toFixed(4)),
      sign: ALL_SIGNS[Math.floor(ketuLng / 30) % 12],
      nakshatra: NAKSHATRA_NAMES[ketuNakIdx],
      starLord: DASHA_LORDS[ketuNakIdx % 9],
      subLord: this.getKPSubLord(ketuLng, subLordTable),
      degree: parseFloat((ketuLng % 30).toFixed(4)),
    });

    // Cusp analysis with sub-lords
    const cuspAnalysis = [];
    for (let i = 1; i <= 12; i++) {
      const cuspLng = cusps[i] ? ((cusps[i] % 360 + 360) % 360) : ((i - 1) * 30);
      // Apply ayanamsa for sidereal
      const ayanamsa = swisseph.swe_get_ayanamsa_ut(jd);
      const sidCusp = ((cuspLng - ayanamsa + 360) % 360);
      const cuspNakIdx = Math.floor(sidCusp / nakshatraSpan) % 27;
      cuspAnalysis.push({
        cusp: i,
        longitude: parseFloat(sidCusp.toFixed(4)),
        sign: ALL_SIGNS[Math.floor(sidCusp / 30) % 12],
        nakshatra: NAKSHATRA_NAMES[cuspNakIdx],
        starLord: DASHA_LORDS[cuspNakIdx % 9],
        subLord: this.getKPSubLord(sidCusp, subLordTable),
      });
    }

    // Significators: planets signify houses through star-lord and sub-lord connections
    const significators: Record<number, string[]> = {};
    for (let h = 1; h <= 12; h++) significators[h] = [];
    for (const pp of planetPositions) {
      // A planet signifies a house if its star-lord owns that house
      for (let h = 0; h < 12; h++) {
        if (SIGN_LORDS[h] === pp.starLord) {
          const houseNum = h + 1;
          if (!significators[houseNum].includes(pp.planet)) {
            significators[houseNum].push(pp.planet);
          }
        }
      }
    }

    const kpResult = {
      system: 'KP (Krishnamurti Paddhati)',
      birthDetails,
      cusps: cuspAnalysis,
      planets: planetPositions,
      significators,
    };
    await this.cacheService.set(cacheKey, kpResult, 24 * 60 * 60 * 1000);
    return kpResult;
  }

  private buildKPSubLordTable(): { start: number; end: number; lord: string }[] {
    // Build 249 sub-divisions based on Vimshottari dasha proportions within each nakshatra
    const table: { start: number; end: number; lord: string }[] = [];
    const nakshatraSpan = 360 / 27;
    const totalDashaYears = 120;

    for (let nak = 0; nak < 27; nak++) {
      const nakStart = nak * nakshatraSpan;
      const nakLordIdx = nak % 9;
      let offset = nakStart;

      for (let i = 0; i < 9; i++) {
        const subIdx = (nakLordIdx + i) % 9;
        const subSpan = nakshatraSpan * (DASHA_YEARS[subIdx] / totalDashaYears);
        table.push({
          start: parseFloat(offset.toFixed(6)),
          end: parseFloat((offset + subSpan).toFixed(6)),
          lord: DASHA_LORDS[subIdx] as string,
        });
        offset += subSpan;
      }
    }

    return table;
  }

  private getKPSubLord(longitude: number, table: { start: number; end: number; lord: string }[]): string {
    const lng = ((longitude % 360) + 360) % 360;
    for (const entry of table) {
      if (lng >= entry.start && lng < entry.end) {
        return entry.lord;
      }
    }
    return 'Ketu'; // fallback
  }
}
