/**
 * Locale-aware retrieval from the vector KB.
 *
 * The corpus is English-authored and `knowledge_documents` had no locale
 * column at all, so a Hindi chat query retrieved English chunks which were
 * then handed to a model instructed to answer in Hindi. That works, but it
 * grounds the answer in a language the user did not ask for.
 *
 * The contract these tests pin is deliberately asymmetric: prefer the
 * requested locale, but NEVER exclude English — an untranslated corpus must
 * still ground the answer rather than returning nothing. Until translated
 * chunks are inserted, behaviour is identical to before.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { VectorSearchService } from '../src/knowledge/vector-search.service';
import { EmbeddingService } from '../src/ai/embeddings/embedding-service';
import { PrismaService } from '../src/prisma/prisma.service';
import { OpenAIService } from '../src/openai/openai.service';

describe('locale-aware KB retrieval', () => {
  let service: KnowledgeService;
  let prisma: any;
  let vector: any;
  let embedding: any;

  beforeEach(async () => {
    prisma = {
      knowledgeDocument: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(10),
      },
    };
    // Force the keyword tier: no embedding => vector tier is skipped.
    embedding = { generateEmbedding: jest.fn().mockResolvedValue(null) };
    vector = { searchByVector: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeService,
        { provide: PrismaService, useValue: prisma },
        { provide: OpenAIService, useValue: { getClient: jest.fn().mockReturnValue(null) } },
        { provide: VectorSearchService, useValue: vector },
        { provide: EmbeddingService, useValue: embedding },
      ],
    }).compile();
    service = module.get(KnowledgeService);
  });

  const whereOf = () => prisma.knowledgeDocument.findMany.mock.calls[0][0].where;

  describe('keyword tier', () => {
    it('does not constrain locale for an English request (no behaviour change)', async () => {
      await service.search('mangal dosha', 'dosha', 5, 'en');
      expect(whereOf().locale).toBeUndefined();
    });

    it('treats an absent locale as English', async () => {
      await service.search('mangal dosha', 'dosha', 5);
      expect(whereOf().locale).toBeUndefined();
    });

    it('accepts the requested locale AND English — never English-only, never locale-only', async () => {
      await service.search('मंगल दोष', 'dosha', 5, 'hi');
      // locale-only would return nothing on an untranslated corpus;
      // English-only would ignore translations once they exist.
      expect(whereOf().locale).toEqual({ in: ['hi', 'en'] });
    });

    it('normalises locale case', async () => {
      await service.search('मंगल दोष', 'dosha', 5, 'HI');
      expect(whereOf().locale).toEqual({ in: ['hi', 'en'] });
    });

    it('still applies the category filter alongside locale', async () => {
      await service.search('मंगल दोष', 'dosha', 5, 'ta');
      expect(whereOf().category).toBe('dosha');
      expect(whereOf().locale).toEqual({ in: ['ta', 'en'] });
    });
  });

  describe('vector tier', () => {
    beforeEach(() => {
      embedding.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
    });

    it('forwards the locale so translated chunks can be preferred', async () => {
      await service.search('मंगल दोष', 'dosha', 5, 'hi');
      expect(vector.searchByVector).toHaveBeenCalledWith([0.1, 0.2, 0.3], 'dosha', 5, 'hi');
    });

    it('forwards undefined for an English request', async () => {
      await service.search('mangal dosha', 'dosha', 5);
      expect(vector.searchByVector).toHaveBeenCalledWith([0.1, 0.2, 0.3], 'dosha', 5, undefined);
    });

    it('falls back to the keyword tier when the vector tier throws', async () => {
      vector.searchByVector.mockRejectedValue(new Error('pgvector down'));
      await expect(service.search('मंगल दोष', 'dosha', 5, 'hi')).resolves.toEqual([]);
      expect(prisma.knowledgeDocument.findMany).toHaveBeenCalled();
    });
  });
});
