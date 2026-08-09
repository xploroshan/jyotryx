/**
 * InterpretationService x placement library (4/N).
 *
 * The point of the six new tables is to convert kundli and matching from
 * LLM-REQUIRED to LLM-OPTIONAL. These tests prove the assembled output is
 * genuinely richer than the previous house-only version (otherwise the KB
 * path is a thinner substitute and should not be preferred), and that the
 * locale gate still holds so no English leaks into a translated reading.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InterpretationService } from '../src/modules/interpretation/interpretation.service';
import { LlmCacheService } from '../src/llm/llm-cache.service';
import { KbService } from '../src/knowledge/kb.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserService } from '../src/modules/user/user.service';
import { FeatureAccessService } from '../src/common/feature-access/feature-access.service';

describe('InterpretationService — placement library', () => {
  let service: InterpretationService;
  let cache: { cachedChatCompletion: jest.Mock };
  let kb: any;

  /** A KB row + a renderStatus that reports a hit only for the given locale. */
  const row = (value: any) => ({ key: 'k', tradition: null, i18n: { en: value } });

  beforeEach(async () => {
    cache = { cachedChatCompletion: jest.fn().mockResolvedValue(null) };

    kb = {
      getSignTrait: jest.fn().mockResolvedValue(
        row({ summary: 'Aries rising: direct and self-starting.', guidance: 'Lead, but listen.' }),
      ),
      getPlanetInHouse: jest.fn().mockResolvedValue(row({ text: 'Sun in the 10th: visible authority.' })),
      getPlanetInSign: jest.fn().mockResolvedValue(
        row({ text: 'Expressed through cardinal fire.', dignity: 'exalted' }),
      ),
      getYogaMeaning: jest.fn().mockResolvedValue(
        row({ name: 'Gajakesari Yoga', text: 'Jupiter in a kendra from the Moon.' }),
      ),
      getMatchingTier: jest.fn().mockResolvedValue(
        // The real matching-tiers.json ships `points` (4 bullets per tier);
        // the mock must too, or it does not represent production.
        row({
          summary: 'A strong match overall.',
          points: ['Shared values support the match.', 'Communication styles align well.'],
          guidance: 'Proceed with open conversation.',
        }),
      ),
      getKootaMeaning: jest.fn().mockResolvedValue(
        row({ name: 'Nadi', maxPoints: 8, text: 'Constitutional compatibility.', lowScoreNote: 'Nadi dosha; often cancelled.' }),
      ),
      getDashaImpact: jest.fn().mockResolvedValue(null),
      getNumberMeaning: jest.fn().mockResolvedValue(null),
      // Matches only English, mirroring an un-backfilled locale in production.
      renderStatus: jest.fn((r: any, locale?: string) =>
        r ? { value: r.i18n.en, matched: !locale || locale === 'en' } : null,
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterpretationService,
        { provide: LlmCacheService, useValue: cache },
        { provide: KbService, useValue: kb },
        { provide: PrismaService, useValue: { deepDiveUnlock: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() } } },
        { provide: UserService, useValue: { deductCredits: jest.fn().mockResolvedValue(true) } },
        {
          provide: FeatureAccessService,
          useValue: {
            paidFeaturesFree: jest.fn().mockResolvedValue(false),
            isActiveSubscriber: jest.fn().mockResolvedValue(false),
            creditsEnabled: jest.fn().mockResolvedValue(true),
            getCreditCost: jest.fn(async (_n: string, fb: number) => fb),
          },
        },
        { provide: ConfigService, useValue: { get: jest.fn((_k: string, d?: any) => d) } },
      ],
    }).compile();

    service = module.get(InterpretationService);
  });

  const kundliPayload = {
    ascendant: 'Aries',
    planets: [{ planet: 'Sun', house: 10, sign: 'Aries' }],
    yogas: ['gajakesari'],
  };

  describe('kundli assembly', () => {
    it('layers the SIGN onto the house placement', async () => {
      const r = await service.interpret({ domain: 'kundli', payload: kundliPayload, locale: 'en' });
      expect(r.points.join(' ')).toContain('Sun in the 10th');
      expect(r.points.join(' ')).toContain('cardinal fire');
    });

    it('flags a notable dignity', async () => {
      const r = await service.interpret({ domain: 'kundli', payload: kundliPayload, locale: 'en' });
      expect(r.points.join(' ')).toContain('(exalted)');
    });

    it('does NOT annotate neutral dignity (that would be noise)', async () => {
      kb.getPlanetInSign.mockResolvedValue(row({ text: 'Steady expression.', dignity: 'neutral' }));
      const r = await service.interpret({ domain: 'kundli', payload: kundliPayload, locale: 'en' });
      expect(r.points.join(' ')).not.toContain('(neutral)');
      expect(r.points.join(' ')).toContain('Steady expression.');
    });

    it('names detected yogas', async () => {
      const r = await service.interpret({ domain: 'kundli', payload: kundliPayload, locale: 'en' });
      expect(r.points.join(' ')).toContain('Gajakesari Yoga');
    });

    it('still works when the sign layer is missing (house-only fallback)', async () => {
      kb.getPlanetInSign.mockResolvedValue(null);
      const r = await service.interpret({ domain: 'kundli', payload: kundliPayload, locale: 'en' });
      expect(r.points.join(' ')).toContain('Sun in the 10th');
    });

    it('does not call the LLM when the KB covers the reading', async () => {
      await service.interpret({ domain: 'kundli', payload: kundliPayload, locale: 'en' });
      expect(cache.cachedChatCompletion).not.toHaveBeenCalled();
    });

    it('accepts a yoga supplied as an object with a slug', async () => {
      const r = await service.interpret({ domain: 'kundli', payload: { ...kundliPayload, yogas: [{ slug: 'gajakesari' }] }, locale: 'en' });
      expect(r.points.join(' ')).toContain('Gajakesari Yoga');
    });
  });

  describe('matching assembly', () => {
    const payload = {
      percentage: 75,
      kootas: [{ name: 'nadi', obtainedPoints: 0, maxPoints: 8 }],
    };

    it('explains each koota, not just the total', async () => {
      const r = await service.interpret({ domain: 'matching', payload: payload, locale: 'en' });
      expect(r.summary).toContain('strong match');
      expect(r.points.join(' ')).toContain('Nadi');
      expect(r.points.join(' ')).toContain('Constitutional compatibility');
    });

    it('adds the low-score note ONLY when that koota actually scored low', async () => {
      const low = await service.interpret({ domain: 'matching', payload: payload, locale: 'en' });
      expect(low.points.join(' ')).toContain('often cancelled');

      const high = await service.interpret({ domain: 'matching', payload: { percentage: 75, kootas: [{ name: 'nadi', obtainedPoints: 8, maxPoints: 8 }] }, locale: 'en' });
      expect(high.points.join(' ')).not.toContain('often cancelled');
    });

    it('still returns the tier summary when no koota breakdown is supplied', async () => {
      const r = await service.interpret({ domain: 'matching', payload: { percentage: 75 }, locale: 'en' });
      expect(r.summary).toContain('strong match');
    });

    it('does not call the LLM when the KB covers it', async () => {
      await service.interpret({ domain: 'matching', payload: payload, locale: 'en' });
      expect(cache.cachedChatCompletion).not.toHaveBeenCalled();
    });
  });

  describe('locale gate (no English leaking into a translated reading)', () => {
    it('falls through to the LLM for an un-backfilled locale — kundli', async () => {
      await service.interpret({ domain: 'kundli', payload: kundliPayload, locale: 'hi' });
      expect(cache.cachedChatCompletion).toHaveBeenCalled();
    });

    it('falls through to the LLM for an un-backfilled locale — matching', async () => {
      await service.interpret({ domain: 'matching', payload: { percentage: 75 }, locale: 'ta' });
      expect(cache.cachedChatCompletion).toHaveBeenCalled();
    });
  });

  describe('resilience', () => {
    it('a KB failure never breaks interpretation', async () => {
      // mockImplementation, not mockRejectedValue: the latter constructs the
      // rejected promise eagerly, which Jest reports as an unhandled rejection
      // even though the service catches it at call time.
      kb.getPlanetInSign.mockImplementation(async () => {
        throw new Error('db down');
      });
      const r = await service.interpret({ domain: 'kundli', payload: kundliPayload, locale: 'en' });
      expect(r).toBeDefined();
    });
  });
});
