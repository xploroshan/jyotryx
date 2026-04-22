/**
 * LLM cost regression budget.
 *
 * Boots each covered service with a counting stub instead of a real LLM
 * client, then asserts that the number of `chatCompletion` calls stays
 * within `tests/baseline/llm-budget.json`. Each scenario has a
 * `maxCalls` ceiling — Track A work LOWERS these ceilings as features
 * migrate to the KB. A PR that raises any ceiling must justify it in
 * review.
 *
 * Today this covers just the daily briefing. Numerology, report section
 * translation, and chat are added as each Track A phase lands.
 */
import { Test, TestingModule } from '@nestjs/testing';
import * as path from 'path';
import * as fs from 'fs';
import { DailyBriefingService } from '../src/modules/daily-briefing/daily-briefing.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { OpenAIService } from '../src/openai/openai.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { MemoryCacheService } from '../src/common/cache.service';
import { mockPrismaService, mockKnowledgeService, mockCacheService, mockUser } from './helpers/mocks';

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
      // Return empty object so translateFields treats it as a miss and
      // falls back to the English input. This preserves behaviour without
      // letting real LLM I/O leak into the test.
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
});
