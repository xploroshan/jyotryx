import { Test, TestingModule } from '@nestjs/testing';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { OpenAIService } from '../src/openai/openai.service';
import { VectorSearchService } from '../src/knowledge/vector-search.service';
import { EmbeddingService } from '../src/ai/embeddings/embedding-service';
import { mockOpenAIService, mockVectorSearchService, mockEmbeddingService } from './helpers/mocks';

describe('KnowledgeService', () => {
  let service: KnowledgeService;
  let prisma: any;

  const mockDocs = [
    { id: 'doc-1', text: 'Mars in 7th house causes Mangal Dosha', category: 'doshas', topic: 'mangal_dosha', source: 'BPHS', keywords: ['mars', 'house', 'mangal', 'dosha'] },
    { id: 'doc-2', text: 'Jupiter in Kendra houses creates Gaja Kesari Yoga', category: 'yogas', topic: 'gaja_kesari', source: 'BPHS', keywords: ['jupiter', 'kendra', 'gaja', 'kesari', 'yoga'] },
    { id: 'doc-3', text: 'Pushya Nakshatra is considered most auspicious for purchases', category: 'nakshatras', topic: 'pushya', source: 'Jyotish', keywords: ['pushya', 'nakshatra', 'auspicious', 'purchases'] },
  ];

  beforeEach(async () => {
    prisma = {
      knowledgeDocument: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 3 }),
        count: jest.fn().mockResolvedValue(100),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeService,
        { provide: PrismaService, useValue: prisma },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: VectorSearchService, useValue: mockVectorSearchService() },
        { provide: EmbeddingService, useValue: mockEmbeddingService() },
      ],
    }).compile();

    service = module.get<KnowledgeService>(KnowledgeService);
  });

  // ─── Search - Positive Tests ────────────────────────────────────

  describe('search', () => {
    it('should return scored results from keyword match', async () => {
      prisma.knowledgeDocument.findMany.mockResolvedValueOnce(mockDocs);

      const results = await service.search('mars mangal dosha');

      expect(prisma.knowledgeDocument.findMany).toHaveBeenCalled();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should filter by category when provided', async () => {
      prisma.knowledgeDocument.findMany.mockResolvedValueOnce([mockDocs[0]]);

      await service.search('mars dosha', 'doshas');

      expect(prisma.knowledgeDocument.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'doshas' }),
        }),
      );
    });

    it('should respect topK parameter', async () => {
      prisma.knowledgeDocument.findMany.mockResolvedValueOnce(mockDocs);

      const results = await service.search('mars dosha', undefined, 2);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should fallback to text search when keyword match fails', async () => {
      prisma.knowledgeDocument.findMany
        .mockResolvedValueOnce([]) // keyword match returns nothing
        .mockResolvedValueOnce([mockDocs[2]]); // text fallback returns result

      const results = await service.search('pushya nakshatra');
      expect(prisma.knowledgeDocument.findMany).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Search - Negative Tests ────────────────────────────────────

  describe('search - edge cases', () => {
    it('should return empty array for empty query', async () => {
      const results = await service.search('');
      expect(results).toEqual([]);
    });

    it('should return empty array for very short words only', async () => {
      const results = await service.search('a b c');
      expect(results).toEqual([]);
    });

    it('should handle query with special characters', async () => {
      prisma.knowledgeDocument.findMany.mockResolvedValueOnce([]);
      const results = await service.search('mars!@#$%dosha');
      expect(Array.isArray(results)).toBe(true);
    });
  });

  // ─── getByTopic ─────────────────────────────────────────────────

  describe('getByTopic', () => {
    it('should query by category and topic', async () => {
      prisma.knowledgeDocument.findMany.mockResolvedValueOnce([mockDocs[0]]);

      const results = await service.getByTopic('doshas', 'mangal_dosha');

      expect(results.length).toBe(1);
      expect(results[0].score).toBe(1.0);
    });

    it('should respect limit parameter', async () => {
      prisma.knowledgeDocument.findMany.mockResolvedValueOnce([]);

      await service.getByTopic('doshas', 'mangal_dosha', 5);

      expect(prisma.knowledgeDocument.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });

  // ─── getByCategory ──────────────────────────────────────────────

  describe('getByCategory', () => {
    it('should query by category', async () => {
      prisma.knowledgeDocument.findMany.mockResolvedValueOnce(mockDocs);

      const results = await service.getByCategory('doshas');

      expect(results.length).toBe(3);
    });
  });

  // ─── assembleContext ────────────────────────────────────────────

  describe('assembleContext', () => {
    it('should join results with source tags', () => {
      const results = [
        { id: '1', text: 'Result one', category: 'test', topic: null, source: 'BPHS', score: 1 },
        { id: '2', text: 'Result two', category: 'test', topic: null, source: null, score: 0.5 },
      ];

      const context = service.assembleContext(results);
      expect(context).toContain('Result one');
      expect(context).toContain('[BPHS]');
      expect(context).toContain('Result two');
    });

    it('should return empty string for no results', () => {
      expect(service.assembleContext([])).toBe('');
    });
  });

  // ─── addDocuments ───────────────────────────────────────────────

  describe('addDocuments', () => {
    it('should bulk add documents in batches', async () => {
      const items = Array.from({ length: 60 }, (_, i) => ({
        text: `Document ${i}`,
        category: 'test',
        topic: 'test_topic',
        source: 'test',
      }));

      const count = await service.addDocuments(items);
      // Called twice: 50 + 10
      expect(prisma.knowledgeDocument.createMany).toHaveBeenCalledTimes(2);
    });
  });

  // ─── getDocumentCount ───────────────────────────────────────────

  describe('getDocumentCount', () => {
    it('should return total count', async () => {
      const count = await service.getDocumentCount();
      expect(count).toBe(100);
    });

    it('should filter by category', async () => {
      await service.getDocumentCount('doshas');
      expect(prisma.knowledgeDocument.count).toHaveBeenCalledWith({
        where: { category: 'doshas' },
      });
    });
  });
});
