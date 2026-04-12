/**
 * Performance Tests — Phase 1 Refactor
 *
 * Tests that key operations complete within acceptable time bounds
 * and that new architectural patterns don't introduce regressions.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserService } from '../src/modules/user/user.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { VectorSearchService } from '../src/knowledge/vector-search.service';
import { EmbeddingService } from '../src/ai/embeddings/embedding-service';
import { OpenAIService } from '../src/openai/openai.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';
import { getLocaleInstruction } from '../src/common/locale';
import { createMockRedis, mockOpenAIService, mockKnowledgeService, mockConfigService } from './helpers/mocks';

describe('Performance — Credit Deduction', () => {
  let service: UserService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn(), count: jest.fn().mockResolvedValue(0), findFirst: jest.fn() },
      creditTransaction: { create: jest.fn(), aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ affected: BigInt(1) }]),
      $transaction: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: REDIS_CLIENT, useValue: createMockRedis() },
      ],
    }).compile();

    service = module.get(UserService);
  });

  it('should complete 1000 credit deductions in < 500ms (mocked DB)', async () => {
    const start = performance.now();
    const promises = [];
    for (let i = 0; i < 1000; i++) {
      promises.push(service.deductCredits(`user-${i}`, 1, 'perf test'));
    }
    await Promise.all(promises);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
  });

  it('should only call $queryRawUnsafe once per deduction (not $transaction)', async () => {
    for (let i = 0; i < 10; i++) {
      await service.deductCredits(`user-${i}`, 1, 'test');
    }

    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(10);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('Performance — Knowledge Search', () => {
  let service: KnowledgeService;

  beforeEach(async () => {
    const vectorSearch = {
      searchByVector: jest.fn().mockResolvedValue([
        { id: 'v1', text: 'Result', category: 'planets', topic: null, source: null, score: 0.85 },
      ]),
    };
    const embeddingService = {
      generateEmbedding: jest.fn().mockResolvedValue(new Array(1536).fill(0.1)),
    };
    const prisma = {
      knowledgeDocument: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'new' }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(0),
      },
      $queryRawUnsafe: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        KnowledgeService,
        { provide: VectorSearchService, useValue: vectorSearch },
        { provide: EmbeddingService, useValue: embeddingService },
        { provide: PrismaService, useValue: prisma },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: ConfigService, useValue: mockConfigService() },
      ],
    }).compile();

    service = module.get(KnowledgeService);
  });

  it('should complete 100 hybrid searches in < 200ms (mocked)', async () => {
    const start = performance.now();
    const promises = [];
    for (let i = 0; i < 100; i++) {
      promises.push(service.search(`query ${i}`, 'planets', 5));
    }
    await Promise.all(promises);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(200);
  });
});

describe('Performance — Locale Instruction', () => {
  it('should generate locale instructions in < 1ms per call', () => {
    const locales = ['en', 'hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa', 'or', 'as'];
    const iterations = 10000;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      getLocaleInstruction(locales[i % locales.length]);
    }
    const elapsed = performance.now() - start;

    expect(elapsed / iterations).toBeLessThan(1);
  });
});

describe('Performance — Redis Cache', () => {
  it('should handle 1000 get/set operations in < 100ms (mocked)', async () => {
    const redis = createMockRedis();

    const start = performance.now();
    const promises = [];
    for (let i = 0; i < 500; i++) {
      promises.push(redis.set(`key-${i}`, `value-${i}`, 'EX', 3600));
    }
    for (let i = 0; i < 500; i++) {
      promises.push(redis.get(`key-${i}`));
    }
    await Promise.all(promises);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
  });
});

describe('Performance — Keyword Extraction', () => {
  it('should extract keywords from large text quickly', async () => {
    const prisma = {
      knowledgeDocument: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'new' }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        count: jest.fn().mockResolvedValue(0),
      },
      $queryRawUnsafe: jest.fn(),
    };
    const embeddingService = {
      generateEmbedding: jest.fn().mockResolvedValue(null),
    };

    const module = await Test.createTestingModule({
      providers: [
        KnowledgeService,
        { provide: VectorSearchService, useValue: { searchByVector: jest.fn().mockResolvedValue([]) } },
        { provide: EmbeddingService, useValue: embeddingService },
        { provide: PrismaService, useValue: prisma },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: ConfigService, useValue: mockConfigService() },
      ],
    }).compile();

    const svc = module.get(KnowledgeService);

    // Generate large text
    const largeText = Array(1000).fill('The planet Mars in Vedic astrology represents energy and courage').join('. ');

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      await svc.addDocument(largeText, 'planets', 'mars');
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
  });
});
