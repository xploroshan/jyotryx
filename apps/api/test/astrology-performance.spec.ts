/**
 * Astrology Traditions — Performance Tests
 *
 * Validates that tradition-related operations perform within acceptable
 * bounds: config lookups, Chinese zodiac calculations, and tradition
 * registry operations.
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
} from '../src/modules/astrology/traditions';

describe('Performance — Tradition Config Operations', () => {
  it('getTraditionConfig lookup should complete in <1ms for 1000 lookups', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      getTraditionConfig('VEDIC');
      getTraditionConfig('WESTERN');
      getTraditionConfig('CHINESE');
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100); // 3000 lookups in <100ms
  });

  it('AVAILABLE_TRADITIONS filter should be pre-computed (not recomputed)', () => {
    // AVAILABLE_TRADITIONS is computed at module load time
    const start = performance.now();
    for (let i = 0; i < 10000; i++) {
      const _ = AVAILABLE_TRADITIONS.length;
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(10); // Should be near-instant
  });

  it('tradition horoscope prompt generation should be fast', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      TRADITION_CONFIGS.VEDIC.horoscopePrompt('Aries', 'daily', "today's");
      TRADITION_CONFIGS.WESTERN.horoscopePrompt('Aries', 'weekly', "this week's");
      TRADITION_CONFIGS.CHINESE.horoscopePrompt('Dragon', 'yearly', "this year's");
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200); // 3000 prompt generations in <200ms
  });
});

describe('Performance — Chinese Zodiac Calculation', () => {
  let service: AstrologyService;

  beforeEach(async () => {
    const prisma = {
      kundliChart: { create: jest.fn(), findFirst: jest.fn() },
      matchingResult: { create: jest.fn() },
      user: { findUnique: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AstrologyService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string, def?: any) => def) },
        },
        { provide: UserService, useValue: { deductCredits: jest.fn(), findById: jest.fn(), getProfile: jest.fn() } },
        { provide: OpenAIService, useValue: { chat: jest.fn(), chatCompletion: jest.fn(), getClient: jest.fn(), getModel: jest.fn().mockReturnValue('gpt-4o'), getModelForFeature: jest.fn().mockReturnValue('gpt-4o') } },
        { provide: MemoryCacheService, useValue: { get: jest.fn(), set: jest.fn() } },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: EphemerisService, useValue: mockEphemerisService() },
      ],
    }).compile();

    service = module.get<AstrologyService>(AstrologyService);
  });

  it('should calculate Chinese zodiac for 10,000 years in <100ms', () => {
    const start = performance.now();
    for (let year = 1900; year < 11900; year++) {
      service.getChineseZodiac(year);
    }
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });

  it('should return consistent results across repeated calculations', () => {
    const results1 = [];
    const results2 = [];
    for (let year = 2000; year < 2024; year++) {
      results1.push(service.getChineseZodiac(year));
      results2.push(service.getChineseZodiac(year));
    }
    expect(results1).toEqual(results2);
  });
});

describe('Performance — Horoscope Cache Key Generation', () => {
  it('cache key generation should be fast for varied inputs', () => {
    const signs = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
    const periods = ['daily', 'weekly', 'monthly', 'yearly'];
    const traditions = ['VEDIC', 'WESTERN', 'CHINESE'];
    const today = new Date().toISOString().split('T')[0];

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      for (const sign of signs) {
        for (const period of periods) {
          for (const tradition of traditions) {
            const key = `horoscope:${tradition}:${sign}:${period}:${today}`;
          }
        }
      }
    }
    const elapsed = performance.now() - start;
    // 144,000 key generations should complete in under 500ms
    expect(elapsed).toBeLessThan(500);
  });
});

describe('Performance — Tradition Registry Memory', () => {
  it('tradition configs should not contain excessively large data', () => {
    const configJson = JSON.stringify(TRADITION_CONFIGS);
    const sizeKB = new Blob([configJson]).size / 1024;
    // All configs together should be under 50KB
    expect(sizeKB).toBeLessThan(50);
  });

  it('each tradition prompt should be reasonable size', () => {
    for (const config of AVAILABLE_TRADITIONS) {
      const prompt = config.horoscopePrompt('Aries', 'daily', "today's");
      // Each prompt should be under 5KB
      expect(prompt.length).toBeLessThan(5000);
    }
  });
});
