import { Test, TestingModule } from '@nestjs/testing';
import { NumerologyService } from '../src/modules/numerology/numerology.service';
import { DailyBriefingService } from '../src/modules/daily-briefing/daily-briefing.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { KbService } from '../src/knowledge/kb.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { OpenAIService } from '../src/openai/openai.service';
import { MemoryCacheService } from '../src/common/cache.service';
import { VectorSearchService } from '../src/knowledge/vector-search.service';
import { EmbeddingService } from '../src/ai/embeddings/embedding-service';
import { mockOpenAIService, mockKnowledgeService, mockKbService, mockPrismaService, mockCacheService, mockUser, createMockRedis, mockVectorSearchService, mockEmbeddingService } from './helpers/mocks';

// ─── Response Time Benchmarks ────────────────────────────────────────────────

describe('Performance: Response Time Benchmarks', () => {
  let numerologyService: NumerologyService;
  let dailyBriefingService: DailyBriefingService;
  let prisma: any;
  let cacheService: any;

  beforeEach(async () => {
    prisma = mockPrismaService();
    cacheService = mockCacheService();
    prisma.user.findUnique.mockResolvedValue(mockUser);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NumerologyService,
        DailyBriefingService,
        { provide: PrismaService, useValue: prisma },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: KbService, useValue: mockKbService() },
        { provide: MemoryCacheService, useValue: cacheService },
      ],
    }).compile();

    numerologyService = module.get<NumerologyService>(NumerologyService);
    dailyBriefingService = module.get<DailyBriefingService>(DailyBriefingService);
  });

  describe('numerology calculations', () => {
    it('should compute name analysis under 50ms', async () => {
      const start = performance.now();
      await numerologyService.analyzeName('Ramakrishna Paramahansa');
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50);
    });

    it('should compute brand analysis under 50ms', async () => {
      const start = performance.now();
      await numerologyService.analyzeBrand('TechNova Solutions');
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50);
    });

    it('should compute personal year under 50ms', async () => {
      const start = performance.now();
      await numerologyService.getPersonalYear('1990-05-15');
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50);
    });

    it('should batch-process 100 name analyses under 500ms', async () => {
      const names = Array.from({ length: 100 }, (_, i) => `TestName${i}`);
      const start = performance.now();

      await Promise.all(names.map((name) => numerologyService.analyzeName(name)));

      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500);
    });
  });

  describe('daily briefing calculations', () => {
    it('should generate full briefing under 100ms (with mocked deps)', async () => {
      const start = performance.now();
      await dailyBriefingService.getDailyBriefing('test-uuid');
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(100);
    });

    it('should compute planetary hours under 20ms', async () => {
      const start = performance.now();
      await dailyBriefingService.getPlanetaryHoursOnly();
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(20);
    });
  });
});

// ─── Cache Performance Tests ─────────────────────────────────────────────────

