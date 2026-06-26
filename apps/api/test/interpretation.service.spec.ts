import { Test, TestingModule } from '@nestjs/testing';
import { InterpretationService } from '../src/modules/interpretation/interpretation.service';
import { LlmCacheService } from '../src/llm/llm-cache.service';

describe('InterpretationService', () => {
  let service: InterpretationService;
  let cache: { cachedChatCompletion: jest.Mock };

  const sysOf = () => {
    const arg = cache.cachedChatCompletion.mock.calls[0][0];
    return arg.messages.find((m: any) => m.role === 'system').content as string;
  };
  const userOf = () => {
    const arg = cache.cachedChatCompletion.mock.calls[0][0];
    return arg.messages.find((m: any) => m.role === 'user').content as string;
  };

  beforeEach(async () => {
    cache = { cachedChatCompletion: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterpretationService,
        { provide: LlmCacheService, useValue: cache },
      ],
    }).compile();
    service = module.get<InterpretationService>(InterpretationService);
  });

  // NOTE: with jsonMode the LLM layer (LlmService.processResult) returns the
  // ALREADY-PARSED object, or null — NOT a { content } wrapper. The mocks below
  // mirror that real contract.
  it('returns the parsed LLM object as an interpretation block', async () => {
    cache.cachedChatCompletion.mockResolvedValue({
      summary: 'You are steady and patient.',
      points: ['Patience is a strength', 'Lean into routine'],
      guidance: 'Take one small step today.',
    });
    const res = await service.interpret({ domain: 'kundli', payload: { asc: 'Leo' } });
    expect(res.summary).toBe('You are steady and patient.');
    expect(res.points).toHaveLength(2);
    expect(res.guidance).toContain('small step');
    expect(res.disclaimer).toBeTruthy();
  });

  it('uses the interpretation:<domain> cache feature key and JSON mode', async () => {
    cache.cachedChatCompletion.mockResolvedValue({ summary: 'x', points: ['a'], guidance: 'g' });
    await service.interpret({ domain: 'numerology', payload: {} });
    expect(cache.cachedChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ feature: 'interpretation:numerology', jsonMode: true }),
    );
  });

  it('applies the locale instruction for a non-English locale', async () => {
    cache.cachedChatCompletion.mockResolvedValue({ summary: 'x', points: ['a'], guidance: 'g' });
    await service.interpret({ domain: 'kundli', payload: {}, locale: 'hi' });
    expect(sysOf()).toContain('Hindi');
  });

  it('omits the locale instruction for English', async () => {
    cache.cachedChatCompletion.mockResolvedValue({ summary: 'x', points: ['a'], guidance: 'g' });
    await service.interpret({ domain: 'kundli', payload: {}, locale: 'en' });
    expect(sysOf()).not.toContain('You MUST respond entirely in');
  });

  it('falls back gracefully when the LLM returns null', async () => {
    cache.cachedChatCompletion.mockResolvedValue(null);
    const res = await service.interpret({ domain: 'dosha', payload: {} });
    expect(res.summary).toBeTruthy();
    expect(res.points.length).toBeGreaterThan(0);
    expect(res.disclaimer).toBeTruthy();
  });

  it('falls back when the LLM object is missing the expected fields', async () => {
    cache.cachedChatCompletion.mockResolvedValue({ foo: 'bar' });
    const res = await service.interpret({ domain: 'matching', payload: {} });
    expect(res.points.length).toBeGreaterThan(0);
  });

  it('does not throw if the cache/LLM layer throws', async () => {
    cache.cachedChatCompletion.mockRejectedValue(new Error('llm down'));
    const res = await service.interpret({ domain: 'palmistry', payload: {} });
    expect(res.summary).toBeTruthy();
  });

  it('caps the serialized payload to bound prompt size', async () => {
    cache.cachedChatCompletion.mockResolvedValue({ summary: 's', points: ['p'], guidance: 'g' });
    await service.interpret({ domain: 'kundli', payload: { blob: 'x'.repeat(20000) } });
    const user = userOf();
    expect(user).toContain('truncated');
    expect(user.length).toBeLessThan(8000);
  });
});
