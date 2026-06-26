import { Test, TestingModule } from '@nestjs/testing';
import { InterpretationService } from '../src/modules/interpretation/interpretation.service';
import { LlmCacheService } from '../src/llm/llm-cache.service';
import { KbService } from '../src/knowledge/kb.service';

describe('InterpretationService', () => {
  let service: InterpretationService;
  let cache: { cachedChatCompletion: jest.Mock };
  let kb: { getDashaImpact: jest.Mock; renderStatus: jest.Mock };

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
    // Default: KB has no row → every domain falls through to the LLM path, so
    // the existing LLM-path expectations below are unaffected.
    kb = { getDashaImpact: jest.fn().mockResolvedValue(null), renderStatus: jest.fn().mockReturnValue(null) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterpretationService,
        { provide: LlmCacheService, useValue: cache },
        { provide: KbService, useValue: kb },
      ],
    }).compile();
    service = module.get<InterpretationService>(InterpretationService);
  });

  // ─── KB-first placement library (no LLM, locale-gated) ─────────────────────
  it('assembles a dasha interpretation from the KB without calling the LLM', async () => {
    kb.getDashaImpact.mockResolvedValue({ key: 'Jupiter', tradition: null, i18n: {} });
    kb.renderStatus.mockReturnValue({
      matched: true,
      value: {
        summary: 'Your Jupiter period favours growth and good fortune.',
        points: ['Doors open in finances and learning', 'Wisdom and mentorship deepen'],
        guidance: 'Say yes to growth.',
      },
    });
    const res = await service.interpret({ domain: 'dasha', payload: { currentMahadasha: 'Jupiter' }, locale: 'en' });
    expect(kb.getDashaImpact).toHaveBeenCalledWith('Jupiter');
    expect(res.summary).toContain('growth');
    expect(res.points).toHaveLength(2);
    expect(res.disclaimer).toBeTruthy();
    expect(cache.cachedChatCompletion).not.toHaveBeenCalled();
  });

  it('falls through to the LLM for a locale the KB has not been translated to yet', async () => {
    // renderStatus reports matched=false when the locale falls back to English,
    // so the localized LLM path runs instead of leaking English.
    kb.getDashaImpact.mockResolvedValue({ key: 'Jupiter', tradition: null, i18n: {} });
    kb.renderStatus.mockReturnValue({ matched: false, value: { summary: 's', points: ['p'], guidance: 'g' } });
    cache.cachedChatCompletion.mockResolvedValue({ summary: 'llm', points: ['a'], guidance: 'g' });
    const res = await service.interpret({ domain: 'dasha', payload: { currentMahadasha: 'Jupiter' }, locale: 'ta' });
    expect(cache.cachedChatCompletion).toHaveBeenCalled();
    expect(res.summary).toBe('llm');
  });

  it('falls through to the LLM for dasha when no current mahadasha is supplied', async () => {
    cache.cachedChatCompletion.mockResolvedValue({ summary: 'llm', points: ['a'], guidance: 'g' });
    const res = await service.interpret({ domain: 'dasha', payload: {} });
    expect(kb.getDashaImpact).not.toHaveBeenCalled();
    expect(cache.cachedChatCompletion).toHaveBeenCalled();
    expect(res.summary).toBe('llm');
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
