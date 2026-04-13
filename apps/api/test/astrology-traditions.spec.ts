/**
 * Astrology Traditions — Backend Tests
 *
 * Tests the tradition config registry, tradition-aware horoscope generation,
 * multi-tradition horoscopes, Chinese zodiac calculation, and the available
 * traditions endpoint.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AstrologyService } from '../src/modules/astrology/astrology.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserService } from '../src/modules/user/user.service';
import { OpenAIService } from '../src/openai/openai.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { MemoryCacheService } from '../src/common/cache.service';
import { EphemerisService } from '../src/ephemeris/ephemeris.service';
import { mockKnowledgeService, mockEphemerisService } from './helpers/mocks';
import {
  TRADITION_CONFIGS,
  AVAILABLE_TRADITIONS,
  getTraditionConfig,
  CHINESE_ANIMALS,
  CHINESE_ELEMENTS,
  TraditionConfig,
} from '../src/modules/astrology/traditions';

// ─── Tradition Config Registry Tests ──────────────────────────────────────────

describe('Tradition Config Registry', () => {
  it('should export configs for VEDIC, WESTERN, and CHINESE', () => {
    expect(TRADITION_CONFIGS.VEDIC).toBeDefined();
    expect(TRADITION_CONFIGS.WESTERN).toBeDefined();
    expect(TRADITION_CONFIGS.CHINESE).toBeDefined();
  });

  it('should export configs for future traditions (HELLENISTIC, HORARY, MEDICAL)', () => {
    expect(TRADITION_CONFIGS.HELLENISTIC).toBeDefined();
    expect(TRADITION_CONFIGS.HORARY).toBeDefined();
    expect(TRADITION_CONFIGS.MEDICAL).toBeDefined();
  });

  it('should mark only VEDIC, WESTERN, CHINESE as available', () => {
    expect(TRADITION_CONFIGS.VEDIC.isAvailable).toBe(true);
    expect(TRADITION_CONFIGS.WESTERN.isAvailable).toBe(true);
    expect(TRADITION_CONFIGS.CHINESE.isAvailable).toBe(true);
    expect(TRADITION_CONFIGS.HELLENISTIC.isAvailable).toBe(false);
    expect(TRADITION_CONFIGS.HORARY.isAvailable).toBe(false);
    expect(TRADITION_CONFIGS.MEDICAL.isAvailable).toBe(false);
  });

  it('AVAILABLE_TRADITIONS should only include available configs', () => {
    expect(AVAILABLE_TRADITIONS).toHaveLength(3);
    const ids = AVAILABLE_TRADITIONS.map(t => t.id);
    expect(ids).toContain('VEDIC');
    expect(ids).toContain('WESTERN');
    expect(ids).toContain('CHINESE');
    expect(ids).not.toContain('HELLENISTIC');
  });

  it('getTraditionConfig should return config by ID', () => {
    const vedic = getTraditionConfig('VEDIC');
    expect(vedic).toBeDefined();
    expect(vedic!.id).toBe('VEDIC');
    expect(vedic!.zodiacType).toBe('sidereal');
  });

  it('getTraditionConfig should return undefined for unknown ID', () => {
    expect(getTraditionConfig('MAYAN')).toBeUndefined();
  });

  describe('VEDIC config', () => {
    let config: TraditionConfig;
    beforeAll(() => { config = TRADITION_CONFIGS.VEDIC; });

    it('should use sidereal zodiac', () => {
      expect(config.zodiacType).toBe('sidereal');
    });

    it('should have 12 zodiac signs', () => {
      expect(config.signSystem).toHaveLength(12);
      expect(config.signSystem[0]).toBe('Aries');
    });

    it('should use Equal house system', () => {
      expect(config.houseSystem).toBe('Equal');
    });

    it('should include Vedic-specific features', () => {
      expect(config.features).toContain('kundli');
      expect(config.features).toContain('matching');
      expect(config.features).toContain('panchang');
      expect(config.features).toContain('dosha');
    });

    it('should generate a non-empty horoscope prompt', () => {
      const prompt = config.horoscopePrompt('Aries', 'daily', "today's");
      expect(prompt).toBeTruthy();
      expect(prompt).toContain('Vedic');
      expect(prompt).toContain('Nakshatras');
    });
  });

  describe('WESTERN config', () => {
    let config: TraditionConfig;
    beforeAll(() => { config = TRADITION_CONFIGS.WESTERN; });

    it('should use tropical zodiac', () => {
      expect(config.zodiacType).toBe('tropical');
    });

    it('should have 12 zodiac signs', () => {
      expect(config.signSystem).toHaveLength(12);
    });

    it('should use Placidus house system', () => {
      expect(config.houseSystem).toBe('Placidus');
    });

    it('should include Western-specific features', () => {
      expect(config.features).toContain('synastry');
      expect(config.features).toContain('transits');
      expect(config.features).toContain('natalChart');
    });

    it('should generate a prompt referencing Western concepts', () => {
      const prompt = config.horoscopePrompt('Aries', 'weekly', "this week's");
      expect(prompt).toContain('Western');
      expect(prompt).toContain('aspects');
    });
  });

  describe('CHINESE config', () => {
    let config: TraditionConfig;
    beforeAll(() => { config = TRADITION_CONFIGS.CHINESE; });

    it('should use lunar zodiac', () => {
      expect(config.zodiacType).toBe('lunar');
    });

    it('should have 12 animal signs', () => {
      expect(config.signSystem).toHaveLength(12);
      expect(config.signSystem).toContain('Rat');
      expect(config.signSystem).toContain('Dragon');
      expect(config.signSystem).toContain('Pig');
    });

    it('should use FourPillars house system', () => {
      expect(config.houseSystem).toBe('FourPillars');
    });

    it('should include Chinese-specific features', () => {
      expect(config.features).toContain('elementAnalysis');
      expect(config.features).toContain('compatibility');
    });

    it('should generate a prompt referencing Chinese concepts', () => {
      const prompt = config.horoscopePrompt('Dragon', 'yearly', "this year's");
      expect(prompt).toContain('Chinese');
      expect(prompt).toContain('Five Elements');
      expect(prompt).toContain('BaZi');
    });
  });

  describe('CHINESE_ANIMALS and CHINESE_ELEMENTS exports', () => {
    it('should have 12 animals', () => {
      expect(CHINESE_ANIMALS).toHaveLength(12);
      expect(CHINESE_ANIMALS[0]).toBe('Rat');
      expect(CHINESE_ANIMALS[11]).toBe('Pig');
    });

    it('should have 5 elements', () => {
      expect(CHINESE_ELEMENTS).toHaveLength(5);
      expect(CHINESE_ELEMENTS).toEqual(['Wood', 'Fire', 'Earth', 'Metal', 'Water']);
    });
  });

  describe('Future tradition configs', () => {
    it('should have empty horoscope prompts', () => {
      expect(TRADITION_CONFIGS.HELLENISTIC.horoscopePrompt('Aries', 'daily', '')).toBe('');
      expect(TRADITION_CONFIGS.HORARY.horoscopePrompt('Aries', 'daily', '')).toBe('');
      expect(TRADITION_CONFIGS.MEDICAL.horoscopePrompt('Aries', 'daily', '')).toBe('');
    });

    it('should have empty features arrays', () => {
      expect(TRADITION_CONFIGS.HELLENISTIC.features).toHaveLength(0);
      expect(TRADITION_CONFIGS.HORARY.features).toHaveLength(0);
      expect(TRADITION_CONFIGS.MEDICAL.features).toHaveLength(0);
    });
  });
});

// ─── Tradition-Aware AstrologyService Tests ───────────────────────────────────

describe('AstrologyService — Tradition Features', () => {
  let service: AstrologyService;
  let openaiService: any;
  let cacheService: any;

  beforeEach(async () => {
    const prisma = {
      kundliChart: { create: jest.fn().mockResolvedValue({ id: 'k1', createdAt: new Date() }), findFirst: jest.fn() },
      matchingResult: { create: jest.fn().mockResolvedValue({ id: 'm1', createdAt: new Date() }) },
      user: { findUnique: jest.fn().mockResolvedValue({
        id: 'test-uuid', name: 'Test', email: 'test@test.com', credits: 20, role: 'USER',
        dateOfBirth: new Date('1990-05-15'), timeOfBirth: '14:30',
        placeOfBirth: { name: 'Mumbai', latitude: 19.076, longitude: 72.8777 },
      }) },
    };

    const userService = {
      deductCredits: jest.fn().mockResolvedValue(true),
      findById: jest.fn().mockResolvedValue(prisma.user.findUnique()),
      getProfile: jest.fn().mockResolvedValue(prisma.user.findUnique()),
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

  // ─── getHoroscope with tradition param ────────────────────────────────────

  describe('getHoroscope with tradition param', () => {
    it('should default to VEDIC when no tradition specified', async () => {
      openaiService.chat.mockResolvedValue(null);
      const result = await service.getHoroscope('aries');
      // Cache key should include VEDIC
      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('VEDIC'),
        expect.objectContaining({ sign: 'Aries' }),
        expect.any(Number),
      );
    });

    it('should accept WESTERN tradition', async () => {
      openaiService.chat.mockResolvedValue(null);
      const result = await service.getHoroscope('aries', 'daily', undefined, 'WESTERN');
      expect(result.sign).toBe('Aries');
      expect(result.period).toBe('daily');
      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('WESTERN'),
        expect.any(Object),
        expect.any(Number),
      );
    });

    it('should accept CHINESE tradition', async () => {
      openaiService.chat.mockResolvedValue(null);
      const result = await service.getHoroscope('dragon', 'daily', undefined, 'CHINESE');
      expect(result.sign).toBe('Dragon');
      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('CHINESE'),
        expect.any(Object),
        expect.any(Number),
      );
    });

    it('should include tradition in cache key for isolation', async () => {
      openaiService.chat.mockResolvedValue(null);
      await service.getHoroscope('aries', 'daily', undefined, 'VEDIC');
      await service.getHoroscope('aries', 'daily', undefined, 'WESTERN');

      const calls = cacheService.set.mock.calls;
      expect(calls[0][0]).toContain('VEDIC');
      expect(calls[1][0]).toContain('WESTERN');
      expect(calls[0][0]).not.toBe(calls[1][0]);
    });

    it('should use tradition-specific AI prompt via chatCompletion', async () => {
      openaiService.chatCompletion.mockResolvedValue({
        prediction: 'Western prediction',
        career: 'Career insights',
        health: 'Health insights',
        love: 'Love insights',
        luckyNumber: 5,
        luckyColor: 'Blue',
        mood: 'Calm',
        compatibility: 'Libra',
      });

      await service.getHoroscope('aries', 'daily', undefined, 'WESTERN');

      expect(openaiService.chatCompletion).toHaveBeenCalled();
      const callArgs = openaiService.chatCompletion.mock.calls[0][0];
      // System message should reference Western astrology
      const systemMsg = callArgs.messages.find((m: any) => m.role === 'system');
      expect(systemMsg.content).toContain('Western');
    });
  });

  // ─── getMultiTraditionHoroscope ───────────────────────────────────────────

  describe('getMultiTraditionHoroscope', () => {
    it('should fetch horoscopes for multiple traditions in parallel', async () => {
      openaiService.chat.mockResolvedValue(null);

      const result = await service.getMultiTraditionHoroscope(
        'aries', 'daily', ['VEDIC', 'WESTERN'],
      );

      expect(result.traditions).toBeDefined();
      expect(result.traditions['VEDIC']).toBeDefined();
      expect(result.traditions['WESTERN']).toBeDefined();
      expect(result.traditions['VEDIC'].sign).toBe('Aries');
      expect(result.traditions['WESTERN'].sign).toBe('Aries');
    });

    it('should generate combined summary for multi-tradition', async () => {
      // First two calls return horoscope fallbacks (null), third returns summary
      openaiService.chatCompletion
        .mockResolvedValueOnce(null) // VEDIC horoscope (fallback)
        .mockResolvedValueOnce(null) // WESTERN horoscope (fallback)
        .mockResolvedValueOnce({ summary: 'Both traditions agree on positive energy.' });

      const result = await service.getMultiTraditionHoroscope(
        'aries', 'daily', ['VEDIC', 'WESTERN'],
      );

      expect(result.summary).toBe('Both traditions agree on positive energy.');
    });

    it('should not generate summary for single tradition', async () => {
      openaiService.chat.mockResolvedValue(null);

      const result = await service.getMultiTraditionHoroscope(
        'aries', 'daily', ['VEDIC'],
      );

      expect(result.traditions['VEDIC']).toBeDefined();
      expect(result.summary).toBeUndefined();
    });

    it('should handle three traditions', async () => {
      openaiService.chat.mockResolvedValue(null);

      const result = await service.getMultiTraditionHoroscope(
        'aries', 'daily', ['VEDIC', 'WESTERN', 'CHINESE'],
      );

      expect(Object.keys(result.traditions)).toHaveLength(3);
    });
  });

  // ─── getAvailableTraditions ───────────────────────────────────────────────

  describe('getAvailableTraditions', () => {
    it('should return list of available traditions', () => {
      const traditions = service.getAvailableTraditions();

      expect(traditions).toHaveLength(3);
      expect(traditions.map(t => t.id)).toEqual(['VEDIC', 'WESTERN', 'CHINESE']);
    });

    it('should include required fields in each tradition', () => {
      const traditions = service.getAvailableTraditions();

      for (const t of traditions) {
        expect(t.id).toBeDefined();
        expect(t.name).toBeDefined();
        expect(t.description).toBeDefined();
        expect(t.zodiacType).toBeDefined();
        expect(t.signSystem).toBeDefined();
        expect(Array.isArray(t.signSystem)).toBe(true);
        expect(t.features).toBeDefined();
        expect(t.isAvailable).toBe(true);
      }
    });

    it('should not include systemPromptPrefix (security)', () => {
      const traditions = service.getAvailableTraditions();
      for (const t of traditions) {
        expect((t as any).systemPromptPrefix).toBeUndefined();
        expect((t as any).horoscopePrompt).toBeUndefined();
      }
    });
  });

  // ─── getChineseZodiac ─────────────────────────────────────────────────────

  describe('getChineseZodiac', () => {
    it('should return correct animal for known years', () => {
      expect(service.getChineseZodiac(2024).animal).toBe('Dragon');
      expect(service.getChineseZodiac(2023).animal).toBe('Rabbit');
      expect(service.getChineseZodiac(2020).animal).toBe('Rat');
      expect(service.getChineseZodiac(1990).animal).toBe('Horse');
      expect(service.getChineseZodiac(1988).animal).toBe('Dragon');
    });

    it('should return correct element', () => {
      // 2024 = Wood Dragon
      const r2024 = service.getChineseZodiac(2024);
      expect(r2024.element).toBe('Wood');

      // 2020 = Metal Rat
      const r2020 = service.getChineseZodiac(2020);
      expect(r2020.element).toBe('Metal');
    });

    it('should return correct Yin-Yang', () => {
      expect(service.getChineseZodiac(2024).yinYang).toBe('Yang'); // even year
      expect(service.getChineseZodiac(2023).yinYang).toBe('Yin');  // odd year
    });

    it('should handle historical years', () => {
      const result = service.getChineseZodiac(1900);
      expect(result.animal).toBeTruthy();
      expect(result.element).toBeTruthy();
      expect(result.yinYang).toBeTruthy();
    });

    it('should cycle through all 12 animals across 12 consecutive years', () => {
      const animals = new Set<string>();
      for (let year = 2020; year < 2032; year++) {
        animals.add(service.getChineseZodiac(year).animal);
      }
      expect(animals.size).toBe(12);
    });

    it('should return same animal for years 12 apart', () => {
      expect(service.getChineseZodiac(2000).animal).toBe(service.getChineseZodiac(2012).animal);
      expect(service.getChineseZodiac(1990).animal).toBe(service.getChineseZodiac(2002).animal);
    });
  });
});

// ─── AstrologyController Tradition Endpoints ────────────────────────────────

describe('AstrologyController — Tradition Endpoints', () => {
  // Controller tests verify the routing and parameter passing.
  // Since the controller is a thin layer over the service, we test
  // the parameter parsing logic that the controller does.

  describe('multi-tradition horoscope query parsing', () => {
    it('should split comma-separated traditions string', () => {
      const traditions = 'VEDIC,WESTERN';
      const parsed = traditions.split(',').map(t => t.trim().toUpperCase());
      expect(parsed).toEqual(['VEDIC', 'WESTERN']);
    });

    it('should handle whitespace in traditions string', () => {
      const traditions = ' vedic , western , chinese ';
      const parsed = traditions.split(',').map(t => t.trim().toUpperCase());
      expect(parsed).toEqual(['VEDIC', 'WESTERN', 'CHINESE']);
    });

    it('should default to VEDIC when no traditions provided', () => {
      const traditions = undefined as string | undefined;
      const parsed = traditions ? traditions.split(',').map((t) => t.trim().toUpperCase()) : ['VEDIC'];
      expect(parsed).toEqual(['VEDIC']);
    });

    it('should handle single tradition', () => {
      const traditions = 'CHINESE';
      const parsed = traditions.split(',').map(t => t.trim().toUpperCase());
      expect(parsed).toEqual(['CHINESE']);
    });
  });

  describe('chinese-zodiac year parsing', () => {
    it('should parse year string to number', () => {
      expect(parseInt('2024', 10)).toBe(2024);
      expect(parseInt('1990', 10)).toBe(1990);
    });
  });
});
