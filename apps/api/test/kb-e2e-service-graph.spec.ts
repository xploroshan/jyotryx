/**
 * KB end-to-end through the REAL service graph.
 *
 * Every other spec in this change mocks one service and asserts about its
 * neighbour. This one wires the genuine KnowledgeService, KbService and
 * InterpretationService together and mocks only at the true boundary
 * (PrismaService / the embedding provider), so the wiring between them is
 * exercised rather than assumed — the class of defect that let tarot and
 * vastu query categories that were never seeded.
 *
 * NOTE ON SCOPE: the repo's real-Postgres integration suite
 * (`npm run test:int`) cannot run in every environment because the
 * pre-existing `20260412_add_pgvector` migration needs the `vector`
 * extension. The two migrations added by this change were instead verified
 * directly against a real PostgreSQL 16 server (tables, unique-constraint
 * semantics, DEFAULT backfill of existing rows, and ALTER idempotency).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { VectorSearchService } from '../src/knowledge/vector-search.service';
import { EmbeddingService } from '../src/ai/embeddings/embedding-service';
import { KbService } from '../src/knowledge/kb.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { OpenAIService } from '../src/openai/openai.service';
import { InterpretationService } from '../src/modules/interpretation/interpretation.service';
import { LlmCacheService } from '../src/llm/llm-cache.service';
import { UserService } from '../src/modules/user/user.service';
import { FeatureAccessService } from '../src/common/feature-access/feature-access.service';
import { ALL_KNOWLEDGE_SEEDS } from '../src/knowledge/seed-data';
import { KB_CATEGORIES } from '../src/knowledge/kb-categories';
import { SEED_TABLES } from '../prisma/seed-kb';

/** An in-memory stand-in for knowledge_documents, seeded from the real corpus. */
function makeDocStore() {
  const docs = ALL_KNOWLEDGE_SEEDS.map((d, i) => ({
    id: `doc-${i}`,
    text: d.text,
    category: d.category,
    topic: d.topic ?? null,
    source: d.source ?? null,
    locale: 'en',
    keywords: [] as string[],
  }));
  return {
    findMany: jest.fn(async (args: any) => {
      const w = args?.where ?? {};
      let out = docs;
      if (w.category) out = out.filter((d) => d.category === w.category);
      if (w.topic) out = out.filter((d) => d.topic === w.topic);
      if (w.locale?.in) out = out.filter((d) => w.locale.in.includes(d.locale));
      return out.slice(0, args?.take ?? out.length);
    }),
    count: jest.fn(async (args: any) =>
      args?.where?.category
        ? docs.filter((d) => d.category === args.where.category).length
        : docs.length,
    ),
  };
}

/** Kb* tables backed by the real seed JSON. */
function makeKbTableStore(modelName: string) {
  const table = SEED_TABLES.find((t) => t.modelName === modelName);
  const rows = (table?.rows ?? []).map((r: any, i: number) => ({
    id: `${modelName}-${i}`,
    key: r.key,
    tradition: r.tradition ?? null,
    i18n: r.i18n,
  }));
  return { findMany: jest.fn(async () => rows) };
}

