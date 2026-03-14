import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { UserService } from '../user/user.service';

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
  period: 'daily' | 'weekly' | 'monthly';
  prediction: string;
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
  ) {}

  async generateKundli(userId: string, birthDetails: BirthDetails): Promise<KundliResult> {
    this.logger.log(`Generating Kundli for user: ${userId}`);

    const creditCost = this.configService.get<number>('credits.kundliCost', 2);
    await this.userService.deductCredits(userId, creditCost, 'Kundli generation');

    // Generate chart data (would integrate with a Vedic astrology library in production)
    const chartData = this.calculateChartData(birthDetails);

    // Persist to database
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

  async getMatching(userId: string, partner1: BirthDetails, partner2: BirthDetails): Promise<MatchingResult> {
    this.logger.log('Performing Kundli matching');

    const creditCost = this.configService.get<number>('credits.kundliCost', 2);
    await this.userService.deductCredits(userId, creditCost, 'Kundli matching');

    const gunaDetails: GunaDetail[] = [
      { guna: 'Varna', maxPoints: 1, obtainedPoints: 1, description: 'Spiritual compatibility' },
      { guna: 'Vashya', maxPoints: 2, obtainedPoints: 2, description: 'Mutual attraction' },
      { guna: 'Tara', maxPoints: 3, obtainedPoints: 2, description: 'Birth star compatibility' },
      { guna: 'Yoni', maxPoints: 4, obtainedPoints: 3, description: 'Nature compatibility' },
      { guna: 'Graha Maitri', maxPoints: 5, obtainedPoints: 4, description: 'Planetary friendship' },
      { guna: 'Gana', maxPoints: 6, obtainedPoints: 5, description: 'Temperament match' },
      { guna: 'Bhakoot', maxPoints: 7, obtainedPoints: 7, description: 'Emotional compatibility' },
      { guna: 'Nadi', maxPoints: 8, obtainedPoints: 4, description: 'Health and genes compatibility' },
    ];
    const totalScore = gunaDetails.reduce((sum, g) => sum + g.obtainedPoints, 0);

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
        resultData: { gunaDetails, compatibility: totalScore >= 24 ? 'Very Good' : totalScore >= 18 ? 'Good' : 'Average' },
      },
    });

    return {
      id: result.id,
      partner1,
      partner2,
      totalScore,
      maxScore: 36,
      gunaDetails,
      compatibility: totalScore >= 24 ? 'Very Good' : totalScore >= 18 ? 'Good' : 'Average',
      recommendation: `The match score of ${totalScore}/36 indicates ${totalScore >= 24 ? 'excellent' : 'good'} compatibility. The couple shares strong intellectual and emotional bonds.`,
    };
  }

  async getHoroscope(sign: string): Promise<HoroscopeResult> {
    this.logger.log(`Fetching horoscope for: ${sign}`);

    const apiKey = this.configService.get<string>('openai.apiKey');
    let prediction = `Today brings positive energy for ${sign}. The alignment of planets favors new beginnings and creative pursuits. Financial matters look promising, and social connections may lead to beneficial opportunities.`;

    if (apiKey) {
      try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey });
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: 'You are a Vedic astrologer. Generate a daily horoscope prediction in 3-4 sentences. Be positive and specific.' },
            { role: 'user', content: `Generate today's horoscope for ${sign}.` },
          ],
          max_tokens: 200,
        });
        prediction = completion.choices[0]?.message?.content || prediction;
      } catch (error) {
        this.logger.error('OpenAI horoscope generation failed', error);
      }
    }

    return {
      sign: sign.charAt(0).toUpperCase() + sign.slice(1).toLowerCase(),
      date: new Date().toISOString().split('T')[0],
      period: 'daily',
      prediction,
      luckyNumber: Math.floor(Math.random() * 9) + 1,
      luckyColor: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'White'][Math.floor(Math.random() * 7)],
      mood: 'Optimistic',
      compatibility: ['Aries', 'Leo', 'Sagittarius', 'Gemini', 'Libra', 'Aquarius'][Math.floor(Math.random() * 6)],
    };
  }

  async getPanchang(): Promise<PanchangResult> {
    const dayNames = ['Ravivaar', 'Somvaar', 'Mangalvaar', 'Budhvaar', 'Guruvaar', 'Shukravaar', 'Shanivaar'];

    return {
      date: new Date().toISOString().split('T')[0],
      tithi: 'Shukla Dashami',
      nakshatra: 'Uttara Phalguni',
      yoga: 'Siddhi',
      karana: 'Balava',
      vara: dayNames[new Date().getDay()],
      sunrise: '06:15 AM',
      sunset: '06:42 PM',
      moonrise: '11:30 AM',
      rahukaal: '10:30 AM - 12:00 PM',
      gulikakaal: '07:30 AM - 09:00 AM',
      yamakantaka: '01:30 PM - 03:00 PM',
    };
  }

  async getMuhurat(dto: MuhuratRequest): Promise<MuhuratResult> {
    return {
      purpose: dto.purpose,
      auspiciousTimes: [
        {
          date: dto.fromDate,
          startTime: '09:15 AM',
          endTime: '10:45 AM',
          quality: 'excellent',
          reason: 'Siddhi Yoga active, Shubh Muhurat with benefic planetary hour',
        },
        {
          date: dto.fromDate,
          startTime: '02:30 PM',
          endTime: '04:00 PM',
          quality: 'good',
          reason: 'Amrit Kaal period, favorable for new beginnings',
        },
      ],
    };
  }

  async getDosha(userId: string): Promise<DoshaResult> {
    return {
      userId,
      doshas: [
        {
          name: 'Mangal Dosha (Manglik)',
          present: true,
          severity: 'mild',
          description: 'Mars is placed in the 7th house, creating a mild Mangal Dosha that may affect marital harmony.',
          remedies: [
            'Perform Mangal Shanti Puja',
            'Chant Hanuman Chalisa on Tuesdays',
            'Wear a red coral gemstone after consulting an astrologer',
            'Marry after age 28 for natural dosha reduction',
          ],
        },
        {
          name: 'Kaal Sarp Dosha',
          present: false,
          severity: 'none',
          description: 'No Kaal Sarp Dosha present in the birth chart.',
          remedies: [],
        },
        {
          name: 'Pitra Dosha',
          present: true,
          severity: 'moderate',
          description: 'Sun-Rahu conjunction in the 9th house indicates Pitra Dosha affecting ancestral karma.',
          remedies: [
            'Perform Pitra Shanti Puja on Amavasya',
            'Donate food to Brahmins on Saturdays',
            'Offer Tarpan for ancestors during Pitru Paksha',
            'Plant a Peepal tree and water it regularly',
          ],
        },
      ],
    };
  }

  private calculateChartData(birthDetails: BirthDetails): any {
    // In production, integrate with a Vedic astrology calculation library
    return {
      ascendant: 'Aries',
      moonSign: 'Cancer',
      sunSign: 'Taurus',
      nakshatra: 'Pushya',
      houses: Array.from({ length: 12 }, (_, i) => ({
        house: i + 1,
        sign: ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'][i],
        planets: i === 0 ? ['Mars'] : i === 3 ? ['Moon'] : i === 6 ? ['Venus', 'Mercury'] : [],
      })),
      planetaryPositions: [
        { planet: 'Sun', sign: 'Taurus', house: 2, degree: 24.5, isRetrograde: false, nakshatra: 'Mrigashira' },
        { planet: 'Moon', sign: 'Cancer', house: 4, degree: 12.3, isRetrograde: false, nakshatra: 'Pushya' },
        { planet: 'Mars', sign: 'Aries', house: 1, degree: 8.7, isRetrograde: false, nakshatra: 'Ashwini' },
        { planet: 'Mercury', sign: 'Libra', house: 7, degree: 15.2, isRetrograde: false, nakshatra: 'Swati' },
        { planet: 'Jupiter', sign: 'Sagittarius', house: 9, degree: 20.1, isRetrograde: false, nakshatra: 'Purva Ashadha' },
        { planet: 'Venus', sign: 'Libra', house: 7, degree: 3.9, isRetrograde: false, nakshatra: 'Chitra' },
        { planet: 'Saturn', sign: 'Capricorn', house: 10, degree: 18.6, isRetrograde: true, nakshatra: 'Shravana' },
        { planet: 'Rahu', sign: 'Gemini', house: 3, degree: 10.0, isRetrograde: true, nakshatra: 'Ardra' },
        { planet: 'Ketu', sign: 'Sagittarius', house: 9, degree: 10.0, isRetrograde: true, nakshatra: 'Moola' },
      ],
      dashas: [
        {
          planet: 'Jupiter',
          startDate: '2020-01-01',
          endDate: '2036-01-01',
          subPeriods: [
            { planet: 'Jupiter', startDate: '2020-01-01', endDate: '2022-02-15' },
            { planet: 'Saturn', startDate: '2022-02-15', endDate: '2024-09-01' },
            { planet: 'Mercury', startDate: '2024-09-01', endDate: '2027-01-15' },
          ],
        },
      ],
      yogas: [
        { name: 'Gaja Kesari Yoga', description: 'Jupiter in Kendra from Moon - bestows wisdom and prosperity', effect: 'benefic' },
        { name: 'Budhaditya Yoga', description: 'Sun-Mercury conjunction - sharp intellect', effect: 'benefic' },
      ],
    };
  }
}
