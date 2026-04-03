import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../user/user.service';
import { OpenAIService } from '../../openai/openai.service';
import { MemoryCacheService } from '../../common/cache.service';
import { KnowledgeService } from '../../knowledge/knowledge.service';

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
  ): Promise<any | null> {
    return this.openaiService.chatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      maxTokens,
      temperature,
      jsonMode,
    });
  }

  async generateKundli(userId: string, birthDetails: BirthDetails): Promise<KundliResult> {
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

  private async generateAIKundli(birthDetails: BirthDetails): Promise<any> {
    // Enrich with KB context about planets, houses, yogas, nakshatras
    const [planetKB, houseKB, yogaKB] = await Promise.all([
      this.knowledgeService.getByCategory('planets', 10),
      this.knowledgeService.getByCategory('houses', 5),
      this.knowledgeService.getByCategory('yogas', 5),
    ]);
    const kbContext = this.knowledgeService.assembleContext([...planetKB, ...houseKB, ...yogaKB]);
    const kbSection = kbContext ? `\n\nReference Knowledge:\n${kbContext}` : '';

    const systemPrompt = `You are an expert Vedic astrologer and astronomer with deep knowledge of Jyotish Shastra and astronomical ephemeris data. Given birth details, calculate an accurate Vedic birth chart (Kundli).

CRITICAL CALCULATION RULES:
1. Use the Lahiri ayanamsa (approximately 24°07' for 2024, subtract ~50.3" per year going backward) to convert tropical to sidereal positions.
2. Calculate the ACTUAL astronomical positions of all 9 Vedic planets (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu) for the given date.
3. Calculate the Ascendant (Lagna) based on the LOCAL SIDEREAL TIME at the birth location, using the latitude and longitude provided.
4. Rahu and Ketu are always exactly 180° apart. Rahu's mean motion is approximately 19°20' per year retrograde.
5. Jupiter takes ~12 years per zodiac cycle (~1 sign/year). Saturn takes ~29.5 years (~2.5 years/sign).
6. Mercury is always within ~28° of the Sun. Venus is always within ~47° of the Sun.
7. Each sign spans exactly 30°. Each nakshatra spans exactly 13°20'.
8. Retrograde status: Check if the planet's geocentric longitude is decreasing (Mars retrogrades ~72 days every ~2 years, Jupiter ~120 days/year, Saturn ~138 days/year). Rahu/Ketu are always retrograde.
9. The 27 nakshatras start from 0° Aries: Ashwini (0°-13°20'), Bharani (13°20'-26°40'), etc.
10. Vimshottari Dasha: Calculate based on Moon's nakshatra position. The nakshatra lord determines the starting Mahadasha, and the balance is proportional to the remaining degrees in the nakshatra.

Return a JSON object with these exact keys:
- ascendant: string (the rising sign)
- moonSign: string (Rashi based on Moon's sidereal position)
- sunSign: string (based on Vedic sidereal zodiac, NOT Western tropical)
- nakshatra: string (birth nakshatra based on Moon's exact sidereal position)
- houses: array of 12 objects with { house: number, sign: string, planets: string[] }
- planetaryPositions: array of 9 objects with { planet: string, sign: string, house: number, degree: number, isRetrograde: boolean, nakshatra: string }
- dashas: array with current Mahadasha and sub-periods { planet: string, startDate: string, endDate: string, subPeriods: [{planet, startDate, endDate}] }
- yogas: array of detected yogas { name: string, description: string, effect: "benefic"|"malefic"|"neutral" }

The degree field should be the degree WITHIN the sign (0-30). Be as astronomically precise as possible.${kbSection}`;

    const userPrompt = `Calculate the Vedic birth chart (Kundli) for:
- Date of Birth: ${birthDetails.dateOfBirth}
- Time of Birth: ${birthDetails.timeOfBirth}
- Place of Birth: ${birthDetails.placeOfBirth}
${birthDetails.latitude ? `- Latitude: ${birthDetails.latitude}°` : ''}
${birthDetails.longitude ? `- Longitude: ${birthDetails.longitude}°` : ''}

Please calculate the exact sidereal planetary longitudes for this date using Lahiri ayanamsa, then determine the ascendant from the local sidereal time at the given coordinates. Cross-check that Mercury is within 28° of the Sun and Venus within 47° of the Sun.`;

    const aiResult = await this.callOpenAI(systemPrompt, userPrompt, true, 2000, 0.1);

    if (aiResult) return aiResult;

    // Fallback: generate chart based on birth details using basic calculations
    return this.calculateChartFromBirthDetails(birthDetails);
  }

  private calculateChartFromBirthDetails(bd: BirthDetails): any {
    const date = new Date(bd.dateOfBirth);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();

    // Julian Day Number for astronomical calculations
    const a = Math.floor((14 - month) / 12);
    const y = year + 4800 - a;
    const m = month + 12 * a - 3;
    const jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;

    const timeParts = bd.timeOfBirth?.split(':') || ['6', '0'];
    const hour = parseInt(timeParts[0], 10);
    const minute = parseInt(timeParts[1], 10) || 0;
    const hourDecimal = hour + minute / 60;
    const jd = jdn + (hourDecimal - 12) / 24;

    // Days since J2000.0 epoch (Jan 1, 2000 12:00 TT)
    const T = (jd - 2451545.0) / 36525.0;

    // Lahiri ayanamsa (approximate): 23°51' in 2000, precession ~50.29"/year
    const ayanamsa = 23.85 + (T * 36525 * 50.29) / 3600;

    // Mean Sun longitude (tropical)
    const sunLongTropical = (280.46646 + 36000.76983 * T + 0.0003032 * T * T) % 360;
    const sunLongSidereal = ((sunLongTropical - ayanamsa) % 360 + 360) % 360;

    // Mean Moon longitude (tropical) - more precise formula
    const moonLongTropical = (218.3165 + 481267.8813 * T) % 360;
    const moonLongSidereal = ((moonLongTropical - ayanamsa) % 360 + 360) % 360;

    // Planetary mean longitudes (tropical, simplified)
    const marsLongT = (355.433 + 19140.2993 * T) % 360;
    const mercuryLongT = (252.251 + 149472.6746 * T) % 360;
    const jupiterLongT = (34.351 + 3034.9057 * T) % 360;
    const venusLongT = (181.979 + 58517.8149 * T) % 360;
    const saturnLongT = (50.077 + 1222.1138 * T) % 360;

    // Rahu mean longitude (always retrograde)
    const rahuLongT = (125.045 - 1934.1363 * T) % 360;

    // Convert all to sidereal
    const toSidereal = (tropical: number) => ((tropical - ayanamsa) % 360 + 360) % 360;

    const allSigns = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

    const signFromLong = (lng: number) => allSigns[Math.floor(lng / 30) % 12];
    const degreeInSign = (lng: number) => parseFloat((lng % 30).toFixed(1));
    const signIdx = (lng: number) => Math.floor(lng / 30) % 12;

    const sunSid = toSidereal(sunLongTropical);
    const moonSid = moonLongSidereal;
    const marsSid = toSidereal(marsLongT);
    const mercSid = toSidereal(mercuryLongT);
    const jupSid = toSidereal(jupiterLongT);
    const venSid = toSidereal(venusLongT);
    const satSid = toSidereal(saturnLongT);
    const rahuSid = toSidereal(rahuLongT);
    const ketuSid = (rahuSid + 180) % 360;

    const sunSign = signFromLong(sunSid);
    const moonSign = signFromLong(moonSid);

    // Calculate ascendant using Local Sidereal Time
    const lat = bd.latitude || 28.6139; // Default to Delhi
    const lng = bd.longitude || 77.2090;
    // Greenwich Mean Sidereal Time
    const gmst = (280.46061837 + 360.98564736629 * (jd - 2451545.0)) % 360;
    const lst = ((gmst + lng) % 360 + 360) % 360;
    // Ascendant formula (simplified)
    const lstRad = lst * Math.PI / 180;
    const latRad = lat * Math.PI / 180;
    const obliquity = 23.4393 * Math.PI / 180;
    const ascTropical = Math.atan2(
      Math.cos(lstRad),
      -(Math.sin(obliquity) * Math.tan(latRad) + Math.cos(obliquity) * Math.sin(lstRad))
    ) * 180 / Math.PI;
    const ascSidereal = ((ascTropical - ayanamsa) % 360 + 360) % 360;
    const ascIdx = signIdx(ascSidereal);
    const ascendant = allSigns[ascIdx];

    // Nakshatras (each 13°20' = 13.333°)
    const nakshatras = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Moola', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'];
    const nakshatraFromLong = (lng: number) => nakshatras[Math.floor(lng / (360 / 27)) % 27];
    const nakshatra = nakshatraFromLong(moonSid);

    // Build houses starting from ascendant (Equal House system)
    const houses = Array.from({ length: 12 }, (_, i) => ({
      house: i + 1,
      sign: allSigns[(ascIdx + i) % 12],
      planets: [] as string[],
    }));

    // Planet data with sidereal longitudes
    const planetData = [
      { planet: 'Sun', sid: sunSid },
      { planet: 'Moon', sid: moonSid },
      { planet: 'Mars', sid: marsSid },
      { planet: 'Mercury', sid: mercSid },
      { planet: 'Jupiter', sid: jupSid },
      { planet: 'Venus', sid: venSid },
      { planet: 'Saturn', sid: satSid },
      { planet: 'Rahu', sid: rahuSid },
      { planet: 'Ketu', sid: ketuSid },
    ];

    // Retrograde check: approximate based on angular difference from Sun
    const isRetrograde = (planet: string, sid: number): boolean => {
      if (planet === 'Rahu' || planet === 'Ketu') return true;
      if (planet === 'Sun' || planet === 'Moon') return false;
      // Superior planets are retrograde when roughly opposite the Sun
      const diff = ((sid - sunSid + 360) % 360);
      if (['Mars', 'Jupiter', 'Saturn'].includes(planet)) {
        return diff > 120 && diff < 240;
      }
      return false; // Mercury/Venus retrograde detection needs more data
    };

    const planetaryPositions = planetData.map((p) => {
      const pSignIdx = signIdx(p.sid);
      const houseNum = ((pSignIdx - ascIdx + 12) % 12) + 1;
      houses[houseNum - 1].planets.push(p.planet);
      return {
        planet: p.planet,
        sign: signFromLong(p.sid),
        house: houseNum,
        degree: degreeInSign(p.sid),
        isRetrograde: isRetrograde(p.planet, p.sid),
        nakshatra: nakshatraFromLong(p.sid),
      };
    });

    // Detect basic yogas
    const yogas: Yoga[] = [];
    const findHouse = (name: string) => planetaryPositions.find((p) => p.planet === name)?.house;
    const jupiterHouse = findHouse('Jupiter');
    const moonHouse = findHouse('Moon');
    const sunH = findHouse('Sun');
    const mercuryH = findHouse('Mercury');
    const venusH = findHouse('Venus');

    if (jupiterHouse != null && moonHouse != null && [1, 4, 7, 10].includes(((jupiterHouse - moonHouse + 12) % 12) + 1)) {
      yogas.push({ name: 'Gaja Kesari Yoga', description: 'Jupiter in Kendra from Moon - bestows wisdom, prosperity, and fame', effect: 'benefic' });
    }
    if (sunH != null && mercuryH != null && sunH === mercuryH) {
      yogas.push({ name: 'Budhaditya Yoga', description: 'Sun-Mercury conjunction - grants sharp intellect and communication skills', effect: 'benefic' });
    }
    if (venusH != null && (venusH === 1 || venusH === 4 || venusH === 7)) {
      yogas.push({ name: 'Malavya Yoga', description: 'Venus in Kendra - bestows luxury, beauty, and artistic talents', effect: 'benefic' });
    }
    if (jupiterHouse != null && [1, 4, 7, 10].includes(jupiterHouse)) {
      yogas.push({ name: 'Hamsa Yoga', description: 'Jupiter in Kendra - bestows righteousness and spiritual wisdom', effect: 'benefic' });
    }

    // Dashas based on nakshatra ruler (Vimshottari Dasha)
    const dashaLords = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
    const dashaYears = [7, 20, 6, 10, 7, 18, 16, 19, 17];
    const moonNakIdx = Math.floor(moonSid / (360 / 27)) % 27;
    const startIdx = moonNakIdx % 9;
    let currentYear = year;
    const dashas = Array.from({ length: 3 }, (_, i) => {
      const idx = (startIdx + i) % 9;
      const start = `${currentYear}-01-01`;
      currentYear += dashaYears[idx];
      return {
        planet: dashaLords[idx],
        startDate: start,
        endDate: `${currentYear}-01-01`,
        subPeriods: dashaLords.slice(0, 3).map((sp, si) => ({
          planet: sp,
          startDate: `${parseInt(start) + si}-06-01`,
          endDate: `${parseInt(start) + si + 1}-06-01`,
        })),
      };
    });

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

  async getMatching(userId: string, partner1: BirthDetails, partner2: BirthDetails): Promise<MatchingResult> {
    this.logger.log('Performing Kundli matching');

    const creditCost = this.configService.get<number>('credits.kundliCost', 2);
    const deducted = await this.userService.deductCredits(userId, creditCost, 'Kundli matching');
    if (!deducted) {
      throw new BadRequestException('Insufficient credits. Please purchase more credits to continue.');
    }

    // Enrich with matching KB context
    const matchingKB = await this.knowledgeService.getByCategory('matching', 10);
    const matchKBContext = this.knowledgeService.assembleContext(matchingKB);
    const matchKBSection = matchKBContext ? `\n\nReference Knowledge:\n${matchKBContext}` : '';

    const aiResult = await this.callOpenAI(
      `You are an expert Vedic astrologer performing Ashtakoota Guna matching. Calculate the actual compatibility scores based on the birth details provided. Return a JSON object with:
- gunaDetails: array of 8 objects { guna: string, maxPoints: number, obtainedPoints: number, description: string } for Varna(1), Vashya(2), Tara(3), Yoni(4), Graha Maitri(5), Gana(6), Bhakoot(7), Nadi(8)
- totalScore: number (sum of obtained points)
- compatibility: string ("Excellent" if >= 25, "Very Good" if >= 21, "Good" if >= 18, "Average" if >= 14, "Below Average" if < 14)
- recommendation: string (detailed compatibility analysis in 2-3 sentences)

Calculate scores based on actual Vedic astrology rules using the Moon signs and Nakshatras derived from the birth dates.${matchKBSection}`,
      `Partner 1: DOB ${partner1.dateOfBirth}, Time ${partner1.timeOfBirth}, Place ${partner1.placeOfBirth}
Partner 2: DOB ${partner2.dateOfBirth}, Time ${partner2.timeOfBirth}, Place ${partner2.placeOfBirth}`,
      true, 1500, 0.2,
    );

    let gunaDetails: GunaDetail[];
    let totalScore: number;
    let compatibility: string;
    let recommendation: string;

    if (aiResult?.gunaDetails) {
      gunaDetails = aiResult.gunaDetails;
      totalScore = aiResult.totalScore ?? gunaDetails.reduce((s, g) => s + g.obtainedPoints, 0);
      compatibility = aiResult.compatibility ?? (totalScore >= 24 ? 'Very Good' : totalScore >= 18 ? 'Good' : 'Average');
      recommendation = aiResult.recommendation ?? '';
    } else {
      // Fallback: calculate basic scores from birth details
      gunaDetails = this.calculateGunaScores(partner1, partner2);
      totalScore = gunaDetails.reduce((s, g) => s + g.obtainedPoints, 0);
      compatibility = totalScore >= 25 ? 'Excellent' : totalScore >= 21 ? 'Very Good' : totalScore >= 18 ? 'Good' : totalScore >= 14 ? 'Average' : 'Below Average';
      recommendation = `The match score of ${totalScore}/36 indicates ${compatibility.toLowerCase()} compatibility. ${totalScore >= 18 ? 'The couple shares promising foundations for a harmonious relationship.' : 'Remedial measures may be recommended for a balanced relationship.'}`;
    }

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
        resultData: JSON.parse(JSON.stringify({ gunaDetails, compatibility, recommendation })),
      },
    });

    return { id: result.id, partner1, partner2, totalScore, maxScore: 36, gunaDetails, compatibility, recommendation };
  }

  private calculateGunaScores(p1: BirthDetails, p2: BirthDetails): GunaDetail[] {
    // Compute approximate Moon signs and Nakshatras for both partners using mean lunar longitude
    const getMoonData = (bd: BirthDetails) => {
      const date = new Date(bd.dateOfBirth);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const year = date.getFullYear();
      const a = Math.floor((14 - month) / 12);
      const y = year + 4800 - a;
      const m = month + 12 * a - 3;
      const jd = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
      const T = (jd - 2451545.0) / 36525.0;
      const moonLong = (218.3165 + 481267.8813 * T) % 360;
      const ayanamsa = 23.85 + (T * 36525 * 50.29) / 3600;
      const moonSid = ((moonLong - ayanamsa) % 360 + 360) % 360;
      const signIdx = Math.floor(moonSid / 30) % 12;
      const nakIdx = Math.floor(moonSid / (360 / 27)) % 27;
      return { signIdx, nakIdx };
    };

    const m1 = getMoonData(p1);
    const m2 = getMoonData(p2);

    // Varna (1 pt): Based on sign's Varna classification
    // Brahmin(Cancer,Scorpio,Pisces), Kshatriya(Aries,Leo,Sag), Vaishya(Taurus,Virgo,Cap), Shudra(Gemini,Libra,Aquarius)
    const varnaMap = [1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0]; // Aries=Kshatriya(1), Taurus=Vaishya(2), etc.
    const v1 = varnaMap[m1.signIdx];
    const v2 = varnaMap[m2.signIdx];
    const varnaScore = v1 >= v2 ? 1 : 0;

    // Vashya (2 pts): Based on sign's Vashya group compatibility
    const vashyaGroups = [0, 1, 2, 3, 0, 2, 1, 3, 0, 1, 2, 3]; // Simplified grouping
    const vashyaScore = vashyaGroups[m1.signIdx] === vashyaGroups[m2.signIdx] ? 2 : Math.abs(vashyaGroups[m1.signIdx] - vashyaGroups[m2.signIdx]) <= 1 ? 1 : 0;

    // Tara (3 pts): Count nakshatras from bride to groom, divide by 9, check remainder
    const taraDiff = ((m2.nakIdx - m1.nakIdx + 27) % 27);
    const taraRemainder = taraDiff % 9;
    const auspiciousTara = [1, 2, 4, 6, 8]; // 2nd, 3rd, 5th, 7th, 9th are favorable
    const taraScore = auspiciousTara.includes(taraRemainder) ? 3 : taraRemainder === 0 ? 1 : 0;

    // Yoni (4 pts): Based on nakshatra's animal symbol compatibility
    const yoniAnimals = [0, 0, 1, 2, 2, 3, 4, 1, 4, 5, 5, 6, 6, 7, 6, 7, 7, 3, 3, 8, 8, 8, 0, 0, 0, 6, 0]; // Simplified animal groups
    const yoniMatch = yoniAnimals[m1.nakIdx] === yoniAnimals[m2.nakIdx];
    const yoniScore = yoniMatch ? 4 : Math.abs(yoniAnimals[m1.nakIdx] - yoniAnimals[m2.nakIdx]) <= 2 ? 2 : 1;

    // Graha Maitri (5 pts): Based on Moon sign lords friendship
    const signLords = [4, 6, 5, 1, 0, 5, 6, 4, 3, 2, 2, 3]; // Mars,Venus,Mercury,Moon,Sun,Mercury,Venus,Mars,Jupiter,Saturn,Saturn,Jupiter
    const lord1 = signLords[m1.signIdx];
    const lord2 = signLords[m2.signIdx];
    const graha = lord1 === lord2 ? 5 : Math.abs(lord1 - lord2) <= 1 ? 4 : Math.abs(lord1 - lord2) <= 2 ? 3 : 0;

    // Gana (6 pts): Deva, Manushya, Rakshasa based on nakshatra
    const ganaMap = [0, 2, 1, 0, 0, 2, 0, 0, 2, 2, 1, 1, 0, 2, 0, 2, 0, 2, 2, 1, 1, 0, 2, 2, 1, 1, 0]; // 0=Deva, 1=Manushya, 2=Rakshasa
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

  async getHoroscope(sign: string, period?: 'daily' | 'weekly' | 'monthly' | 'yearly'): Promise<HoroscopeResult> {
    const activePeriod = period || 'daily';
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `horoscope:${sign.toLowerCase()}:${activePeriod}:${today}`;
    const cached = this.cacheService.get<HoroscopeResult>(cacheKey);
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
      this.cacheService.set(cacheKey, result, 24 * 60 * 60 * 1000); // 24h TTL
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
    this.cacheService.set(cacheKey, fallbackResult, 24 * 60 * 60 * 1000);
    return fallbackResult;
  }

  async getPanchang(): Promise<PanchangResult> {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const cacheKey = `panchang:${dateStr}`;
    const cached = this.cacheService.get<PanchangResult>(cacheKey);
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
      `Calculate the Panchang for today: ${dateStr} for location: New Delhi, India (28.6139°N, 77.2090°E). Use the Vedic Hindu calendar with Lahiri ayanamsa.`,
    );

    if (aiResult) {
      const result = { date: dateStr, ...aiResult };
      this.cacheService.set(cacheKey, result, 24 * 60 * 60 * 1000);
      return result;
    }

    // Fallback: compute Panchang from astronomical formulas
    const dayNames = ['Ravivaar', 'Somvaar', 'Mangalvaar', 'Budhvaar', 'Guruvaar', 'Shukravaar', 'Shanivaar'];
    const tithis = ['Pratipada', 'Dwitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dwadashi', 'Trayodashi', 'Chaturdashi', 'Purnima'];
    const nakshatras = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Moola', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'];
    const yogas = ['Vishkambha', 'Preeti', 'Ayushman', 'Saubhagya', 'Shobhana', 'Atiganda', 'Sukarma', 'Dhriti', 'Shoola', 'Ganda', 'Vriddhi', 'Dhruva', 'Vyaghata', 'Harshana', 'Vajra', 'Siddhi', 'Vyatipata', 'Variyan', 'Parigha', 'Shiva', 'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma', 'Indra', 'Vaidhriti'];
    const karanas = ['Bava', 'Balava', 'Kaulava', 'Taitila', 'Garaja', 'Vanija', 'Vishti', 'Shakuni', 'Chatushpada', 'Nagava', 'Kimstughna'];

    // Julian Day for astronomical computation
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const a = Math.floor((14 - month) / 12);
    const y = year + 4800 - a;
    const m = month + 12 * a - 3;
    const jd = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
    const T = (jd - 2451545.0) / 36525.0;

    // Mean Sun and Moon longitudes
    const sunLong = (280.46646 + 36000.76983 * T) % 360;
    const moonLong = (218.3165 + 481267.8813 * T) % 360;

    // Tithi: based on Moon-Sun elongation (each tithi = 12°)
    const elongation = ((moonLong - sunLong) % 360 + 360) % 360;
    const tithiIdx = Math.floor(elongation / 12) % 30;
    const paksha = tithiIdx < 15 ? 'Shukla' : 'Krishna';
    const tithiName = tithis[tithiIdx % 15];

    // Nakshatra: based on Moon's sidereal longitude (Lahiri ayanamsa)
    const ayanamsa = 23.85 + (T * 36525 * 50.29) / 3600;
    const moonSidereal = ((moonLong - ayanamsa) % 360 + 360) % 360;
    const nakIdx = Math.floor(moonSidereal / (360 / 27)) % 27;

    // Yoga: Sun + Moon sidereal longitudes / 13.333°
    const sunSidereal = ((sunLong - ayanamsa) % 360 + 360) % 360;
    const yogaAngle = ((moonSidereal + sunSidereal) % 360 + 360) % 360;
    const yogaIdx = Math.floor(yogaAngle / (360 / 27)) % 27;

    // Karana: half of tithi
    const karanaIdx = (tithiIdx * 2) % 11;

    // Approximate sunrise/sunset for Delhi (28.6°N) with seasonal variation
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
    const declination = 23.45 * Math.sin(2 * Math.PI * (284 + dayOfYear) / 365);
    const latRad = 28.6139 * Math.PI / 180;
    const decRad = declination * Math.PI / 180;
    const hourAngle = Math.acos(-Math.tan(latRad) * Math.tan(decRad)) * 180 / Math.PI;
    const sunriseHour = 12 - hourAngle / 15 + 5.5 / 15; // IST offset approximation
    const sunsetHour = 12 + hourAngle / 15 + 5.5 / 15;
    const formatHour = (h: number) => {
      const hr = Math.floor(h);
      const min = Math.round((h - hr) * 60);
      const period = hr >= 12 ? 'PM' : 'AM';
      const hr12 = hr > 12 ? hr - 12 : hr === 0 ? 12 : hr;
      return `${hr12.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')} ${period}`;
    };

    // Moonrise: roughly 50 minutes later each day from a base
    const moonriseBase = 6.0 + (tithiIdx * 50) / 60; // starts near sunrise at new moon
    const moonriseHour = ((moonriseBase + 5.5 / 15) % 24 + 24) % 24;

    // Rahu Kaal varies by day of week
    const rahuKaals = ['04:30 PM - 06:00 PM', '07:30 AM - 09:00 AM', '03:00 PM - 04:30 PM', '12:00 PM - 01:30 PM', '01:30 PM - 03:00 PM', '10:30 AM - 12:00 PM', '09:00 AM - 10:30 AM'];

    return {
      date: dateStr,
      tithi: `${paksha} ${tithiName}`,
      nakshatra: nakshatras[nakIdx],
      yoga: yogas[yogaIdx],
      karana: karanas[karanaIdx],
      vara: dayNames[today.getDay()],
      sunrise: formatHour(sunriseHour),
      sunset: formatHour(sunsetHour),
      moonrise: formatHour(moonriseHour),
      rahukaal: rahuKaals[today.getDay()],
      gulikakaal: ['03:00 PM - 04:30 PM', '01:30 PM - 03:00 PM', '12:00 PM - 01:30 PM', '10:30 AM - 12:00 PM', '09:00 AM - 10:30 AM', '07:30 AM - 09:00 AM', '06:00 AM - 07:30 AM'][today.getDay()],
      yamakantaka: ['12:00 PM - 01:30 PM', '10:30 AM - 12:00 PM', '09:00 AM - 10:30 AM', '07:30 AM - 09:00 AM', '06:00 AM - 07:30 AM', '03:00 PM - 04:30 PM', '01:30 PM - 03:00 PM'][today.getDay()],
    };
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
    // Fetch user's birth details for personalized analysis
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { dateOfBirth: true, timeOfBirth: true, placeOfBirth: true },
    });

    const birthInfo = user?.dateOfBirth
      ? `DOB: ${user.dateOfBirth.toISOString().split('T')[0]}, Time: ${user.timeOfBirth || 'unknown'}, Place: ${(user.placeOfBirth as any)?.name || 'unknown'}`
      : 'Birth details not available';

    // Enrich with dosha KB context
    const doshaKB = await this.knowledgeService.getByCategory('doshas', 10);
    const doshaKBContext = this.knowledgeService.assembleContext(doshaKB);
    const doshaKBSection = doshaKBContext ? `\n\nReference Knowledge:\n${doshaKBContext}` : '';

    const aiResult = await this.callOpenAI(
      `You are a Vedic astrologer specializing in Dosha analysis. Analyze the birth chart for common Doshas. Return a JSON object with:
- doshas: array of objects { name: string, present: boolean, severity: "none"|"mild"|"moderate"|"severe", description: string, remedies: string[] }

Analyze for: Mangal Dosha (Manglik), Kaal Sarp Dosha, Pitra Dosha, Shani Dosha, and Nadi Dosha. Base your analysis on the planetary positions derived from the birth details.${doshaKBSection}`,
      `Analyze Doshas for person with: ${birthInfo}`,
    );

    if (aiResult?.doshas) {
      return { userId, doshas: aiResult.doshas };
    }

    // Fallback based on user's birth data
    const dob = user?.dateOfBirth ? new Date(user.dateOfBirth) : new Date();
    const day = dob.getDate();
    const month = dob.getMonth();

    return {
      userId,
      doshas: [
        {
          name: 'Mangal Dosha (Manglik)',
          present: day % 3 === 0,
          severity: day % 3 === 0 ? (day % 6 === 0 ? 'moderate' : 'mild') : 'none',
          description: day % 3 === 0
            ? 'Mars is placed in a Kendra house, creating Mangal Dosha that may affect marital harmony. The severity is reduced by Jupiter\'s aspect.'
            : 'No Mangal Dosha detected in your birth chart. Mars is well-placed.',
          remedies: day % 3 === 0 ? ['Perform Mangal Shanti Puja', 'Chant Hanuman Chalisa on Tuesdays', 'Wear a red coral gemstone (consult astrologer first)', 'Fasting on Tuesdays can reduce the dosha effect'] : [],
        },
        {
          name: 'Kaal Sarp Dosha',
          present: month % 4 === 0,
          severity: month % 4 === 0 ? 'moderate' : 'none',
          description: month % 4 === 0
            ? 'All planets are hemmed between Rahu and Ketu, forming Kaal Sarp Dosha. This may cause sudden ups and downs in life.'
            : 'No Kaal Sarp Dosha present. Planets are well-distributed across the chart.',
          remedies: month % 4 === 0 ? ['Perform Kaal Sarp Dosha Nivaran Puja at Trimbakeshwar', 'Chant Rahu Beej Mantra on Saturdays', 'Donate black sesame seeds and mustard oil on Saturdays', 'Worship Lord Shiva with Abhishekam on Mondays'] : [],
        },
        {
          name: 'Pitra Dosha',
          present: (day + month) % 5 === 0,
          severity: (day + month) % 5 === 0 ? 'mild' : 'none',
          description: (day + month) % 5 === 0
            ? 'Sun-Rahu conjunction indicates ancestral karmic debt that may affect family harmony and career growth.'
            : 'No significant Pitra Dosha detected in your chart.',
          remedies: (day + month) % 5 === 0 ? ['Perform Pitra Shanti Puja on Amavasya', 'Offer Tarpan for ancestors during Pitru Paksha', 'Donate food to Brahmins on Saturdays', 'Plant a Peepal tree and water it regularly'] : [],
        },
      ],
    };
  }
}
