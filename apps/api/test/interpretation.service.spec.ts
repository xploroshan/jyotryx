import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InterpretationService } from '../src/modules/interpretation/interpretation.service';
import { LlmCacheService } from '../src/llm/llm-cache.service';
import { KbService } from '../src/knowledge/kb.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserService } from '../src/modules/user/user.service';
import { FeatureAccessService } from '../src/common/feature-access/feature-access.service';

describe('InterpretationService', () => {
  let service: InterpretationService;
  let cache: { cachedChatCompletion: jest.Mock };
  let kb: {
    getDashaImpact: jest.Mock;
    getMatchingTier: jest.Mock;
    getSignTrait: jest.Mock;
    getPlanetInHouse: jest.Mock;
    getNumberMeaning: jest.Mock;
    renderStatus: jest.Mock;
  };
  let prisma: { deepDiveUnlock: { findUnique: jest.Mock; create: jest.Mock } };
  let users: { deductCredits: jest.Mock };
  let featureAccess: { paidFeaturesFree: jest.Mock; isActiveSubscriber: jest.Mock };

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
    kb = {
      getDashaImpact: jest.fn().mockResolvedValue(null),
      getMatchingTier: jest.fn().mockResolvedValue(null),
      getSignTrait: jest.fn().mockResolvedValue(null),
      getPlanetInHouse: jest.fn().mockResolvedValue(null),
      getNumberMeaning: jest.fn().mockResolvedValue(null),
      renderStatus: jest.fn().mockReturnValue(null),
    };
    prisma = {
      deepDiveUnlock: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'u1' }),
      },
    };
    users = { deductCredits: jest.fn().mockResolvedValue(true) };
    featureAccess = {
      paidFeaturesFree: jest.fn().mockResolvedValue(false),
      isActiveSubscriber: jest.fn().mockResolvedValue(false),
    };
    const config = { get: jest.fn().mockReturnValue(3) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterpretationService,
        { provide: LlmCacheService, useValue: cache },
        { provide: KbService, useValue: kb },
        { provide: PrismaService, useValue: prisma },
        { provide: UserService, useValue: users },
        { provide: FeatureAccessService, useValue: featureAccess },
        { provide: ConfigService, useValue: config },
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

  it('assembles a matching interpretation from the KB tier without calling the LLM', async () => {
    kb.getMatchingTier.mockResolvedValue({ key: 'good', tradition: null, i18n: {} });
    kb.renderStatus.mockReturnValue({
      matched: true,
      value: { summary: 'A good, workable match.', points: ['Many indicators align'], guidance: 'Communicate openly.' },
    });
    const res = await service.interpret({ domain: 'matching', payload: { percentage: 60 }, locale: 'en' });
    expect(kb.getMatchingTier).toHaveBeenCalledWith('good'); // 60% → "good" band
    expect(res.summary).toContain('workable');
    expect(cache.cachedChatCompletion).not.toHaveBeenCalled();
  });

  it('maps matching score to the right tier and derives percentage from totalScore/maxScore', async () => {
    kb.getMatchingTier.mockResolvedValue({ key: 'excellent', tradition: null, i18n: {} });
    kb.renderStatus.mockReturnValue({ matched: true, value: { summary: 'Strong match.', points: ['Aligned'], guidance: 'Nurture it.' } });
    await service.interpret({ domain: 'matching', payload: { totalScore: 30, maxScore: 36 }, locale: 'en' });
    expect(kb.getMatchingTier).toHaveBeenCalledWith('excellent'); // 30/36 ≈ 83% → "excellent"
  });

  it('falls through to the LLM for matching when no score is supplied', async () => {
    cache.cachedChatCompletion.mockResolvedValue({ summary: 'llm', points: ['a'], guidance: 'g' });
    const res = await service.interpret({ domain: 'matching', payload: {} });
    expect(kb.getMatchingTier).not.toHaveBeenCalled();
    expect(cache.cachedChatCompletion).toHaveBeenCalled();
    expect(res.summary).toBe('llm');
  });

  it('assembles a kundli reading from the KB (ascendant + placements) without the LLM', async () => {
    kb.getSignTrait.mockResolvedValue({
      key: 'Leo',
      i18n: { en: { summary: 'With Leo rising, you are warm and confident.', guidance: 'Lead with heart.' } },
    });
    kb.getPlanetInHouse.mockImplementation((k: string) =>
      Promise.resolve({ key: k, i18n: { en: { text: `Insight for ${k}.` } } }),
    );
    // Echo each row's English payload as an exact-locale match.
    kb.renderStatus.mockImplementation((row: any) => (row ? { matched: true, value: row.i18n.en } : null));
    const res = await service.interpret({
      domain: 'kundli',
      locale: 'en',
      payload: { ascendant: 'Leo', planets: [{ planet: 'Sun', house: 1 }, { planet: 'Saturn', house: 7 }] },
    });
    expect(kb.getSignTrait).toHaveBeenCalledWith('Leo');
    expect(res.summary).toContain('Leo rising');
    expect(res.points.length).toBeGreaterThanOrEqual(2);
    expect(res.points.some((p) => p.includes('Sun:1'))).toBe(true);
    expect(res.guidance).toContain('heart');
    expect(cache.cachedChatCompletion).not.toHaveBeenCalled();
  });

  it('assembles a numerology interpretation from the KB without calling the LLM', async () => {
    kb.getNumberMeaning.mockResolvedValue({ key: '5', tradition: null, i18n: {} });
    kb.renderStatus.mockReturnValue({
      matched: true,
      value: { meaning: 'Number 5 is adventurous and versatile.', strengths: ['Adaptable', 'Quick-witted'], cautions: ['Avoid restlessness'] },
    });
    const res = await service.interpret({ domain: 'numerology', payload: { destinyNumber: 5 }, locale: 'en' });
    expect(kb.getNumberMeaning).toHaveBeenCalledWith('5');
    expect(res.summary).toContain('adventurous');
    expect(res.points).toContain('Adaptable');
    expect(res.guidance).toContain('restlessness');
    expect(cache.cachedChatCompletion).not.toHaveBeenCalled();
  });

  it('falls through to the LLM for kundli when the ascendant trait is not translated', async () => {
    kb.getSignTrait.mockResolvedValue({ key: 'Leo', i18n: { en: { summary: 's', guidance: 'g' } } });
    kb.renderStatus.mockReturnValue({ matched: false, value: { summary: 's', guidance: 'g' } });
    cache.cachedChatCompletion.mockResolvedValue({ summary: 'llm', points: ['a'], guidance: 'g' });
    const res = await service.interpret({
      domain: 'kundli',
      locale: 'ta',
      payload: { ascendant: 'Leo', planets: [{ planet: 'Sun', house: 1 }] },
    });
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

  // ─── Deep dive (paid, sectioned) ───────────────────────────────────────────
  const deepLlm = () =>
    cache.cachedChatCompletion.mockResolvedValue({
      summary: 'A rich, in-depth look at your chart.',
      sections: [
        { title: 'Personality & strengths', body: 'You lead with quiet steadiness and earn trust over time.' },
        { title: 'Career & purpose', body: 'Your path rewards patience and craft over flash.' },
      ],
      guidance: 'Lean into your steadiness and make room for rest.',
    });

  it('deep interpret produces sectioned output under the deep cache key', async () => {
    deepLlm();
    const res = await service.interpret({ domain: 'kundli', payload: { ascendant: 'Capricorn' }, depth: 'deep' });
    expect(res.depth).toBe('deep');
    expect(res.sections && res.sections.length).toBeGreaterThan(0);
    const feature = cache.cachedChatCompletion.mock.calls[0][0].feature;
    expect(feature).toBe('interpretation:deep:kundli');
  });

  it('deep dive charges credits once and records an unlock', async () => {
    deepLlm();
    const res = await service.generateDeepDive({ userId: 'user-1', domain: 'kundli', payload: { ascendant: 'Leo' } });
    expect(res.sections!.length).toBeGreaterThan(0);
    expect(users.deductCredits).toHaveBeenCalledTimes(1);
    expect(prisma.deepDiveUnlock.create).toHaveBeenCalledTimes(1);
  });

  it('deep dive is free (no charge) when the result is already unlocked', async () => {
    deepLlm();
    prisma.deepDiveUnlock.findUnique.mockResolvedValue({ id: 'existing' });
    await service.generateDeepDive({ userId: 'user-1', domain: 'kundli', payload: { ascendant: 'Leo' } });
    expect(users.deductCredits).not.toHaveBeenCalled();
    expect(prisma.deepDiveUnlock.create).not.toHaveBeenCalled();
  });

  it('deep dive is free for active subscribers but still records the unlock', async () => {
    deepLlm();
    featureAccess.isActiveSubscriber.mockResolvedValue(true);
    await service.generateDeepDive({ userId: 'user-1', domain: 'kundli', payload: { ascendant: 'Leo' } });
    expect(users.deductCredits).not.toHaveBeenCalled();
    expect(prisma.deepDiveUnlock.create).toHaveBeenCalledTimes(1);
  });

  it('deep dive throws 402 when the user cannot pay', async () => {
    deepLlm();
    users.deductCredits.mockResolvedValue(false);
    await expect(
      service.generateDeepDive({ userId: 'user-1', domain: 'kundli', payload: { ascendant: 'Leo' } }),
    ).rejects.toMatchObject({ status: 402 });
    expect(prisma.deepDiveUnlock.create).not.toHaveBeenCalled();
  });

  it('deep dive does not charge when the LLM falls back (no real sections)', async () => {
    cache.cachedChatCompletion.mockResolvedValue({ nope: true });
    const res = await service.generateDeepDive({ userId: 'user-1', domain: 'kundli', payload: { ascendant: 'Leo' } });
    expect(res.summary).toBeTruthy(); // fallback content
    expect(users.deductCredits).not.toHaveBeenCalled();
    expect(prisma.deepDiveUnlock.create).not.toHaveBeenCalled();
  });

  it('caps the serialized payload to bound prompt size', async () => {
    cache.cachedChatCompletion.mockResolvedValue({ summary: 's', points: ['p'], guidance: 'g' });
    await service.interpret({ domain: 'kundli', payload: { blob: 'x'.repeat(20000) } });
    const user = userOf();
    expect(user).toContain('truncated');
    expect(user.length).toBeLessThan(8000);
  });
});