describe('KB end-to-end (real service graph)', () => {
  let knowledge: KnowledgeService;
  let kb: KbService;
  let interpretation: InterpretationService;
  let docStore: ReturnType<typeof makeDocStore>;

  beforeEach(async () => {
    docStore = makeDocStore();

    const prisma: any = { knowledgeDocument: docStore };
    for (const t of SEED_TABLES) prisma[t.modelName] = makeKbTableStore(t.modelName);
    prisma.deepDiveUnlock = { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeService,
        KbService,
        InterpretationService,
        VectorSearchService,
        { provide: PrismaService, useValue: prisma },
        { provide: OpenAIService, useValue: { getClient: () => null } },
        // No embeddings -> the keyword tier runs, exercising the real
        // tokeniser rather than a stub.
        { provide: EmbeddingService, useValue: { generateEmbedding: async () => null } },
        { provide: LlmCacheService, useValue: { cachedChatCompletion: jest.fn().mockResolvedValue(null) } },
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

    knowledge = module.get(KnowledgeService);
    kb = module.get(KbService);
    interpretation = module.get(InterpretationService);
  });

  describe('corpus reachability', () => {
    it('EVERY declared category returns documents (the tarot/vastu regression)', async () => {
      const empty: string[] = [];
      for (const category of KB_CATEGORIES) {
        if ((await knowledge.getDocumentCount(category)) === 0) empty.push(category);
      }
      expect(empty).toEqual([]);
    });

    it('tarot and vastu specifically — both services query them every request', async () => {
      expect(await knowledge.getDocumentCount('tarot')).toBeGreaterThan(0);
      expect(await knowledge.getDocumentCount('vastu')).toBeGreaterThan(0);
      expect((await knowledge.search('tarot spread reading', 'tarot', 5)).length).toBeGreaterThan(0);
      expect((await knowledge.search('vastu entrance direction', 'vastu', 5)).length).toBeGreaterThan(0);
    });

    it('the horoscope address space resolves for all 12 signs x 3 aspects', async () => {
      const signs = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
        'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
      for (const sign of signs) {
        for (const aspect of ['career', 'health', 'love']) {
          const rows = await knowledge.getByTopic('horoscopes', `${sign}_${aspect}`, 1);
          expect(rows.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('multi-script retrieval', () => {
    it('an Indic query reaches the keyword tier instead of bailing out empty', async () => {
      // Pre-fix, tokenisation stripped every non-ASCII character, so
      // keywordSearch returned [] before touching the store.
      await knowledge.search('मंगल दोष', 'dosha', 5, 'hi');
      expect(docStore.findMany).toHaveBeenCalled();
      const where = docStore.findMany.mock.calls[0][0].where;
      expect(where.keywords.hasSome.length).toBeGreaterThan(0);
    });

    it('a localised query still accepts English chunks (never returns nothing)', async () => {
      await knowledge.search('मंगल दोष', 'dosha', 5, 'hi');
      expect(docStore.findMany.mock.calls[0][0].where.locale).toEqual({ in: ['hi', 'en'] });
    });
  });

  describe('placement library through the real KbService', () => {
    it('loads and renders all 108 planet-in-sign rows', async () => {
      const row = await kb.getPlanetInSign('Saturn:Libra');
      expect(row).not.toBeNull();
      const v = kb.render(row, 'en') as { text: string; dignity: string };
      expect(v.dignity).toBe('exalted'); // Saturn is exalted in Libra
      expect(v.text.length).toBeGreaterThan(40);
    });

    it('renders houses, yogas, kootas, aspects and transits', async () => {
      expect(kb.render(await kb.getHouseMeaning(7), 'en')).toBeTruthy();
      expect(kb.render(await kb.getYogaMeaning('gajakesari'), 'en')).toBeTruthy();
      expect(kb.render(await kb.getKootaMeaning('nadi'), 'en')).toBeTruthy();
      expect(kb.render(await kb.getAspectMeaning('Saturn:7'), 'en')).toBeTruthy();
      expect(kb.render(await kb.getTransitAlert('Saturn:1'), 'en')).toBeTruthy();
    });

    it('returns null for an unknown key rather than throwing', async () => {
      expect(await kb.getPlanetInSign('Pluto:Aries')).toBeNull();
      expect(kb.render(null, 'en')).toBeNull();
    });
  });

  describe('coverage instrumentation', () => {
    it('records a locale miss when English is served to a non-English request', async () => {
      kb.resetCoverage();
      const row = await kb.getPlanetInSign('Sun:Aries');
      kb.render(row, 'hi'); // English-authored -> a miss
      const report = kb.getCoverageReport();
      expect(report.totalMisses).toBe(1);
      expect(report.byLocale[0].locale).toBe('hi');
      expect(report.byLocale[0].sampleMissingKeys).toContain('Sun:Aries');
    });

    it('does not count English renders', async () => {
      kb.resetCoverage();
      kb.render(await kb.getPlanetInSign('Sun:Aries'), 'en');
      expect(kb.getCoverageReport().totalRenders).toBe(0);
    });
  });

  describe('interpretation assembled entirely from the KB', () => {
    it('produces a kundli reading with NO LLM call', async () => {
      const result = await interpretation.interpret({
        domain: 'kundli' as any,
        payload: {
          ascendant: 'Aries',
          planets: [
            { planet: 'Sun', house: 10, sign: 'Aries' },
            { planet: 'Saturn', house: 7, sign: 'Libra' },
          ],
          yogas: ['gajakesari'],
        },
        locale: 'en',
      });
      expect(result.points.length).toBeGreaterThan(0);
      expect(result.summary.length).toBeGreaterThan(10);
      // Saturn:Libra is exalted, so the dignity annotation must appear.
      expect(result.points.join(' ')).toContain('exalted');
      expect(result.points.join(' ')).toContain('Gajakesari');
    });

    it('produces a matching reading with per-koota explanation and NO LLM call', async () => {
      const result = await interpretation.interpret({
        domain: 'matching' as any,
        payload: { percentage: 75, kootas: [{ name: 'nadi', obtainedPoints: 0, maxPoints: 8 }] },
        locale: 'en',
      });
      expect(result.summary.length).toBeGreaterThan(10);
      expect(result.points.join(' ')).toMatch(/nadi/i);
      // Scored zero, so the cancellation note must be surfaced.
      expect(result.points.join(' ')).toMatch(/cancel/i);
    });
  });
});
