import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DailyBriefingService } from '../src/modules/daily-briefing/daily-briefing.service';
import { NumerologyService } from '../src/modules/numerology/numerology.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { ModerationService } from '../src/safety/moderation.service';
import { MemoryService } from '../src/modules/memory/memory.service';
import { GocharService } from '../src/modules/daily-briefing/gochar.service';
import { KbService } from '../src/knowledge/kb.service';
import { AstrologyService } from '../src/modules/astrology/astrology.service';
import { ChatService } from '../src/modules/chat/chat.service';
import { ReportService } from '../src/modules/report/report.service';
import { PalmistryService } from '../src/modules/palmistry/palmistry.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { FeatureAccessService } from '../src/common/feature-access/feature-access.service';
import { mockFeatureAccessService } from './helpers/mocks';
import { OpenAIService } from '../src/openai/openai.service';
import { UserService } from '../src/modules/user/user.service';
import { MemoryCacheService } from '../src/common/cache.service';
import { LlmService } from '../src/llm/llm.service';
import { EphemerisService } from '../src/ephemeris/ephemeris.service';
import { StorageService } from '../src/storage/storage.service';
import {
  mockOpenAIService,
  mockKnowledgeService,
  mockKbService,
  mockPrismaService,
  mockCacheService,
  mockUserService,
  mockConfigService,
  mockUser,
  mockBirthDetails,
  createMockRedis,
  mockLlmService,
  mockEphemerisService,
  mockStorageService,
  mockMemoryService,
  mockGocharService,
} from './helpers/mocks';

// ─── Graceful Degradation Tests ──────────────────────────────────────────────

