/**
 * LLM cost regression budget.
 *
 * Boots each covered service with a counting stub instead of a real LLM
 * client, then asserts that the number of `chatCompletion` calls stays
 * within `tests/baseline/llm-budget.json`. A PR that raises any ceiling
 * must justify it in review.
 *
 * Coverage: daily briefing (A1b), numerology (A2b), report fallback (A3b),
 * astrology (A4 — Chinese zodiac / medical body-zodiac / flying stars /
 * panchang localization / sade-sati localization / muhurat fallback;
 * A5a — horary / zodiacal-releasing / decumbiture / dosha; A5b — bazi /
 * western-natal / hellenistic-profections / western-synastry /
 * western-transits). The full translate-after migration (Track A) is
 * closed; the only non-zero astrology budget that remains is
 * muhuratFallback = 1, which is the primary LLM attempt for the AI path,
 * not a localization call.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';
import { DailyBriefingService } from '../src/modules/daily-briefing/daily-briefing.service';
import { NumerologyService } from '../src/modules/numerology/numerology.service';
import { ReportService } from '../src/modules/report/report.service';
import { AstrologyService } from '../src/modules/astrology/astrology.service';
import { UserService } from '../src/modules/user/user.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { OpenAIService } from '../src/openai/openai.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { KbService } from '../src/knowledge/kb.service';
import { MemoryCacheService } from '../src/common/cache.service';
import { EphemerisService } from '../src/ephemeris/ephemeris.service';
import { mockPrismaService, mockKnowledgeService, mockKbService, mockCacheService, mockUser, mockUserService, mockConfigService, mockEphemerisService } from './helpers/mocks';

interface Baseline {
  scenarios: Record<string, { maxCalls: number; description: string }>;
}

const BASELINE_PATH = path.resolve(__dirname, '../../../tests/baseline/llm-budget.json');
const baseline: Baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));

function scenarioBudget(name: string): number {
  const s = baseline.scenarios[name];
  if (!s) throw new Error(`Missing baseline scenario: ${name}`);
  return s.maxCalls;
}

function countingOpenAI() {
  const calls: Array<{ feature?: string }> = [];
  const stub = {
    chat: jest.fn().mockResolvedValue(null),
    chatCompletion: jest.fn(async (opts: any) => {
      calls.push({ feature: opts?.feature });
      // Return an empty object so callers treat the response as a miss and
      // fall back to their deterministic output. This preserves behaviour
      // without letting real LLM I/O leak into the test.
      return {};
    }),
    chatWithImage: jest.fn().mockResolvedValue(null),
    getClient: jest.fn().mockReturnValue(null),
    getModel: jest.fn().mockReturnValue('gpt-4o-mini'),
    getModelForFeature: jest.fn().mockReturnValue('gpt-4o-mini'),
    recordUsage: jest.fn().mockResolvedValue(undefined),
    invalidateCache: jest.fn().mockResolvedValue(undefined),
    computeCost: jest.fn().mockReturnValue(0),
  };
  return { stub, calls };
}

describe('LLM cost regression budget', () => {
  describe('daily briefing', () => {
    let service: DailyBriefingService;
    let counter: ReturnType<typeof countingOpenAI>;
    let prisma: any;
    let cache: any;

    beforeEach(async () => {
      counter = countingOpenAI();
      prisma = mockPrismaService();
      prisma.user.findUnique.mockResolvedValue(mockUser);
      cache = mockCacheService();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DailyBriefingService,
          { provide: PrismaService, useValue: prisma },
          { provide: OpenAIService, useValue: counter.stub },
          { provide: KnowledgeService, useValue: mockKnowledgeService() },
          { provide: KbService, useValue: mockKbService() },
          { provide: MemoryCacheService, useValue: cache },
        ],
      }).compile();

      service = module.get(DailyBriefingService);
    });

    it('daily-briefing.en.fresh stays within budget', async () => {
      await service.getDailyBriefing('test-uuid', 'en');
      const budget = scenarioBudget('daily-briefing.en.fresh');
      expect(counter.calls.length).toBeLessThanOrEqual(budget);
    });

    it('daily-briefing.hi.fresh stays within budget', async () => {
      await service.getDailyBriefing('test-uuid', 'hi');
      const budget = scenarioBudget('daily-briefing.hi.fresh');
      expect(counter.calls.length).toBeLessThanOrEqual(budget);
    });

    it('daily-briefing.en.cached stays within budget', async () => {
      // Simulate warm cache: both global + user entries prefilled.
      cache.get.mockImplementation(async (key: string) => {
        if (key.startsWith('briefing:global:')) {
          return {
            dayRuler: 'Sun',
            currentPlanet: 'Sun',
            dayQuality: 'good',
            doList: ['Leadership decisions'],
            avoidList: ['Risky investments'],
            planetaryHours: [],
            currentHora: null,
            luckyColor: 'Ruby Red',
            luckyNumber: 3,
            luckyTime: '10:00 AM - 11:30 AM',
            remedy: 'Offer water to the rising Sun',
            mantra: 'Om Suryaya Namaha',
            panchang: { tithi: 'Panchami', nakshatra: 'Rohini', yoga: 'Siddhi', vara: 'Ravivaar (Sunday)', rahukaal: '4:30 PM - 6:00 PM' },
          };
        }
        if (key.startsWith('briefing:user:')) {
          return { greeting: 'Good Morning, Test!', professionInsight: 'x', summary: 'y', transitAlert: null };
        }
        return null;
      });

      await service.getDailyBriefing('test-uuid', 'en');
      const budget = scenarioBudget('daily-briefing.en.cached');
      expect(counter.calls.length).toBeLessThanOrEqual(budget);
    });
  });

  describe('numerology', () => {
    let service: NumerologyService;
    let counter: ReturnType<typeof countingOpenAI>;

    beforeEach(async () => {
      counter = countingOpenAI();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          NumerologyService,
          { provide: OpenAIService, useValue: counter.stub },
          { provide: KnowledgeService, useValue: mockKnowledgeService() },
          { provide: KbService, useValue: mockKbService() },
        ],
      }).compile();
      service = module.get(NumerologyService);
    });

    it('numerology.name.en.fresh stays within budget', async () => {
      await service.analyzeName('Arjun Sharma', 'en');
      const budget = scenarioBudget('numerology.name.en.fresh');
      expect(counter.calls.length).toBeLessThanOrEqual(budget);
    });

    it('numerology.name.hi.fresh stays within budget', async () => {
      await service.analyzeName('Arjun Sharma', 'hi');
      const budget = scenarioBudget('numerology.name.hi.fresh');
      expect(counter.calls.length).toBeLessThanOrEqual(budget);
    });

    it('numerology.brand.hi.fresh stays within budget', async () => {
      await service.analyzeBrand('Acme Labs', 'tech', 'hi');
      const budget = scenarioBudget('numerology.brand.hi.fresh');
      expect(counter.calls.length).toBeLessThanOrEqual(budget);
    });

    it('numerology.personalYear.hi.fresh stays within budget', async () => {
      await service.getPersonalYear('1990-05-15', 'hi');
      const budget = scenarioBudget('numerology.personalYear.hi.fresh');
      expect(counter.calls.length).toBeLessThanOrEqual(budget);
    });
  });

  describe('report fallback', () => {
    let service: ReportService;
    let counter: ReturnType<typeof countingOpenAI>;

    beforeEach(async () => {
      counter = countingOpenAI();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ReportService,
          { provide: PrismaService, useValue: mockPrismaService() },
          { provide: ConfigService, useValue: mockConfigService() },
          { provide: UserService, useValue: mockUserService() },
          { provide: OpenAIService, useValue: counter.stub },
          { provide: KnowledgeService, useValue: mockKnowledgeService() },
          { provide: KbService, useValue: mockKbService() },
        ],
      }).compile();
      service = module.get(ReportService);
    });

    // Both scenarios exercise the fallback path by passing an empty
    // birthDate, so `generateAIReportSections` skips the LLM call and
    // goes straight to KbReportSection. The normal (LLM-generated) path
    // is already locale-aware via getLocaleInstruction and costs
    // exactly 1 LLM call for the generation itself regardless of locale,
    // so it doesn't need a separate budget scenario here.
    const run = (locale: string) =>
      (service as any).generateAIReportSections(
        'LIFE',
        { dateOfBirth: '', timeOfBirth: '', placeOfBirth: '' },
        'Test User',
        'Male',
        'test-uuid',
        locale,
      );

    it('report.fallback.en.fresh stays within budget', async () => {
      await run('en');
      expect(counter.calls.length).toBeLessThanOrEqual(scenarioBudget('report.fallback.en.fresh'));
    });

    it('report.fallback.hi.fresh stays within budget', async () => {
      await run('hi');
      expect(counter.calls.length).toBeLessThanOrEqual(scenarioBudget('report.fallback.hi.fresh'));
    });
  });

  describe('astrology', () => {
    let service: AstrologyService;
    let counter: ReturnType<typeof countingOpenAI>;

    beforeEach(async () => {
      counter = countingOpenAI();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AstrologyService,
          { provide: PrismaService, useValue: mockPrismaService() },
          { provide: ConfigService, useValue: mockConfigService() },
          { provide: UserService, useValue: mockUserService() },
          { provide: OpenAIService, useValue: counter.stub },
          { provide: MemoryCacheService, useValue: mockCacheService() },
          { provide: KnowledgeService, useValue: mockKnowledgeService() },
          { provide: KbService, useValue: mockKbService() },
          { provide: EphemerisService, useValue: mockEphemerisService() },
        ],
      }).compile();
      service = module.get(AstrologyService);
    });

    it('astrology.chineseZodiac.hi.fresh stays within budget', async () => {
      await service.getChineseZodiac(1990, 'hi');
      expect(counter.calls.length).toBeLessThanOrEqual(scenarioBudget('astrology.chineseZodiac.hi.fresh'));
    });

    it('astrology.medicalBodyZodiac.hi.fresh stays within budget', async () => {
      await service.getMedicalBodyZodiac('hi');
      expect(counter.calls.length).toBeLessThanOrEqual(scenarioBudget('astrology.medicalBodyZodiac.hi.fresh'));
    });

    it('astrology.flyingStars.hi.fresh stays within budget', async () => {
      await service.getFlyingStars(2026, 'hi');
      expect(counter.calls.length).toBeLessThanOrEqual(scenarioBudget('astrology.flyingStars.hi.fresh'));
    });

    it('astrology.localizePanchang.hi.fresh stays within budget', async () => {
      // Exercise localizePanchang directly — getPanchang makes a primary
      // LLM call that is orthogonal to what A4 changed.
      await (service as any).localizePanchang({
        date: '2026-04-23',
        tithi: 'Shukla Pratipada',
        nakshatra: 'Rohini',
        yoga: 'Siddhi',
        karana: 'Bava',
        vara: 'Ravivaar',
        sunrise: '06:00 AM',
        sunset: '06:30 PM',
        moonrise: '07:00 AM',
        rahukaal: '04:30 PM - 06:00 PM',
        gulikakaal: '03:00 PM - 04:30 PM',
        yamakantaka: '12:00 PM - 01:30 PM',
      }, 'hi');
      expect(counter.calls.length).toBeLessThanOrEqual(scenarioBudget('astrology.localizePanchang.hi.fresh'));
    });

    it('astrology.localizeSadeSati.hi.fresh stays within budget', async () => {
      await (service as any).localizeSadeSati(
        { active: true, phase: 'Peak', description: 'Saturn is transiting over your natal Moon sign — the peak phase of Sade Sati. This is the most intense period, bringing transformation, emotional challenges, and karmic lessons. Patience and discipline are key.' },
        'hi',
      );
      expect(counter.calls.length).toBeLessThanOrEqual(scenarioBudget('astrology.localizeSadeSati.hi.fresh'));
    });

    it('astrology.muhuratFallback.hi.fresh stays within budget', async () => {
      // getMuhurat always makes one primary LLM attempt for the AI path;
      // A4 removed the post-translation over the fallback reasons.
      await service.getMuhurat({
        purpose: 'Wedding ceremony',
        fromDate: '2026-05-01',
        toDate: '2026-05-05',
        location: 'Delhi',
        locale: 'hi',
      } as any);
      expect(counter.calls.length).toBeLessThanOrEqual(scenarioBudget('astrology.muhuratFallback.hi.fresh'));
    });

    it('astrology.horaryAsk.hi.fresh stays within budget', async () => {
      // A5a flipped the horary judgment/significator strings to KB
      // templates; A5b retired the nested getWesternNatal translateText.
      // Budget is 0.
      await service.getHoraryAsk('test-uuid', { question: 'Will I succeed?', locale: 'hi' });
      expect(counter.calls.length).toBeLessThanOrEqual(scenarioBudget('astrology.horaryAsk.hi.fresh'));
    });

    it('astrology.zodiacalReleasing.hi.fresh stays within budget', async () => {
      await service.getZodiacalReleasing('test-uuid', { dateOfBirth: '1990-05-15', locale: 'hi' });
      expect(counter.calls.length).toBeLessThanOrEqual(scenarioBudget('astrology.zodiacalReleasing.hi.fresh'));
    });

    it('astrology.decumbiture.hi.fresh stays within budget', async () => {
      // Same shape as horaryAsk — A5a flipped the guidance/interpretation
      // strings; A5b retired the nested getWesternNatal translateText.
      // Budget is 0.
      await service.getDecumbiture('test-uuid', { decumbitureDate: '2026-04-23', decumbitureTime: '10:00', locale: 'hi' });
      expect(counter.calls.length).toBeLessThanOrEqual(scenarioBudget('astrology.decumbiture.hi.fresh'));
    });

    it('astrology.dosha.hi.fresh stays within budget', async () => {
      // Stub user.findUnique so getDosha takes the primary Swiss Eph path
      // (deterministic, no LLM). A5a flipped localizeDoshas to KB.
      const prisma = (service as any).prisma;
      prisma.user.findUnique.mockResolvedValueOnce({
        dateOfBirth: new Date('1990-05-15'),
        timeOfBirth: '06:00',
        placeOfBirth: { name: 'Delhi', lat: 28.6139, lng: 77.2090 },
      });
      await service.getDosha('test-uuid', 'hi');
      expect(counter.calls.length).toBeLessThanOrEqual(scenarioBudget('astrology.dosha.hi.fresh'));
    });

    it('astrology.doshaFallback.hi.fresh stays within budget', async () => {
      // Default prisma.user.findUnique returns undefined, so getDosha
      // takes the no-birth-details branch — 3 fallback doshas localized
      // from `dosha.*.birth_required` KbBriefingPhrase templates.
      await service.getDosha('test-uuid', 'hi');
      expect(counter.calls.length).toBeLessThanOrEqual(scenarioBudget('astrology.doshaFallback.hi.fresh'));
    });

    it('astrology.bazi.hi.fresh stays within budget', async () => {
      await service.getBazi('test-uuid', { dateOfBirth: '1990-05-15', timeOfBirth: '14:30', locale: 'hi' });
      expect(counter.calls.length).toBeLessThanOrEqual(scenarioBudget('astrology.bazi.hi.fresh'));
    });

    it('astrology.westernNatal.hi.fresh stays within budget', async () => {
      await service.getWesternNatal('test-uuid', { dateOfBirth: '1990-05-15', timeOfBirth: '14:30', locale: 'hi' });
      expect(counter.calls.length).toBeLessThanOrEqual(scenarioBudget('astrology.westernNatal.hi.fresh'));
    });

    it('astrology.hellenisticProfections.hi.fresh stays within budget', async () => {
      await service.getHellenisticProfections('test-uuid', { dateOfBirth: '1990-05-15', locale: 'hi' });
      expect(counter.calls.length).toBeLessThanOrEqual(scenarioBudget('astrology.hellenisticProfections.hi.fresh'));
    });

    it('astrology.westernSynastry.hi.fresh stays within budget', async () => {
      await service.getWesternSynastry('test-uuid', {
        partner1: { dateOfBirth: '1990-05-15', timeOfBirth: '14:30' },
        partner2: { dateOfBirth: '1992-07-20', timeOfBirth: '09:00' },
        locale: 'hi',
      });
      expect(counter.calls.length).toBeLessThanOrEqual(scenarioBudget('astrology.westernSynastry.hi.fresh'));
    });

    it('astrology.westernTransits.hi.fresh stays within budget', async () => {
      await service.getWesternTransits('test-uuid', { dateOfBirth: '1990-05-15', timeOfBirth: '14:30', locale: 'hi' });
      expect(counter.calls.length).toBeLessThanOrEqual(scenarioBudget('astrology.westernTransits.hi.fresh'));
    });
  });
});