describe('Performance: Cache', () => {
  let cache: MemoryCacheService;

  beforeEach(() => {
    cache = new MemoryCacheService(createMockRedis() as any);
  });

  it('should handle 500 sequential writes under 500ms', async () => {
    const start = performance.now();

    for (let i = 0; i < 500; i++) {
      await cache.set(`key-${i}`, { data: `value-${i}` }, 60000);
    }

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  it('should handle 500 sequential reads under 500ms', async () => {
    for (let i = 0; i < 500; i++) {
      await cache.set(`key-${i}`, { data: `value-${i}` }, 60000);
    }

    const start = performance.now();

    for (let i = 0; i < 500; i++) {
      await cache.get(`key-${i}`);
    }

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  it('should return null for expired entries', async () => {
    await cache.set('expired', 'value', 1); // 1ms TTL

    // Wait for expiry
    await new Promise((resolve) => setTimeout(resolve, 10));

    const result = await cache.get('expired');
    expect(result).toBeNull();
  });

  it('should maintain performance under large number of entries', async () => {
    // Redis doesn't have a hard entry cap — just verify we can handle many entries
    for (let i = 0; i < 500; i++) {
      await cache.set(`fill-${i}`, `val-${i}`, 60000);
    }

    const start = performance.now();

    for (let i = 0; i < 100; i++) {
      await cache.set(`new-${i}`, `new-val-${i}`, 60000);
    }

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });
});

// ─── Concurrent Request Simulation ──────────────────────────────────────────

describe('Performance: Concurrent Requests', () => {
  let numerologyService: NumerologyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NumerologyService,
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: KbService, useValue: mockKbService() },
      ],
    }).compile();

    numerologyService = module.get<NumerologyService>(NumerologyService);
  });

  it('should handle 50 concurrent name analyses', async () => {
    const requests = Array.from({ length: 50 }, (_, i) =>
      numerologyService.analyzeName(`ConcurrentUser${i}`),
    );

    const start = performance.now();
    const results = await Promise.all(requests);
    const elapsed = performance.now() - start;

    expect(results.length).toBe(50);
    results.forEach((r) => {
      expect(r.destinyNumber).toBeGreaterThanOrEqual(1);
      expect(r.destinyNumber).toBeLessThanOrEqual(9);
    });
    expect(elapsed).toBeLessThan(500);
  });

  it('should handle 50 concurrent brand analyses', async () => {
    const brands = Array.from({ length: 50 }, (_, i) => `Brand${i}Corp`);
    const requests = brands.map((b) => numerologyService.analyzeBrand(b));

    const start = performance.now();
    const results = await Promise.all(requests);
    const elapsed = performance.now() - start;

    expect(results.length).toBe(50);
    results.forEach((r) => {
      expect(r.overallScore).toBeGreaterThanOrEqual(1);
      expect(r.overallScore).toBeLessThanOrEqual(10);
    });
    expect(elapsed).toBeLessThan(500);
  });

  it('should handle mixed concurrent operations', async () => {
    const requests = [
      ...Array.from({ length: 20 }, (_, i) => numerologyService.analyzeName(`Name${i}`)),
      ...Array.from({ length: 20 }, (_, i) => numerologyService.analyzeBrand(`Brand${i}`)),
      ...Array.from({ length: 10 }, () => numerologyService.getPersonalYear('1990-05-15')),
    ];

    const start = performance.now();
    const results = await Promise.all(requests);
    const elapsed = performance.now() - start;

    expect(results.length).toBe(50);
    expect(elapsed).toBeLessThan(500);
  });
});

// ─── Knowledge Service Performance ──────────────────────────────────────────

describe('Performance: Knowledge Service', () => {
  let knowledgeService: KnowledgeService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      knowledgeDocument: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 50 }),
        count: jest.fn().mockResolvedValue(1000),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeService,
        { provide: PrismaService, useValue: prisma },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: VectorSearchService, useValue: mockVectorSearchService() },
        { provide: EmbeddingService, useValue: mockEmbeddingService() },
      ],
    }).compile();

    knowledgeService = module.get<KnowledgeService>(KnowledgeService);
  });

  it('should handle 100 sequential searches under 200ms', async () => {
    const start = performance.now();

    for (let i = 0; i < 100; i++) {
      await knowledgeService.search(`query term ${i}`);
    }

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(200);
  });

  it('should handle assembleContext with large result sets efficiently', () => {
    const largeResults = Array.from({ length: 100 }, (_, i) => ({
      id: `doc-${i}`,
      text: `This is document ${i} with substantial content about Vedic astrology and planetary influences. `.repeat(5),
      category: 'test',
      topic: null,
      source: i % 2 === 0 ? 'BPHS' : 'Jyotish',
      score: Math.random(),
    }));

    const start = performance.now();
    const context = knowledgeService.assembleContext(largeResults);
    const elapsed = performance.now() - start;

    expect(context.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(10);
  });

  it('should batch-add documents efficiently', async () => {
    const documents = Array.from({ length: 200 }, (_, i) => ({
      text: `Bulk document ${i}`,
      category: 'test',
      topic: 'bulk_test',
      source: 'test',
    }));

    const start = performance.now();
    await knowledgeService.addDocuments(documents);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
    // Should batch into 4 calls (200 / 50)
    expect(prisma.knowledgeDocument.createMany).toHaveBeenCalledTimes(4);
  });
});