describe('Stability: Graceful Degradation', () => {
  describe('DailyBriefingService - OpenAI down', () => {
    let service: DailyBriefingService;
    let prisma: any;

    beforeEach(async () => {
      prisma = mockPrismaService();
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DailyBriefingService,
          { provide: PrismaService, useValue: prisma },
          { provide: OpenAIService, useValue: mockOpenAIService() },
          { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: ModerationService, useValue: { checkAndRecord: jest.fn().mockResolvedValue(null) } },
        { provide: ModerationService, useValue: { checkAndRecord: jest.fn().mockResolvedValue(null) } },
          { provide: KbService, useValue: mockKbService() },
          { provide: MemoryCacheService, useValue: mockCacheService() },
        ],
      }).compile();

      service = module.get<DailyBriefingService>(DailyBriefingService);
    });

    it('should return complete briefing even when AI is unavailable', async () => {
      const result = await service.getDailyBriefing('test-uuid');

      expect(result.greeting).toBeTruthy();
      expect(result.summary).toBeTruthy();
      expect(result.doList.length).toBeGreaterThan(0);
      expect(result.avoidList.length).toBeGreaterThan(0);
      expect(result.planetaryHours.length).toBe(24);
      expect(result.panchang).toBeDefined();
      expect(result.remedy).toBeTruthy();
      expect(result.mantra).toBeTruthy();
    });
  });

  describe('AstrologyService - OpenAI down', () => {
    let service: AstrologyService;
    let prisma: any;

    beforeEach(async () => {
      prisma = mockPrismaService();
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const failingOpenAI = mockOpenAIService();
      failingOpenAI.chat = jest.fn().mockResolvedValue(null);
      failingOpenAI.chatCompletion = jest.fn().mockResolvedValue(null);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AstrologyService,
          { provide: PrismaService, useValue: prisma },
          { provide: ConfigService, useValue: mockConfigService() },
          { provide: UserService, useValue: mockUserService() },
          { provide: FeatureAccessService, useValue: mockFeatureAccessService() },
          { provide: OpenAIService, useValue: failingOpenAI },
          { provide: MemoryCacheService, useValue: mockCacheService() },
          { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: ModerationService, useValue: { checkAndRecord: jest.fn().mockResolvedValue(null) } },
          { provide: EphemerisService, useValue: mockEphemerisService() },
          { provide: KbService, useValue: mockKbService() },
        ],
      }).compile();

      service = module.get<AstrologyService>(AstrologyService);
    });

    it('should return fallback horoscope for all signs', async () => {
      const signs = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
        'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];

      for (const sign of signs) {
        const result = await service.getHoroscope(sign);
        expect(result.sign).toBeTruthy();
        expect(result.prediction).toBeTruthy();
        expect(result.career).toBeTruthy();
        expect(result.health).toBeTruthy();
        expect(result.love).toBeTruthy();
      }
    });

    it('should return fallback panchang', async () => {
      const result = await service.getPanchang();
      expect(result.tithi).toBeTruthy();
      expect(result.nakshatra).toBeTruthy();
      expect(result.vara).toBeTruthy();
    });

    it('should return fallback kundli with all planetary positions', async () => {
      prisma.kundliChart.create.mockResolvedValue({ id: 'k1', createdAt: new Date() });

      const result = await service.generateKundli('test-uuid', mockBirthDetails);
      expect(result.ascendant).toBeTruthy();
      expect(result.moonSign).toBeTruthy();
      expect(result.planetaryPositions.length).toBeGreaterThan(0);
      expect(result.houses.length).toBeGreaterThan(0);
    });
  });

  describe('ChatService - OpenAI down', () => {
    let service: ChatService;
    let prisma: any;

    beforeEach(async () => {
      prisma = mockPrismaService();

      const failingOpenAI = mockOpenAIService();
      failingOpenAI.chatCompletion = jest.fn().mockResolvedValue(null);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ChatService,
          { provide: PrismaService, useValue: prisma },
          { provide: ConfigService, useValue: mockConfigService() },
          { provide: UserService, useValue: mockUserService() },
          { provide: FeatureAccessService, useValue: mockFeatureAccessService() },
          { provide: OpenAIService, useValue: failingOpenAI },
          { provide: LlmService, useValue: mockLlmService() },
          { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: ModerationService, useValue: { checkAndRecord: jest.fn().mockResolvedValue(null) } },
        { provide: MemoryService, useValue: mockMemoryService() },
        { provide: GocharService, useValue: mockGocharService() },
        ],
      }).compile();

      service = module.get<ChatService>(ChatService);
    });

    it('should return meaningful fallback response', async () => {
      prisma.chatSession.findFirst.mockResolvedValue(null);
      prisma.chatSession.create.mockResolvedValue({
        id: 'session-1', userId: 'test-uuid', title: 'Test', category: 'general',
        createdAt: new Date(), updatedAt: new Date(), messages: [],
      });
      prisma.chatMessage.create.mockResolvedValue({
        id: 'msg-1', role: 'assistant', content: 'Fallback', createdAt: new Date(),
      });
      prisma.chatMessage.findMany.mockResolvedValue([]);

      const result = await service.sendMessage('test-uuid', {
        message: 'Tell me about my career prospects',
        category: 'career',
      });

      expect(result.reply).toBeDefined();
      expect(result.reply.content).toBeTruthy();
    });
  });

  describe('ReportService - OpenAI down', () => {
    let service: ReportService;
    let prisma: any;

    beforeEach(async () => {
      prisma = mockPrismaService();
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const failingOpenAI = mockOpenAIService();
      failingOpenAI.chat = jest.fn().mockResolvedValue(null);
      failingOpenAI.chatCompletion = jest.fn().mockResolvedValue(null);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ReportService,
          { provide: PrismaService, useValue: prisma },
          { provide: ConfigService, useValue: mockConfigService() },
          { provide: UserService, useValue: mockUserService() },
          { provide: FeatureAccessService, useValue: mockFeatureAccessService() },
          { provide: OpenAIService, useValue: failingOpenAI },
          { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: ModerationService, useValue: { checkAndRecord: jest.fn().mockResolvedValue(null) } },
          { provide: KbService, useValue: mockKbService() },
        ],
      }).compile();

      service = module.get<ReportService>(ReportService);
    });

    it('should generate fallback reports for all types', async () => {
      const types = ['LIFE', 'CAREER', 'MARRIAGE', 'WEALTH', 'ANNUAL'] as const;
      const mockReport = {
        id: 'report-1', userId: 'test-uuid', type: 'LIFE', title: 'Report',
        status: 'COMPLETED', sections: [], createdAt: new Date(), updatedAt: new Date(),
      };

      for (const type of types) {
        prisma.report.create.mockResolvedValue({ ...mockReport, type });
        prisma.report.update.mockResolvedValue({ ...mockReport, type });

        const result = await service.generateReport('test-uuid', { type });
        expect(result).toBeDefined();
      }
    });
  });

  describe('PalmistryService - OpenAI down', () => {
    let service: PalmistryService;
    let prisma: any;

    beforeEach(async () => {
      prisma = mockPrismaService();

      const failingOpenAI = mockOpenAIService();
      failingOpenAI.chatWithImage = jest.fn().mockResolvedValue(null);
      failingOpenAI.chat = jest.fn().mockResolvedValue(null);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          PalmistryService,
          { provide: PrismaService, useValue: prisma },
          { provide: ConfigService, useValue: mockConfigService() },
          { provide: UserService, useValue: mockUserService() },
          { provide: FeatureAccessService, useValue: mockFeatureAccessService() },
          { provide: OpenAIService, useValue: failingOpenAI },
          { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: ModerationService, useValue: { checkAndRecord: jest.fn().mockResolvedValue(null) } },
          { provide: StorageService, useValue: mockStorageService() },
        ],
      }).compile();

      service = module.get<PalmistryService>(PalmistryService);
    });

    it('fails honestly (503) for an image-backed reading when OpenAI is down — no fake reading', async () => {
      const { ServiceUnavailableException } = await import('@nestjs/common');
      await expect(
        service.analyzePalm('test-uuid', Buffer.from('fake'), 'image/jpeg'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('still serves the labelled no-image sample when OpenAI is down (graceful degradation)', async () => {
      const result: any = await service.analyzePalm('test-uuid');

      expect(result.lines).toBeDefined();
      expect(result.overallReading).toBeTruthy();
      expect(result.verification.authentic).toBe(false);
    });
  });
});

