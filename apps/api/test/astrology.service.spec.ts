import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { AstrologyService } from '../src/modules/astrology/astrology.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserService } from '../src/modules/user/user.service';
import { OpenAIService } from '../src/openai/openai.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { MemoryCacheService } from '../src/common/cache.service';
import { EphemerisService } from '../src/ephemeris/ephemeris.service';
import { mockKnowledgeService, mockEphemerisService } from './helpers/mocks';

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
      ],
    }).compile();

    service = module.get<AstrologyService>(AstrologyService);
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
        expect.stringContaining('horoscope:aries:daily:'),
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

    it('should return fallback panchang when OpenAI fails', async () => {
      openaiService.chat.mockResolvedValue(null);

      const result = await service.getPanchang();

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
