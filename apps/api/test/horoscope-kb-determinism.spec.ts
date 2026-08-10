/**
 * Horoscope: KB-backed and deterministic fields.
 *
 * `seed-data/horoscope-daily.ts` is the largest file in the corpus (36
 * chunks, keyed exactly `${sign}_career|_health|_love` under category
 * 'horoscopes') and NOTHING queried it. getHoroscope searched the 12 generic
 * 'signs' chunks instead and asked the model to invent career, health, love,
 * luckyNumber and luckyColor on every request — per sign, per period, per
 * locale, per day. Lucky number in particular is a fixed classical
 * correspondence, so a model was free to answer 7 today and 4 tomorrow.
 *
 * These tests pin the new behaviour and, just as importantly, the LIMITS of
 * it: the KB chunks are English, so a localised request must still take the
 * LLM path rather than silently serving English text to a Hindi user.
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
import { luckyNumberFor, luckyColorFor } from '../src/modules/astrology/sign-attributes.util';

const KB_CAREER = 'KB: Aries thrives in pioneering roles and self-directed work.';
const KB_HEALTH = 'KB: Aries should guard against headaches and burnout from overexertion.';
const KB_LOVE = 'KB: Aries loves directly and passionately, needing space to lead.';

describe('getHoroscope — KB-backed aspects and deterministic attributes', () => {
  let service: AstrologyService;
  let openaiService: any;
  let cacheService: any;
  let knowledgeService: any;

  /** getByTopic('horoscopes', `${sign}_${aspect}`) -> one chunk. */
  function wireHoroscopeKb(present = true) {
    knowledgeService.getByTopic.mockImplementation(
      async (category: string, topic: string) => {
        if (category !== 'horoscopes' || !present) return [];
        if (topic.endsWith('_career')) return [{ id: '1', text: KB_CAREER, category, topic }];
        if (topic.endsWith('_health')) return [{ id: '2', text: KB_HEALTH, category, topic }];
        if (topic.endsWith('_love')) return [{ id: '3', text: KB_LOVE, category, topic }];
        return [];
      },
    );
  }

  const aiPayload = {
    prediction: 'AI prediction',
    career: 'AI career (should be overridden)',
    health: 'AI health (should be overridden)',
    love: 'AI love (should be overridden)',
    luckyNumber: 4,
    luckyColor: 'AI-chosen puce',
    mood: 'Energetic',
    compatibility: 'Leo',
  };

  beforeEach(async () => {
    openaiService = {
      // callOpenAI returns chatCompletion's value DIRECTLY and reads
      // `.prediction` off it, so the mock must resolve the parsed object.
      chat: jest.fn().mockResolvedValue(JSON.stringify(aiPayload)),
      chatCompletion: jest.fn().mockResolvedValue(aiPayload),
      getClient: jest.fn().mockReturnValue(null),
      getModel: jest.fn().mockReturnValue('gpt-4o'),
      getModelForFeature: jest.fn().mockReturnValue('gpt-4o'),
    };
    cacheService = { get: jest.fn().mockReturnValue(null), set: jest.fn() };
    knowledgeService = mockKnowledgeService();
    wireHoroscopeKb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AstrologyService,
        { provide: PrismaService, useValue: { user: { findUnique: jest.fn() } } },
        { provide: GeoService, useValue: { search: jest.fn().mockResolvedValue([]) } },
        { provide: ConfigService, useValue: { get: jest.fn((_k: string, d?: any) => d) } },
        { provide: UserService, useValue: { findById: jest.fn(), getProfile: jest.fn() } },
        { provide: OpenAIService, useValue: openaiService },
        { provide: MemoryCacheService, useValue: cacheService },
        { provide: KnowledgeService, useValue: knowledgeService },
        { provide: EphemerisService, useValue: mockEphemerisService() },
        { provide: KbService, useValue: mockKbService() },
      ],
    }).compile();

    service = module.get<AstrologyService>(AstrologyService);
  });

  describe('English requests', () => {
    it('serves career/health/love from the KB, overriding the model', async () => {
      const result = await service.getHoroscope('aries', 'daily');
      expect(result.career).toBe(KB_CAREER);
      expect(result.health).toBe(KB_HEALTH);
      expect(result.love).toBe(KB_LOVE);
    });

    it('queries the exact (category, topic) address, not a similarity search', async () => {
      await service.getHoroscope('aries', 'daily');
      expect(knowledgeService.getByTopic).toHaveBeenCalledWith('horoscopes', 'aries_career', 1);
      expect(knowledgeService.getByTopic).toHaveBeenCalledWith('horoscopes', 'aries_health', 1);
      expect(knowledgeService.getByTopic).toHaveBeenCalledWith('horoscopes', 'aries_love', 1);
    });

    it('stops paying the model for fields the KB supplies', async () => {
      await service.getHoroscope('aries', 'daily');
      const prompts = openaiService.chatCompletion.mock.calls
        .concat(openaiService.chat.mock.calls)
        .map((c: any[]) => JSON.stringify(c));
      expect(prompts.join(' ')).toMatch(/Do NOT return career, health, love/);
    });

    it('uses the deterministic lucky number, never the model’s', async () => {
      const result = await service.getHoroscope('aries', 'daily');
      expect(result.luckyNumber).toBe(luckyNumberFor('aries')); // 9 (Mars)
      expect(result.luckyNumber).not.toBe(aiPayload.luckyNumber);
    });

    it('uses the deterministic lucky colour, never the model’s', async () => {
      const result = await service.getHoroscope('aries', 'daily');
      expect(result.luckyColor).toBe(luckyColorFor('aries')); // 'red'
      expect(result.luckyColor).not.toBe(aiPayload.luckyColor);
    });

    it('still takes the free-text prediction from the model', async () => {
      // The date-varying prose is the part a table genuinely cannot replace.
      const result = await service.getHoroscope('aries', 'daily');
      expect(result.prediction).toBe(aiPayload.prediction);
    });

    it('is stable across repeated calls for the same sign', async () => {
      cacheService.get.mockReturnValue(null);
      const a = await service.getHoroscope('leo', 'daily');
      const b = await service.getHoroscope('leo', 'daily');
      expect(a.luckyNumber).toBe(b.luckyNumber);
      expect(a.luckyColor).toBe(b.luckyColor);
      expect(a.career).toBe(b.career);
    });
  });

  describe('localisation guard', () => {
    it('does NOT serve English KB text to a non-English request', async () => {
      const result = await service.getHoroscope('aries', 'daily', 'hi');
      expect(result.career).not.toBe(KB_CAREER);
      expect(result.health).not.toBe(KB_HEALTH);
      expect(result.love).not.toBe(KB_LOVE);
    });

    it('does not query the English horoscope chunks at all for a localised request', async () => {
      await service.getHoroscope('aries', 'daily', 'ta');
      const horoscopeLookups = knowledgeService.getByTopic.mock.calls.filter(
        (c: any[]) => c[0] === 'horoscopes',
      );
      expect(horoscopeLookups).toHaveLength(0);
    });

    it('keeps the full model ask for a localised request', async () => {
      await service.getHoroscope('aries', 'daily', 'hi');
      const prompts = openaiService.chatCompletion.mock.calls
        .concat(openaiService.chat.mock.calls)
        .map((c: any[]) => JSON.stringify(c));
      expect(prompts.join(' ')).not.toMatch(/Do NOT return career, health, love/);
    });

    it('lucky NUMBER is still deterministic in any locale (a digit needs no translation)', async () => {
      const result = await service.getHoroscope('aries', 'daily', 'hi');
      expect(result.luckyNumber).toBe(luckyNumberFor('aries'));
    });
  });

  describe('degradation', () => {
    it('falls back to model output when the KB has no rows', async () => {
      wireHoroscopeKb(false);
      const result = await service.getHoroscope('aries', 'daily');
      expect(result.career).toBe(aiPayload.career);
      expect(result.health).toBe(aiPayload.health);
    });

    it('does not trim the prompt when the KB is incomplete', async () => {
      // Partial coverage must not leave the model told to skip a field the
      // KB cannot actually supply.
      knowledgeService.getByTopic.mockImplementation(async (category: string, topic: string) =>
        category === 'horoscopes' && topic.endsWith('_career')
          ? [{ id: '1', text: KB_CAREER, category, topic }]
          : [],
      );
      const result = await service.getHoroscope('aries', 'daily');
      const prompts = openaiService.chatCompletion.mock.calls
        .concat(openaiService.chat.mock.calls)
        .map((c: any[]) => JSON.stringify(c));
      expect(prompts.join(' ')).not.toMatch(/Do NOT return career, health, love/);
      expect(result.health).toBe(aiPayload.health);
    });

    it('survives a KB failure without failing the request', async () => {
      knowledgeService.getByTopic.mockRejectedValue(new Error('db down'));
      const result = await service.getHoroscope('aries', 'daily');
      expect(result.prediction).toBe(aiPayload.prediction);
      expect(result.career).toBe(aiPayload.career);
    });

    it('handles an unknown sign without throwing', async () => {
      const result = await service.getHoroscope('ophiuchus', 'daily');
      expect(result).toBeDefined();
      expect(result.luckyNumber).toBe(aiPayload.luckyNumber); // no table entry -> model value
    });
  });
});