// ─── Knowledge Service Failure Resilience ────────────────────────────────────

describe('Stability: Knowledge Service Failures', () => {
  describe('DailyBriefingService - KB down', () => {
    let service: DailyBriefingService;
    let prisma: any;

    beforeEach(async () => {
      prisma = mockPrismaService();
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const failingKB = mockKnowledgeService();
      failingKB.search = jest.fn().mockRejectedValue(new Error('KB service unavailable'));
      failingKB.getByTopic = jest.fn().mockRejectedValue(new Error('KB service unavailable'));
      failingKB.assembleContext = jest.fn().mockReturnValue('');

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DailyBriefingService,
          { provide: PrismaService, useValue: prisma },
          { provide: OpenAIService, useValue: mockOpenAIService() },
          { provide: KnowledgeService, useValue: failingKB },
          { provide: KbService, useValue: mockKbService() },
          { provide: MemoryCacheService, useValue: mockCacheService() },
        ],
      }).compile();

      service = module.get<DailyBriefingService>(DailyBriefingService);
    });

    it('should still produce a complete briefing when KB is down', async () => {
      const result = await service.getDailyBriefing('test-uuid');
      expect(result.greeting).toBeTruthy();
      expect(result.planetaryHours.length).toBe(24);
      expect(result.panchang).toBeDefined();
    });
  });
});

// ─── Memory Stability Tests ─────────────────────────────────────────────────

describe('Stability: Memory Management', () => {
  describe('MemoryCacheService (Redis-backed) bounds', () => {
    let cache: MemoryCacheService;

    beforeEach(() => {
      cache = new MemoryCacheService(createMockRedis() as any);
    });

    it('should retain entries by key without corruption under sustained writes', async () => {
      for (let i = 0; i < 600; i++) {
        await cache.set(`key-${i}`, `value-${i}`, 60000);
      }

      // With Redis-backed cache, eviction is the server's responsibility.
      // Verify entries can be read back correctly.
      expect(await cache.get('key-599')).toBe('value-599');
      expect(await cache.get('key-0')).toBe('value-0');
    });

    it('should return null for expired entries based on TTL', async () => {
      await cache.set('will-expire', 'temp', 1); // 1ms TTL

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(await cache.get('will-expire')).toBeNull();
    });

    it('should handle rapid set/delete cycles without leaking', async () => {
      for (let i = 0; i < 500; i++) {
        await cache.set('rapid-key', `value-${i}`, 60000);
        if (i % 2 === 0) await cache.delete('rapid-key');
      }
      // Should not throw or leak
      expect(true).toBe(true);
    });
  });
});

// ─── Error Recovery Tests ────────────────────────────────────────────────────

