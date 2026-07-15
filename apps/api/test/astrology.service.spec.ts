import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { AstrologyService } from '../src/modules/astrology/astrology.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserService } from '../src/modules/user/user.service';
import { OpenAIService } from '../src/openai/openai.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { KbService } from '../src/knowledge/kb.service';
import { MemoryCacheService } from '../src/common/cache.service';
import { EphemerisService } from '../src/ephemeris/ephemeris.service';
import { mockKnowledgeService, mockKbService, mockEphemerisService } from './helpers/mocks';

describe('AstrologyService', () => {
  let service: AstrologyService;
  let prisma: any;
  let userService: any;
  let openaiService: any;
  let cacheService: any;

  const mockBirthDetails = {
    dateOfBirth: '1990-05-15',
    timeOfBirth: '14:30',
    placeOfBirth: 'Mumbai',
    latitude: 19.076,
    longitude: 72.8777,
  };

  const mockUser = {
    id: 'test-uuid',
    name: 'Test User',
    email: 'test@example.com',
    credits: 20,
    role: 'USER',
    dateOfBirth: new Date('1990-05-15'),
    timeOfBirth: '14:30',
    placeOfBirth: { name: 'Mumbai', latitude: 19.076, longitude: 72.8777 },
  };

  beforeEach(async () => {
    prisma = {
      kundliChart: {
        create: jest.fn().mockResolvedValue({
          id: 'kundli-1',
          createdAt: new Date(),
        }),
        findFirst: jest.fn(),
      },
      matchingResult: {
        create: jest.fn().mockResolvedValue({
          id: 'match-1',
          createdAt: new Date(),
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
      },
    };

    userService = {
      deductCredits: jest.fn().mockResolvedValue(true),
      // Mirror the real deductWithRefund: deduct first (via the
      // deductCredits mock so tests can force insufficiency), throw on
      // failure, otherwise run the work callback and return its result.
      deductWithRefund: jest.fn(async (userId: string, cost: number, description: string, work: () => Promise<unknown>) => {
        const ok = await userService.deductCredits(userId, cost, description);
        if (!ok) throw new BadRequestException('Insufficient credits. Please purchase more credits to continue.');
        return work();
      }),
      findById: jest.fn().mockResolvedValue(mockUser),
      getProfile: jest.fn().mockResolvedValue(mockUser),
    };

    openaiService = {
      chat: jest.fn().mockResolvedValue(null),
      chatCompletion: jest.fn().mockResolvedValue(null),
      getClient: jest.fn().mockReturnValue(null),
      getModel: jest.fn().mockReturnValue('gpt-4o'),
      getModelForFeature: jest.fn().mockReturnValue('gpt-4o'),
    };

    cacheService = {
      get: jest.fn().mockReturnValue(null),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AstrologyService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                'openai.model': 'gpt-4o',
                'credits.kundliCost': 2,
                'credits.reportCost': 5,
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
        { provide: UserService, useValue: userService },
        { provide: OpenAIService, useValue: openaiService },
        { provide: MemoryCacheService, useValue: cacheService },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: EphemerisService, useValue: mockEphemerisService() },
        { provide: KbService, useValue: mockKbService() },
      ],
    }).compile();

    service = module.get<AstrologyService>(AstrologyService);
  });

  // ─── Cosmic Calendar Tests ────────────────────────────────────────────────

  describe('getCosmicCalendar', () => {
    it('returns a deterministic month of scored days', async () => {
      const a = await service.getCosmicCalendar(2025, 2, 'marriage', 28.6139, 77.209);
      expect(a.year).toBe(2025);
      expect(a.month).toBe(2);
      expect(a.activity).toBe('marriage');
      expect(a.days).toHaveLength(28); // February 2025 (non-leap)
      for (const d of a.days) {
        expect(d.date).toMatch(/^2025-02-\d{2}$/);
        expect(d.score).toBeGreaterThanOrEqual(0);
        expect(d.score).toBeLessThanOrEqual(100);
        expect(['excellent', 'good', 'neutral', 'caution', 'avoid']).toContain(d.recommendation);
        expect(d.tithi).toBeTruthy();
        expect(d.weekday).toBeGreaterThanOrEqual(0);
        expect(d.weekday).toBeLessThanOrEqual(6);
      }
      // Same inputs → same output.
      const b = await service.getCosmicCalendar(2025, 2, 'marriage', 28.6139, 77.209);
      expect(b.days).toEqual(a.days);
    });

    it('rejects an out-of-range month', async () => {
      await expect(service.getCosmicCalendar(2025, 13, 'general')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an out-of-range latitude', async () => {
      await expect(service.getCosmicCalendar(2025, 1, 'general', 999, 77)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ─── Horoscope Tests ──────────────────────────────────────────────────────

  describe('getHoroscope', () => {
    it('should return cached horoscope when available', async () => {
      const cachedResult = {
        sign: 'Aries',
        date: '2026-03-26',
        period: 'daily',
        prediction: 'Cached prediction',
        career: 'Cached career',
        health: 'Cached health',
        love: 'Cached love',
        luckyNumber: 7,
        luckyColor: 'Red',
        mood: 'Optimistic',
        compatibility: 'Leo',
      };
      cacheService.get.mockReturnValue(cachedResult);

      const result = await service.getHoroscope('aries');

      expect(result).toEqual(cachedResult);
      expect(openaiService.chat).not.toHaveBeenCalled();
    });

    it('should return AI-generated horoscope when OpenAI succeeds', async () => {
      openaiService.chat.mockResolvedValue(
        JSON.stringify({
          prediction: 'AI prediction for Aries',
          career: 'Career growth ahead',
          health: 'Focus on wellness',
          love: 'Romance is in the air',
          luckyNumber: 3,
          luckyColor: 'Crimson Red',
          mood: 'Energetic',
          compatibility: 'Sagittarius',
        }),
      );

      const result = await service.getHoroscope('aries', 'daily');

      expect(result.sign).toBe('Aries');
      expect(result.period).toBe('daily');
      expect(result.prediction).toBeDefined();
      expect(result.career).toBeDefined();
      expect(result.health).toBeDefined();
      expect(result.love).toBeDefined();
      expect(cacheService.set).toHaveBeenCalled();
    });

    it('should return fallback horoscope when OpenAI fails', async () => {
      openaiService.chat.mockResolvedValue(null);

      const result = await service.getHoroscope('aries', 'daily');

      expect(result.sign).toBe('Aries');
      expect(result.period).toBe('daily');
      expect(result.prediction).toBeTruthy();
      expect(result.career).toBeTruthy();
      expect(result.health).toBeTruthy();
      expect(result.love).toBeTruthy();
      expect(result.luckyNumber).toBeGreaterThanOrEqual(1);
      expect(result.luckyNumber).toBeLessThanOrEqual(9);
      expect(result.luckyColor).toBeTruthy();
      expect(result.mood).toBeTruthy();
      expect(result.compatibility).toBeTruthy();
    });

    it('should default to daily period when not specified', async () => {
      openaiService.chat.mockResolvedValue(null);

      const result = await service.getHoroscope('leo');

      expect(result.period).toBe('daily');
    });

    it('should handle all zodiac signs', async () => {
      openaiService.chat.mockResolvedValue(null);

      const signs = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];

      for (const sign of signs) {
        const result = await service.getHoroscope(sign);
        expect(result.sign).toBe(sign.charAt(0).toUpperCase() + sign.slice(1));
        expect(result.career).toContain(sign.charAt(0).toUpperCase() + sign.slice(1));
        expect(result.health).toContain(sign.charAt(0).toUpperCase() + sign.slice(1));
      }
    });

    it('should handle all period types', async () => {
      openaiService.chat.mockResolvedValue(null);

      const periods: Array<'daily' | 'weekly' | 'monthly' | 'yearly'> = ['daily', 'weekly', 'monthly', 'yearly'];

      for (const period of periods) {
        const result = await service.getHoroscope('aries', period);
        expect(result.period).toBe(period);
        expect(result.prediction).toBeTruthy();
      }
    });

    it('should generate sign-specific career content in fallback', async () => {
      openaiService.chatCompletion.mockResolvedValue(null);

      const aries = await service.getHoroscope('aries');
      const taurus = await service.getHoroscope('taurus');

      // Different signs should have different career content
      expect(aries.career).toContain('Aries');
      expect(taurus.career).toContain('Taurus');
      expect(aries.career).not.toBe(taurus.career);
    });

    it('should generate element-specific health content in fallback', async () => {
      openaiService.chat.mockResolvedValue(null);

      const aries = await service.getHoroscope('aries'); // Fire sign
      const taurus = await service.getHoroscope('taurus'); // Earth sign

      // Different elements should get different health advice
      expect(aries.health).not.toBe(taurus.health);
    });

    it('should cache horoscope results with 24h TTL', async () => {
      openaiService.chat.mockResolvedValue(null);

      await service.getHoroscope('aries', 'daily');

      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('horoscope:VEDIC:aries:daily:'),
        expect.objectContaining({ sign: 'Aries', period: 'daily' }),
        24 * 60 * 60 * 1000,
      );
    });
  });

  // ─── Panchang Tests ───────────────────────────────────────────────────────

  describe('getPanchang', () => {
    it('should return cached panchang when available', async () => {
      const cached = { date: '2026-03-26', tithi: 'Shukla Dashami' };
      cacheService.get.mockReturnValue(cached);

      const result = await service.getPanchang();

      expect(result).toEqual(cached);
    });

    it('should compute panchang deterministically (no LLM)', async () => {
      const result = await service.getPanchang();

      // Panchang is computed from Swiss Ephemeris, never the LLM.
      expect(openaiService.chatCompletion).not.toHaveBeenCalled();

      expect(result.date).toBeDefined();
      expect(result.tithi).toBeDefined();
      expect(result.nakshatra).toBeDefined();
      expect(result.yoga).toBeDefined();
      expect(result.karana).toBeDefined();
      expect(result.vara).toBeDefined();
      expect(result.sunrise).toBeDefined();
      expect(result.sunset).toBeDefined();
    });
  });

  // ─── Kundli Tests ─────────────────────────────────────────────────────────

  describe('generateKundli', () => {
    it('should deduct credits before generating kundli', async () => {
      prisma.kundliChart.create.mockResolvedValue({ id: 'kundli-1', createdAt: new Date('2026-01-01') });

      await service.generateKundli('test-uuid', mockBirthDetails);

      expect(userService.deductCredits).toHaveBeenCalledWith('test-uuid', 2, expect.any(String));
    });

    it('should return kundli with required fields', async () => {
      prisma.kundliChart.create.mockResolvedValue({ id: 'kundli-1', createdAt: new Date('2026-01-01') });

      const result = await service.generateKundli('test-uuid', mockBirthDetails);

      expect(result.userId).toBe('test-uuid');
      expect(result.birthDetails).toEqual(mockBirthDetails);
      expect(result.ascendant).toBeDefined();
      expect(result.moonSign).toBeDefined();
      expect(result.sunSign).toBeDefined();
      expect(result.nakshatra).toBeDefined();
      expect(result.houses).toBeDefined();
      expect(Array.isArray(result.houses)).toBe(true);
      expect(result.planetaryPositions).toBeDefined();
      expect(Array.isArray(result.planetaryPositions)).toBe(true);
    });

    it('should throw BadRequestException when credits insufficient', async () => {
      userService.deductCredits.mockResolvedValue(false);

      await expect(
        service.generateKundli('test-uuid', mockBirthDetails),
      ).rejects.toThrow(BadRequestException);
    });

    it('produces real dasha boundary dates, not all rounded to Jan 1 (M5)', async () => {
      prisma.kundliChart.create.mockResolvedValue({ id: 'kundli-1', createdAt: new Date('2026-01-01') });

      const result = await service.generateKundli('test-uuid', mockBirthDetails);

      expect(Array.isArray(result.dashas)).toBe(true);
      expect(result.dashas.length).toBeGreaterThan(0);
      for (const d of result.dashas) {
        expect(d.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(d.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
      // The old bug snapped every boundary to YYYY-01-01.
      const allJan1 = result.dashas.every(
        (d: any) => d.startDate.endsWith('-01-01') && d.endDate.endsWith('-01-01'),
      );
      expect(allJan1).toBe(false);
    });

    it('anchors the dasha timeline to the birth date, not Jan 1 of the birth year', async () => {
      prisma.kundliChart.create.mockResolvedValue({ id: 'kundli-1', createdAt: new Date('2026-01-01') });

      const result = await service.generateKundli('test-uuid', mockBirthDetails);

      // The running (first) Mahadasha is shown from the birth moment, so its
      // start date is exactly the birth date — previously it was anchored to
      // Jan 1 of the birth year (off by the day-of-year, up to ~a year).
      expect(result.dashas[0].startDate).toBe(mockBirthDetails.dateOfBirth);

      // Boundaries are contiguous and strictly increasing across the cycle.
      for (let i = 1; i < result.dashas.length; i++) {
        expect(result.dashas[i].startDate).toBe(result.dashas[i - 1].endDate);
        expect(result.dashas[i].startDate > result.dashas[i - 1].startDate).toBe(true);
      }

      // The full Vimshottari cycle from birth spans ~120 years minus the elapsed
      // portion of the first Mahadasha — i.e. it ends within (120y, birth+120y].
      const firstStart = new Date(result.dashas[0].startDate).getTime();
      const lastEnd = new Date(result.dashas[result.dashas.length - 1].endDate).getTime();
      const spanYears = (lastEnd - firstStart) / (365.2425 * 86400000);
      expect(spanYears).toBeGreaterThan(100);
      expect(spanYears).toBeLessThanOrEqual(120.001);
    });

    it('keeps Antardashas/Pratyantardashas within their parent window (no overflow)', async () => {
      prisma.kundliChart.create.mockResolvedValue({ id: 'kundli-1', createdAt: new Date('2026-01-01') });

      const result = await service.generateKundli('test-uuid', mockBirthDetails);

      for (const maha of result.dashas) {
        const subs = maha.subPeriods ?? [];
        expect(subs.length).toBeGreaterThan(0);
        // Antardashas tile the Mahadasha exactly: first starts at the Maha start,
        // last ends at the Maha end, and each is contiguous with the previous.
        expect(subs[0].startDate).toBe(maha.startDate);
        expect(subs[subs.length - 1].endDate).toBe(maha.endDate);
        for (let i = 1; i < subs.length; i++) {
          expect(subs[i].startDate).toBe(subs[i - 1].endDate);
        }
        // Pratyantardashas tile each Antardasha exactly.
        for (const sub of subs) {
          const pratys = sub.subPeriods ?? [];
          expect(pratys.length).toBeGreaterThan(0);
          expect(pratys[0].startDate).toBe(sub.startDate);
          expect(pratys[pratys.length - 1].endDate).toBe(sub.endDate);
        }
      }
    });

    it('assigns every planet a Bhava Chalit (Sripati) house in 1..12', async () => {
      prisma.kundliChart.create.mockResolvedValue({ id: 'kundli-1', createdAt: new Date('2026-01-01') });

      const result = await service.generateKundli('test-uuid', mockBirthDetails);

      for (const p of result.planetaryPositions) {
        expect(p.bhava).toBeGreaterThanOrEqual(1);
        expect(p.bhava).toBeLessThanOrEqual(12);
        expect(Number.isInteger(p.bhava)).toBe(true);
      }
    });
  });

  // ─── BaZi Tests (solar-term year + month) ──────────────────────────────────

  describe('getBazi', () => {
    it('places the year and month pillars by solar term (15 May 1990 → Metal Horse, Si month)', async () => {
      const res = await service.getBazi('test-uuid', { dateOfBirth: '1990-05-15', timeOfBirth: '14:30' });
      // 1990 is the year of the Metal (Geng) Horse (Wu).
      expect(res.pillars.year.heavenlyStem).toBe('Geng');
      expect(res.pillars.year.earthlyBranch).toBe('Wu');
      expect(res.pillars.year.element).toBe('Metal');
      // Mid-May falls in the Si (Snake) solar month; Five Tigers → Xin stem.
      expect(res.pillars.month.earthlyBranch).toBe('Si');
      expect(res.pillars.month.heavenlyStem).toBe('Xin');
    });

    it('rolls the BaZi year at Lichun, not Jan 1 (20 Jan 1990 is still the 1989 Earth Snake year)', async () => {
      const res = await service.getBazi('test-uuid', { dateOfBirth: '1990-01-20', timeOfBirth: '06:00' });
      // Before Lichun (~Feb 4), so the BaZi year is 1989 = Ji (Earth) Si (Snake).
      expect(res.pillars.year.heavenlyStem).toBe('Ji');
      expect(res.pillars.year.earthlyBranch).toBe('Si');
      expect(res.pillars.year.element).toBe('Earth');
    });

    it('uses coordinates picked for the chart instead of the stored profile coords', async () => {
      // When the birthplace autocomplete supplies coordinates, the solar-term
      // computation must use them and NOT fall back to the user's stored place.
      const spy = jest.spyOn(service as any, 'resolveUserBirthCoords');
      const res = await service.getBazi('test-uuid', {
        dateOfBirth: '1990-05-15',
        timeOfBirth: '14:30',
        latitude: 35.6762,
        longitude: 139.6503, // Tokyo
      });
      expect(res.pillars.year.element).toBeTruthy();
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ─── Matching Tests ───────────────────────────────────────────────────────

  describe('getMatching', () => {
    const partner1 = { ...mockBirthDetails };
    const partner2 = { ...mockBirthDetails, dateOfBirth: '1992-08-20', placeOfBirth: 'Delhi' };

    it('should deduct credits for matching', async () => {
      openaiService.chat.mockResolvedValue(null);

      await service.getMatching('test-uuid', partner1, partner2);

      expect(userService.deductCredits).toHaveBeenCalled();
    });

    it('should return matching result with guna scores', async () => {
      openaiService.chat.mockResolvedValue(null);

      const result = await service.getMatching('test-uuid', partner1, partner2);

      expect(result.totalScore).toBeDefined();
      expect(result.maxScore).toBe(36);
      expect(result.gunaDetails).toBeDefined();
      expect(Array.isArray(result.gunaDetails)).toBe(true);
      expect(result.gunaDetails.length).toBe(8); // 8 Gunas in Ashtakoot
    });

    it('should have total points not exceeding max', async () => {
      openaiService.chat.mockResolvedValue(null);

      const result = await service.getMatching('test-uuid', partner1, partner2);

      expect(result.totalScore).toBeLessThanOrEqual(36);
      expect(result.totalScore).toBeGreaterThanOrEqual(0);
    });
  });
});
