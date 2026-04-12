import { Test, TestingModule } from '@nestjs/testing';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { VectorSearchService } from '../src/knowledge/vector-search.service';
import { EmbeddingService } from '../src/ai/embeddings/embedding-service';
import { PrismaService } from '../src/prisma/prisma.service';
import { OpenAIService } from '../src/openai/openai.service';
import { ConfigService } from '@nestjs/config';
import { mockOpenAIService, mockConfigService } from './helpers/mocks';

describe('KnowledgeService — pgvector Hybrid RAG (Item 8)', () => {
  let service: KnowledgeService;
  let vectorSearch: any;
  let embeddingService: any;
  let prisma: any;

  beforeEach(async () => {
    vectorSearch = {
      searchByVector: jest.fn().mockResolvedValue([]),
    };

    embeddingService = {
      generateEmbedding: jest.fn().mockResolvedValue(new Array(1536).fill(0.1)),
      generateBatchEmbeddings: jest.fn().mockResolvedValue({ embeddings: [], totalTokensUsed: 0 }),
    };

    prisma = {
      knowledgeDocument: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'doc-new' }),
        createMany: jest.fn().mockResolvedValue({ count: 5 }),
        count: jest.fn().mockResolvedValue(42),
      },
      $queryRawUnsafe: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeService,
        { provide: VectorSearchService, useValue: vectorSearch },
        { provide: EmbeddingService, useValue: embeddingService },
        { provide: PrismaService, useValue: prisma },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: ConfigService, useValue: mockConfigService() },
      ],
    }).compile();

    service = module.get<KnowledgeService>(KnowledgeService);
  });

  describe('search — hybrid vector + keyword', () => {
    it('should try vector search first', async () => {
      vectorSearch.searchByVector.mockResolvedValue([
        { id: 'v1', text: 'Vector result', category: 'planets', topic: null, source: null, score: 0.85 },
      ]);

      const results = await service.search('Mars in 7th house', 'planets', 5);

      expect(embeddingService.generateEmbedding).toHaveBeenCalledWith('Mars in 7th house');
      expect(vectorSearch.searchByVector).toHaveBeenCalled();
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('v1');
    });

    it('should fill remaining slots with keyword search after vector', async () => {
      vectorSearch.searchByVector.mockResolvedValue([
        { id: 'v1', text: 'Vector 1', category: 'planets', topic: null, source: null, score: 0.8 },
      ]);
      prisma.knowledgeDocument.findMany.mockResolvedValue([
        { id: 'k1', text: 'Keyword 1', category: 'planets', topic: null, source: null, keywords: ['mars', 'house'] },
      ]);

      const results = await service.search('Mars placement', 'planets', 5);

      expect(results.length).toBe(2);
    });

    it('should deduplicate results across vector and keyword', async () => {
      vectorSearch.searchByVector.mockResolvedValue([
        { id: 'same-id', text: 'Same doc', category: 'planets', topic: null, source: null, score: 0.9 },
      ]);
      prisma.knowledgeDocument.findMany.mockResolvedValue([
        { id: 'same-id', text: 'Same doc', category: 'planets', topic: null, source: null, keywords: ['planets'] },
      ]);

      const results = await service.search('planets', 'planets', 5);

      const ids = results.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('should fall back to keyword search when embedding fails', async () => {
      embeddingService.generateEmbedding.mockRejectedValue(new Error('API unavailable'));
      prisma.knowledgeDocument.findMany.mockResolvedValue([
        { id: 'k1', text: 'Keyword result', category: 'remedies', topic: null, source: null, keywords: ['remedy', 'saturn'] },
      ]);

      const results = await service.search('Saturn remedy', 'remedies', 5);

      expect(results.length).toBe(1);
      expect(results[0].id).toBe('k1');
    });

    it('should filter low-score vector results (< 0.3)', async () => {
      vectorSearch.searchByVector.mockResolvedValue([
        { id: 'low', text: 'Low score', category: 'planets', topic: null, source: null, score: 0.1 },
        { id: 'high', text: 'High score', category: 'planets', topic: null, source: null, score: 0.8 },
      ]);

      const results = await service.search('test query', 'planets', 5);

      expect(results.find((r) => r.id === 'low')).toBeUndefined();
      expect(results.find((r) => r.id === 'high')).toBeDefined();
    });
  });

  describe('addDocument — embedding at insertion', () => {
    it('should create document and generate embedding asynchronously', async () => {
      prisma.knowledgeDocument.create.mockResolvedValue({ id: 'new-doc' });

      const result = await service.addDocument('Mars in 7th house causes Mangal Dosha', 'doshas', 'mangal_dosha', 'BPHS');

      expect(result.id).toBe('new-doc');
      expect(prisma.knowledgeDocument.create).toHaveBeenCalled();
      // Embedding is generated asynchronously — give it a tick
      await new Promise((r) => setTimeout(r, 50));
      expect(embeddingService.generateEmbedding).toHaveBeenCalled();
    });

    it('should not block on embedding failure', async () => {
      prisma.knowledgeDocument.create.mockResolvedValue({ id: 'new-doc' });
      embeddingService.generateEmbedding.mockRejectedValue(new Error('API error'));

      const result = await service.addDocument('Test text', 'general');

      expect(result.id).toBe('new-doc');
      // Should not throw even if embedding fails
    });
  });

  describe('assembleContext', () => {
    it('should join results with source tags', () => {
      const results = [
        { id: '1', text: 'First text', category: 'planets', topic: null, source: 'BPHS', score: 0.9 },
        { id: '2', text: 'Second text', category: 'planets', topic: null, source: null, score: 0.8 },
      ];

      const context = service.assembleContext(results);

      expect(context).toContain('First text [BPHS]');
      expect(context).toContain('Second text');
      expect(context).not.toContain('[null]');
    });

    it('should return empty string for empty results', () => {
      expect(service.assembleContext([])).toBe('');
    });
  });
});

describe('VectorSearchService', () => {
  let vectorService: VectorSearchService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VectorSearchService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    vectorService = module.get<VectorSearchService>(VectorSearchService);
  });

  it('should execute vector similarity SQL with cosine distance', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([
      { id: 'doc-1', text: 'Result', category: 'planets', topic: null, source: null, score: '0.85' },
    ]);

    const embedding = new Array(1536).fill(0.1);
    const results = await vectorService.searchByVector(embedding, 'planets', 5);

    expect(results.length).toBe(1);
    expect(results[0].score).toBe(0.85);
    const sql = prisma.$queryRawUnsafe.mock.calls[0][0];
    expect(sql).toContain('<=>');
    expect(sql).toContain('vector');
  });

  it('should return empty array when pgvector is not available', async () => {
    prisma.$queryRawUnsafe.mockRejectedValue(new Error('type "vector" does not exist'));

    const results = await vectorService.searchByVector(new Array(1536).fill(0), undefined, 5);

    expect(results).toEqual([]);
  });
});