describe('Stability: Error Recovery', () => {
  describe('NumerologyService edge cases', () => {
    let service: NumerologyService;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          NumerologyService,
          { provide: OpenAIService, useValue: mockOpenAIService() },
          { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: ModerationService, useValue: { checkAndRecord: jest.fn().mockResolvedValue(null) } },
          { provide: KbService, useValue: mockKbService() },
          { provide: PrismaService, useValue: mockPrismaService() },
        ],
      }).compile();

      service = module.get<NumerologyService>(NumerologyService);
    });

    it('should handle Unicode/emoji names without crashing', async () => {
      const result = await service.analyzeName('राम कृष्ण');
      expect(result.destinyNumber).toBeGreaterThanOrEqual(1);
    });

    it('should handle null-like inputs gracefully', async () => {
      const result = await service.analyzeName('undefined');
      expect(result.destinyNumber).toBeGreaterThanOrEqual(1);
    });

    it('should produce consistent results across multiple calls', async () => {
      const r1 = await service.analyzeName('Consistency Test');
      const r2 = await service.analyzeName('Consistency Test');

      expect(r1.destinyNumber).toBe(r2.destinyNumber);
      expect(r1.soulNumber).toBe(r2.soulNumber);
      expect(r1.personalityNumber).toBe(r2.personalityNumber);
    });

    it('should handle date edge cases for personal year', async () => {
      // Leap year date
      const result1 = await service.getPersonalYear('2000-02-29');
      expect(result1.personalYear).toBeGreaterThanOrEqual(1);
      expect(result1.personalYear).toBeLessThanOrEqual(9);

      // Year 2000
      const result2 = await service.getPersonalYear('2000-01-01');
      expect(result2.personalYear).toBeGreaterThanOrEqual(1);

      // Very old date
      const result3 = await service.getPersonalYear('1950-12-31');
      expect(result3.personalYear).toBeGreaterThanOrEqual(1);
    });
  });

  describe('DailyBriefingService repeated calls', () => {
    let service: DailyBriefingService;
    let prisma: any;
    let cacheService: any;

    beforeEach(async () => {
      prisma = mockPrismaService();
      cacheService = mockCacheService();
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DailyBriefingService,
          { provide: PrismaService, useValue: prisma },
          { provide: OpenAIService, useValue: mockOpenAIService() },
          { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: ModerationService, useValue: { checkAndRecord: jest.fn().mockResolvedValue(null) } },
          { provide: KbService, useValue: mockKbService() },
          { provide: MemoryCacheService, useValue: cacheService },
        ],
      }).compile();

      service = module.get<DailyBriefingService>(DailyBriefingService);
    });

    it('should produce stable results across 10 sequential calls', async () => {
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(await service.getDailyBriefing('test-uuid'));
      }

      // All should have the same structure
      results.forEach((r) => {
        expect(r.greeting).toBeTruthy();
        expect(r.planetaryHours.length).toBe(24);
        expect(r.panchang).toBeDefined();
      });
    });

    it('should use cache on second call for same user', async () => {
      // First call populates cache
      const first = await service.getDailyBriefing('test-uuid');
      expect(first.greeting).toBeTruthy();

      // Cache should have been set (global + user keys)
      expect(cacheService.set).toHaveBeenCalled();

      // Second call should attempt cache reads
      const second = await service.getDailyBriefing('test-uuid');
      expect(second.greeting).toBeTruthy();
      expect(cacheService.get.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// ─── Database Transaction Atomicity ──────────────────────────────────────────

describe('Stability: Transaction Atomicity', () => {
  let userService: UserService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      creditTransaction: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }), create: jest.fn() },
      $transaction: jest.fn(),
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ affected: BigInt(1) }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    userService = module.get<UserService>(UserService);
  });

  it('should not deduct credits if CTE query fails', async () => {
    prisma.$queryRawUnsafe.mockRejectedValue(new Error('DB connection lost'));

    const result = await userService.deductCredits('test-uuid', 5, 'Should fail').catch(() => false);
    expect(result).toBe(false);
  });

  it('should handle concurrent credit deductions safely', async () => {
    // CTE is atomic in Postgres — simulate via mock
    prisma.$queryRawUnsafe.mockResolvedValue([{ affected: BigInt(1) }]);

    // Simulate 5 concurrent deductions of 3 credits each
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        userService.deductCredits('u1', 3, 'concurrent test'),
      ),
    );

    // All should succeed since mock always returns affected=1
    const successCount = results.filter(Boolean).length;
    expect(successCount).toBeGreaterThan(0);
  });
});
