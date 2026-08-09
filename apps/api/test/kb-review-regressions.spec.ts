/**
 * Regression tests for defects found by the ultra-review of this changeset.
 *
 * Each block pins a bug that was introduced by the KB work and caught in
 * review — not hypothetical risks. They exist so the same mistake cannot be
 * reintroduced by a later "simplification".
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AstrologyService } from '../src/modules/astrology/astrology.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserService } from '../src/modules/user/user.service';
import { OpenAIService } from '../src/openai/openai.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { KbService } from '../src/knowledge/kb.service';
import { MemoryCacheService } from '../src/common/cache.service';
import { EphemerisService } from '../src/ephemeris/ephemeris.service';
import { GeoService } from '../src/modules/geo/geo.service';
import { mockKnowledgeService, mockKbService, mockEphemerisService } from './helpers/mocks';
import { KbCoverageTracker } from '../src/knowledge/kb-coverage';
import { normaliseLocale } from '../src/knowledge/kb-locales';
import { tokenizeQuery } from '../src/knowledge/keywords.util';
import { luckyNumberFor } from '../src/modules/astrology/sign-attributes.util';

const KB_TEXT = 'KB-SOURCED ASPECT TEXT';

describe('review regressions — horoscope KB gating', () => {
  let service: AstrologyService;
  let knowledgeService: any;
  let cacheService: any;

  const ai = {
    prediction: 'AI prediction', career: 'AI career', health: 'AI health', love: 'AI love',
    luckyNumber: 4, luckyColor: 'AI puce', mood: 'Energetic', compatibility: 'Leo',
  };

  beforeEach(async () => {
    knowledgeService = mockKnowledgeService();
    knowledgeService.getByTopic.mockImplementation(async (c: string) =>
      c === 'horoscopes' ? [{ id: '1', text: KB_TEXT, category: c, topic: 't' }] : [],
    );
    cacheService = { get: jest.fn().mockReturnValue(null), set: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AstrologyService,
        { provide: PrismaService, useValue: { user: { findUnique: jest.fn() } } },
        { provide: GeoService, useValue: { search: jest.fn().mockResolvedValue([]) } },
        { provide: ConfigService, useValue: { get: jest.fn((_k: string, d?: any) => d) } },
        { provide: UserService, useValue: { findById: jest.fn(), getProfile: jest.fn() } },
        {
          provide: OpenAIService,
          useValue: {
            chat: jest.fn().mockResolvedValue(null),
            chatCompletion: jest.fn().mockResolvedValue(ai),
            getClient: jest.fn().mockReturnValue(null),
            getModel: jest.fn().mockReturnValue('gpt-4o'),
            getModelForFeature: jest.fn().mockReturnValue('gpt-4o'),
          },
        },
        { provide: MemoryCacheService, useValue: cacheService },
        { provide: KnowledgeService, useValue: knowledgeService },
        { provide: EphemerisService, useValue: mockEphemerisService() },
        { provide: KbService, useValue: mockKbService() },
      ],
    }).compile();
    service = module.get(AstrologyService);
  });

  it('TRADITION GATE: Vedic KB text is never served under a Western horoscope', async () => {
    // The chunks cite Mangal Dosha, gemstones and Venus dasha; serving them
    // under WESTERN put Vedic remedies in a Western reading, and made
    // multi-tradition comparisons return byte-identical text for traditions
    // the prompt asks the model to CONTRAST.
    const r = await service.getHoroscope('aries', 'daily', 'en', 'WESTERN');
    expect(r.career).not.toBe(KB_TEXT);
    expect(r.career).toBe(ai.career);
  });

  it('TRADITION GATE: Vedic lucky number is not applied to a Western horoscope', async () => {
    const r = await service.getHoroscope('scorpio', 'daily', 'en', 'WESTERN');
    expect(r.luckyNumber).toBe(ai.luckyNumber);
    expect(r.luckyNumber).not.toBe(luckyNumberFor('scorpio'));
  });

  it('TRADITION GATE: Vedic still uses the KB', async () => {
    const r = await service.getHoroscope('aries', 'daily', 'en', 'VEDIC');
    expect(r.career).toBe(KB_TEXT);
    expect(r.luckyNumber).toBe(luckyNumberFor('aries'));
  });

  it.each(['weekly', 'monthly', 'yearly'] as const)(
    'PERIOD GATE: %s does not reuse the period-less daily chunks',
    async (period) => {
      // Topics are `${sign}_career|_health|_love` with no period dimension.
      // Reusing them made all four periods return the same paragraph forever —
      // a yearly horoscope reduced to a static sign profile.
      const r = await service.getHoroscope('aries', period, 'en', 'VEDIC');
      expect(r.career).not.toBe(KB_TEXT);
    },
  );

  it('PERIOD GATE: daily still uses the KB', async () => {
    const r = await service.getHoroscope('aries', 'daily', 'en', 'VEDIC');
    expect(r.career).toBe(KB_TEXT);
  });

  it('CACHE VERSION: the key is versioned so pre-deploy entries are not served', async () => {
    await service.getHoroscope('aries', 'daily', 'en', 'VEDIC');
    expect(cacheService.set).toHaveBeenCalledWith(
      expect.stringContaining('horoscope:v2:'),
      expect.anything(),
      expect.anything(),
    );
  });
});

describe('review regressions — coverage tracker is bounded', () => {
  it('ignores locales outside the closed KB set (public endpoints pass raw query strings)', () => {
    const t = new KbCoverageTracker();
    for (let i = 0; i < 5000; i++) t.record(`junk-${i}`, 'Aries', false);
    // Unbounded before the fix: every distinct value allocated a Map entry
    // plus a Set, reachable unauthenticated via ?locale=<random>.
    expect(t.report().byLocale).toHaveLength(0);
  });

  it('still records real locales', () => {
    const t = new KbCoverageTracker();
    t.record('hi', 'Aries', false);
    t.record('ta', 'Aries', true);
    expect(t.report().byLocale.map((l) => l.locale).sort()).toEqual(['hi', 'ta']);
  });
});

describe('review regressions — locale normalisation', () => {
  it('collapses a region subtag to the base language', () => {
    // 'hi-IN' is valid BCP-47 (which the column doc invites) but the matcher
    // is exact equality, so it would have matched zero Hindi rows.
    expect(normaliseLocale('hi-IN')).toBe('hi');
    expect(normaliseLocale('TA')).toBe('ta');
  });

  it('falls back to en for anything unknown, never to an invalid value', () => {
    expect(normaliseLocale('klingon')).toBe('en');
    expect(normaliseLocale(undefined)).toBe('en');
    expect(normaliseLocale(null)).toBe('en');
    expect(normaliseLocale('')).toBe('en');
  });
});

describe('review regressions — query token cap', () => {
  it('caps tokens so a long free-text question cannot build a huge IN predicate', () => {
    const huge = Array.from({ length: 5000 }, (_, i) => `word${i}`).join(' ');
    expect(tokenizeQuery(huge)).toHaveLength(30);
  });
});
