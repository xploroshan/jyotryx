/**
 * Feature Correctness Validation — Phase 1 Refactor (all 8 items)
 *
 * Verifies the behavioral correctness of each architectural improvement.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserService } from '../src/modules/user/user.service';
import { OpenAIService } from '../src/openai/openai.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { LlmService } from '../src/llm/llm.service';
import { StorageService } from '../src/storage/storage.service';
import { VectorSearchService } from '../src/knowledge/vector-search.service';
import { EmbeddingService } from '../src/ai/embeddings/embedding-service';
import { ReportService } from '../src/modules/report/report.service';
import { ChatService } from '../src/modules/chat/chat.service';
import { PalmistryService } from '../src/modules/palmistry/palmistry.service';
import { getLocaleInstruction, isValidLocale } from '../src/common/locale';
import {
  mockOpenAIService, mockKnowledgeService, mockUserService,
  mockConfigService, mockUser, createMockRedis,
} from './helpers/mocks';
import { REDIS_CLIENT } from '../src/redis/redis.module';

describe('Feature Correctness — Item 7: Single-SQL Credits', () => {
  it('should atomically deduct credits and create transaction in one SQL', async () => {
    const prisma = {
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

    const svc = module.get<UserService>(UserService);

    // Verify atomicity: single SQL call, no $transaction
    const result = await svc.deductCredits('user-1', 2, 'Test');
    expect(result).toBe(true);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).not.toHaveBeenCalled();

    // Verify SQL contains both UPDATE and INSERT
    const sql = prisma.$queryRawUnsafe.mock.calls[0][0];
    expect(sql).toContain('UPDATE users');
    expect(sql).toContain('INSERT INTO credit_transactions');
    expect(sql).toContain('credits >= $1');
  });

  it('should prevent over-deduction (credits < amount)', async () => {
    const prisma = {
      user: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn(), count: jest.fn().mockResolvedValue(0), findFirst: jest.fn() },
      creditTransaction: { create: jest.fn(), aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }) },
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ affected: BigInt(0) }]),
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

    const svc = module.get<UserService>(UserService);
    const result = await svc.deductCredits('user-1', 999, 'Way too much');
    expect(result).toBe(false);
  });
});

describe('Feature Correctness — Item 4: Circuit Breaker + Failover', () => {
  it('should use Anthropic when OpenAI is unavailable', async () => {
    const openaiProvider = {
      isAvailable: jest.fn().mockReturnValue(false),
      chatCompletion: jest.fn(),
      chatCompletionStream: jest.fn(),
      reinitialize: jest.fn(),
    };

    const anthropicProvider = {
      isAvailable: jest.fn().mockReturnValue(true),
      chatCompletion: jest.fn().mockResolvedValue({
        content: 'Anthropic says hello',
        model: 'claude-sonnet-4-6',
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      }),
      chatCompletionStream: jest.fn(),
    };

    const { LlmService: LlmSvc } = await import('../src/llm/llm.service');
    const { OpenAIProvider } = await import('../src/llm/providers/openai.provider');
    const { AnthropicProvider } = await import('../src/llm/providers/anthropic.provider');

    const module = await Test.createTestingModule({
      providers: [
        LlmSvc,
        { provide: OpenAIProvider, useValue: openaiProvider },
        { provide: AnthropicProvider, useValue: anthropicProvider },
        { provide: PrismaService, useValue: { siteSetting: { findMany: jest.fn().mockResolvedValue([]) }, llmUsage: { create: jest.fn() } } },
        { provide: ConfigService, useValue: { get: jest.fn((k: string, d?: any) => {
          if (k === 'llm.failoverEnabled') return true;
          if (k === 'LLM_FAILOVER_ENABLED') return 'true';
          if (k === 'openai.model') return 'gpt-4o';
          return d;
        })}},
      ],
    }).compile();

    const svc = module.get(LlmSvc);
    const result = await svc.chatCompletion({ messages: [{ role: 'user', content: 'test' }] });

    expect(openaiProvider.chatCompletion).not.toHaveBeenCalled();
    expect(anthropicProvider.chatCompletion).toHaveBeenCalled();
    expect(result).toBeTruthy();
  });
});

describe('Feature Correctness — Item 1: S3/R2 Presigned URLs', () => {
  it('StorageService.isAvailable returns false when no R2 config', async () => {
    const module = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
      ],
    }).compile();

    const svc = module.get(StorageService);
    expect(svc.isAvailable()).toBe(false);
  });

  it('StorageService.isAvailable returns true when R2 configured', async () => {
    const module = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: ConfigService, useValue: { get: jest.fn((k: string) => {
          const cfg: Record<string, string> = {
            'r2.accountId': 'a', 'r2.accessKeyId': 'b',
            'r2.secretAccessKey': 'c', 'r2.bucketName': 'd',
          };
          return cfg[k];
        })}},
      ],
    }).compile();

    const svc = module.get(StorageService);
    expect(svc.isAvailable()).toBe(true);
  });
});

describe('Feature Correctness — Item 8: pgvector Hybrid Search', () => {
  it('should prefer vector results over keyword results', async () => {
    const vectorSearch = {
      searchByVector: jest.fn().mockResolvedValue([
        { id: 'vec-1', text: 'Semantic match', category: 'planets', topic: null, source: null, score: 0.92 },
      ]),
    };
    const embeddingService = {
      generateEmbedding: jest.fn().mockResolvedValue(new Array(1536).fill(0.1)),
    };
    const prisma = {
      knowledgeDocument: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'kw-1', text: 'Keyword match', category: 'planets', topic: null, source: null, keywords: ['mars'] },
        ]),
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

    const svc = module.get(KnowledgeService);
    const results = await svc.search('Mars in 7th house effects', 'planets', 5);

    // Vector result should come first
    expect(results[0].id).toBe('vec-1');
    expect(results[0].score).toBeGreaterThan(0.5);
  });
});

describe('Feature Correctness — Locale Utility', () => {
  it('should return empty string for English locale', () => {
    expect(getLocaleInstruction('en')).toBe('');
    expect(getLocaleInstruction(undefined)).toBe('');
  });

  it('should return Hindi instruction for hi locale', () => {
    const instruction = getLocaleInstruction('hi');
    expect(instruction).toContain('Hindi');
    expect(instruction).toContain('MUST respond');
  });

  it('should return Tamil instruction for ta locale', () => {
    const instruction = getLocaleInstruction('ta');
    expect(instruction).toContain('Tamil');
  });

  it('should return empty for unknown locale', () => {
    expect(getLocaleInstruction('xx')).toBe('');
  });

  it('should validate all supported locales', () => {
    const locales = ['en', 'hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa', 'or', 'as'];
    for (const locale of locales) {
      expect(isValidLocale(locale)).toBe(true);
    }
  });

  it('should return instructions for all 11 non-English locales', () => {
    const nonEnglish = ['hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa', 'or', 'as'];
    for (const locale of nonEnglish) {
      const instruction = getLocaleInstruction(locale);
      expect(instruction.length).toBeGreaterThan(0);
      expect(instruction).toContain('MUST respond');
    }
  });
});
