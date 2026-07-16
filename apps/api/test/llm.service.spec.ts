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

    it('fails over to Anthropic when the OpenAI stream errors on the first chunk', async () => {
      // A bare async* never throws synchronously, so the only realistic OpenAI
      // failure is the generator rejecting on first pull. Priming makes this
      // reachable; previously failover here was dead code.
      openaiProvider.chatCompletionStream.mockReturnValue(
        (async function* () {
          throw new Error('connection reset');
          // eslint-disable-next-line no-unreachable
          yield '';
        })(),
      );

      const stream = await service.chatCompletionStream({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(stream).toBeTruthy();
      const chunks: string[] = [];
      for await (const chunk of stream!) chunks.push(chunk);
      expect(chunks).toEqual(['a-chunk1', 'a-chunk2']);
    });

    it('records one llm_usage row after a streamed completion', async () => {
      const stream = await service.chatCompletionStream({
        messages: [{ role: 'user', content: 'Hello' }],
        userId: 'u1',
        feature: 'chat:stream',
      });
      // Drain — usage is recorded in the generator's finally block.
      for await (const _chunk of stream!) { /* consume */ }
      expect(prisma.llmUsage.create).toHaveBeenCalled();
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

/**
 * Admin LLM routing — the settings the LLM tab writes must actually route
 * requests. Each control below was previously write-only (audit findings:
 * dead default-provider dropdown, write-only Anthropic/Gemini keys, decorative
 * temperature, unconsumed per-feature overrides).
 */
describe('LlmService (admin routing settings)', () => {
  let service: LlmService;
  let openaiProvider: any;
  let anthropicProvider: any;
  let geminiProvider: any;
  let prisma: any;

  const okResult = (provider: string) => ({
    content: `${provider} response`,
    provider,
    model: 'm',
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  });

  function makeProvider(name: string) {
    return {
      isAvailable: jest.fn().mockReturnValue(true),
      chatCompletion: jest.fn().mockResolvedValue(okResult(name)),
      chatCompletionStream: jest.fn().mockReturnValue((async function* () { yield `${name}-chunk`; })()),
      reinitialize: jest.fn(),
    };
  }

  async function boot(settings: Record<string, string>) {
    openaiProvider = makeProvider('openai');
    anthropicProvider = makeProvider('anthropic');
    geminiProvider = makeProvider('gemini');
    prisma = {
      siteSetting: {
        findMany: jest
          .fn()
          .mockResolvedValue(Object.entries(settings).map(([key, value]) => ({ key, value }))),
      },
      llmUsage: { create: jest.fn().mockResolvedValue({}) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmService,
        { provide: OpenAIProvider, useValue: openaiProvider },
        { provide: AnthropicProvider, useValue: anthropicProvider },
        { provide: GeminiProvider, useValue: geminiProvider },
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: any) => {
              const cfg: Record<string, any> = {
                'openai.apiKey': 'env-openai-key',
                'openai.model': 'gpt-4o-mini',
                'anthropic.apiKey': 'env-anthropic-key',
                'gemini.apiKey': 'env-gemini-key',
                'llm.failoverEnabled': 'true',
              };
              return cfg[key] ?? def;
            }),
          },
        },
      ],
    }).compile();
    service = module.get<LlmService>(LlmService);
    return service;
  }

  it('llm.default.provider makes that provider the PRIMARY, not just a label', async () => {
    await boot({ 'llm.default.provider': 'anthropic' });

    const result = await service.chatCompletion({ messages: [{ role: 'user', content: 'hi' }] });

    expect(result).toBe('anthropic response');
    expect(anthropicProvider.chatCompletion).toHaveBeenCalledTimes(1);
    expect(openaiProvider.chatCompletion).not.toHaveBeenCalled();
  });

  it('an unknown default provider falls back to openai', async () => {
    await boot({ 'llm.default.provider': 'mistral' });

    await service.chatCompletion({ messages: [{ role: 'user', content: 'hi' }] });

    expect(openaiProvider.chatCompletion).toHaveBeenCalled();
  });

  it('failover still runs when the chosen primary errors', async () => {
    await boot({ 'llm.default.provider': 'anthropic' });
    anthropicProvider.chatCompletion.mockRejectedValue(new Error('down'));

    const result = await service.chatCompletion({ messages: [{ role: 'user', content: 'hi' }] });

    expect(result).toBe('openai response');
  });

  it('llm.feature.{root}.provider routes ONLY that feature (matched on the tag root)', async () => {
    await boot({ 'llm.feature.report.provider': 'gemini' });

    await service.chatCompletion({ messages: [{ role: 'user', content: 'hi' }], feature: 'report:life' });
    expect(geminiProvider.chatCompletion).toHaveBeenCalledTimes(1);
    expect(openaiProvider.chatCompletion).not.toHaveBeenCalled();

    await service.chatCompletion({ messages: [{ role: 'user', content: 'hi' }], feature: 'chat:career' });
    expect(openaiProvider.chatCompletion).toHaveBeenCalledTimes(1);
  });

  it('llm.feature.{root}.model and .max_tokens override the call options', async () => {
    await boot({
      'llm.feature.chat.model': 'gpt-4o',
      'llm.feature.chat.max_tokens': '512',
    });

    await service.chatCompletion({
      messages: [{ role: 'user', content: 'hi' }],
      feature: 'chat:general',
      model: 'gpt-4o-mini',
      maxTokens: 2000,
    });

    expect(openaiProvider.chatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o', maxTokens: 512 }),
    );
  });

  it('llm.default.temperature applies when the caller sets none — caller value wins otherwise', async () => {
    await boot({ 'llm.default.temperature': '0.3' });

    await service.chatCompletion({ messages: [{ role: 'user', content: 'hi' }] });
    expect(openaiProvider.chatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0.3 }),
    );

    await service.chatCompletion({ messages: [{ role: 'user', content: 'hi' }], temperature: 0.9 });
    expect(openaiProvider.chatCompletion).toHaveBeenLastCalledWith(
      expect.objectContaining({ temperature: 0.9 }),
    );
  });

  it('rotated Anthropic/Gemini keys reach their clients (reinitialize)', async () => {
    await boot({
      'llm.anthropic.key': 'rotated-anthropic-key',
      'llm.gemini.key': 'rotated-gemini-key',
    });

    await service.invalidateCache();

    expect(anthropicProvider.reinitialize).toHaveBeenCalledWith('rotated-anthropic-key');
    expect(geminiProvider.reinitialize).toHaveBeenCalledWith('rotated-gemini-key');
  });

  it('legacy llm.google.* keys still control Gemini (old LlmTab wrote "google")', async () => {
    await boot({
      'llm.google.key': 'legacy-google-key',
      'llm.google.enabled': 'false',
    });

    await service.invalidateCache();
    expect(geminiProvider.reinitialize).toHaveBeenCalledWith('legacy-google-key');

    // Disabled via the legacy flag: openai down must NOT fail over to gemini.
    openaiProvider.chatCompletion.mockRejectedValue(new Error('down'));
    await service.chatCompletion({ messages: [{ role: 'user', content: 'hi' }] });
    expect(geminiProvider.chatCompletion).not.toHaveBeenCalled();
  });

  it('streamed requests honour the same routing (default provider first)', async () => {
    await boot({ 'llm.default.provider': 'gemini' });

    const stream = await service.chatCompletionStream({ messages: [{ role: 'user', content: 'hi' }] });
    const chunks: string[] = [];
    for await (const chunk of stream!) chunks.push(chunk);

    expect(chunks).toEqual(['gemini-chunk']);
    expect(openaiProvider.chatCompletionStream).not.toHaveBeenCalled();
  });
});
