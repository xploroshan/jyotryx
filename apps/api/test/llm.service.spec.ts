import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LlmService } from '../src/llm/llm.service';
import { OpenAIProvider } from '../src/llm/providers/openai.provider';
import { AnthropicProvider } from '../src/llm/providers/anthropic.provider';
import { GeminiProvider } from '../src/llm/providers/gemini.provider';
import { PrismaService } from '../src/prisma/prisma.service';

describe('LlmService (Item 4 — Circuit Breaker + Failover)', () => {
  let service: LlmService;
  let openaiProvider: any;
  let anthropicProvider: any;
  let prisma: any;

  beforeEach(async () => {
    openaiProvider = {
      isAvailable: jest.fn().mockReturnValue(true),
      chatCompletion: jest.fn().mockResolvedValue({ content: 'OpenAI response', model: 'gpt-4o', usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } }),
      chatCompletionStream: jest.fn().mockReturnValue((async function* () { yield 'chunk1'; yield 'chunk2'; })()),
      reinitialize: jest.fn(),
    };

    anthropicProvider = {
      isAvailable: jest.fn().mockReturnValue(true),
      chatCompletion: jest.fn().mockResolvedValue({ content: 'Anthropic response', model: 'claude-sonnet-4-6', usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 } }),
      chatCompletionStream: jest.fn().mockReturnValue((async function* () { yield 'a-chunk1'; yield 'a-chunk2'; })()),
    };

    prisma = {
      siteSetting: { findMany: jest.fn().mockResolvedValue([]) },
      llmUsage: { create: jest.fn().mockResolvedValue({}) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmService,
        { provide: OpenAIProvider, useValue: openaiProvider },
        { provide: AnthropicProvider, useValue: anthropicProvider },
        { provide: GeminiProvider, useValue: { isAvailable: jest.fn().mockReturnValue(false), chatCompletion: jest.fn().mockResolvedValue(null), chatCompletionStream: jest.fn().mockReturnValue(null), reinitialize: jest.fn() } },
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: any) => {
              const cfg: Record<string, any> = {
                'openai.apiKey': 'test-key',
                'openai.model': 'gpt-4o',
                'anthropic.apiKey': 'test-anthropic-key',
                'llm.failoverEnabled': true,
                'LLM_FAILOVER_ENABLED': 'true',
              };
              return cfg[key] ?? def;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<LlmService>(LlmService);
  });

  describe('chatCompletion', () => {
    it('should use OpenAI as primary provider', async () => {
      const result = await service.chatCompletion({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result).toBeTruthy();
      expect(openaiProvider.chatCompletion).toHaveBeenCalled();
    });

    it('should failover to Anthropic when OpenAI fails', async () => {
      openaiProvider.chatCompletion.mockRejectedValue(new Error('OpenAI down'));

      const result = await service.chatCompletion({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result).toBeTruthy();
      expect(anthropicProvider.chatCompletion).toHaveBeenCalled();
    });

    it('should return null when both providers fail', async () => {
      openaiProvider.chatCompletion.mockRejectedValue(new Error('OpenAI down'));
      anthropicProvider.chatCompletion.mockRejectedValue(new Error('Anthropic down'));

      const result = await service.chatCompletion({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result).toBeNull();
      // Both providers reject, so the service exhausts its retry/backoff
      // on each before failing over — that real-time delay can exceed
      // Jest's 5s default under full-suite load, so allow more headroom.
    }, 20000);

    it('should skip unavailable OpenAI provider', async () => {
      openaiProvider.isAvailable.mockReturnValue(false);

      const result = await service.chatCompletion({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result).toBeTruthy();
      expect(openaiProvider.chatCompletion).not.toHaveBeenCalled();
      expect(anthropicProvider.chatCompletion).toHaveBeenCalled();
    });
  });

  describe('chatCompletionStream', () => {
    it('should return an async iterable from OpenAI', async () => {
      const stream = await service.chatCompletionStream({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(stream).toBeTruthy();
      const chunks: string[] = [];
      for await (const chunk of stream!) {
        chunks.push(chunk);
      }
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should fallback to Anthropic stream when OpenAI stream fails', async () => {
      openaiProvider.chatCompletionStream.mockImplementation(() => { throw new Error('stream failed'); });

      const stream = await service.chatCompletionStream({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(stream).toBeTruthy();
    });

    it('should return null when no stream available', async () => {
      openaiProvider.isAvailable.mockReturnValue(false);
      anthropicProvider.isAvailable.mockReturnValue(false);

      const stream = await service.chatCompletionStream({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(stream).toBeNull();
    });
  });

  describe('getModel', () => {
    it('should return the configured default model', () => {
      expect(service.getModel()).toBeTruthy();
      expect(typeof service.getModel()).toBe('string');
    });
  });

  describe('computeCost', () => {
    it('should compute cost for known models', () => {
      const cost = service.computeCost('gpt-4o', 1000, 500);
      expect(cost).toBeGreaterThan(0);
      expect(typeof cost).toBe('number');
    });

    it('should return a number for any model', () => {
      const cost = service.computeCost('unknown-model', 1000, 500);
      expect(typeof cost).toBe('number');
      expect(cost).toBeGreaterThanOrEqual(0);
    });
  });
});
