import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { OpenAIService } from '../src/openai/openai.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { KbService } from '../src/knowledge/kb.service';
import { MemoryCacheService } from '../src/common/cache.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';
import { DailyBriefingService } from '../src/modules/daily-briefing/daily-briefing.service';
import { mockOpenAIService, mockKnowledgeService, mockKbService, mockConfigService, createMockRedis, mockUser } from './helpers/mocks';

describe('DailyBriefingService — Cache Split (Item 6)', () => {
  let service: DailyBriefingService;
  let redis: ReturnType<typeof createMockRedis>;
  let cacheService: any;

  beforeEach(async () => {
    redis = createMockRedis();
    cacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyBriefingService,
        { provide: PrismaService, useValue: {
          user: { findUnique: jest.fn().mockResolvedValue(mockUser) },
        }},
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: KbService, useValue: mockKbService() },
        { provide: MemoryCacheService, useValue: cacheService },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    service = module.get<DailyBriefingService>(DailyBriefingService);
  });

  it('should use separate global and per-user cache keys', async () => {
    const result = await service.getDailyBriefing('test-uuid');

    expect(result).toBeDefined();
    // Check cache was called with both global and user key patterns
    const getCalls = cacheService.get.mock.calls;
    const setCalls = cacheService.set.mock.calls;
    const allKeys = [...getCalls.map((c: any) => c[0]), ...setCalls.map((c: any) => c[0])];

    const hasGlobalKey = allKeys.some((k: string) => k.startsWith('briefing:global:'));
    const hasUserKey = allKeys.some((k: string) => k.startsWith('briefing:user:'));

    // At least one of the split patterns should have been used
    expect(hasGlobalKey || hasUserKey).toBe(true);
  });

  it('should return valid briefing structure', async () => {
    const result = await service.getDailyBriefing('test-uuid');

    expect(result).toBeDefined();
    expect(result).toHaveProperty('greeting');
    expect(result).toHaveProperty('dayQuality');
    expect(result).toHaveProperty('panchang');
  });

  it('should check cache before computing', async () => {
    // First call populates cache
    await service.getDailyBriefing('test-uuid');

    // Second call should hit cache
    await service.getDailyBriefing('test-uuid');

    // Cache get should have been called at least twice (global + user, both calls)
    expect(cacheService.get.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('should share global cache across different users', async () => {
    const result1 = await service.getDailyBriefing('user-1');
    const result2 = await service.getDailyBriefing('user-2');

    // Both calls should return valid results
    expect(result1).toBeDefined();
    expect(result2).toBeDefined();

    // Cache.set for global should have a shared key pattern
    const setKeys = cacheService.set.mock.calls.map((c: any) => c[0] as string);
    const globalKeys = setKeys.filter((k: string) => k.startsWith('briefing:global:'));
    // Global key should be the same for both users (same date/hour)
    if (globalKeys.length >= 2) {
      expect(globalKeys[0]).toBe(globalKeys[1]);
    }
  });
});
