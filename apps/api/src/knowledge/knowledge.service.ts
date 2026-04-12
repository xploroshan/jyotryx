import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIService } from '../openai/openai.service';
import { VectorSearchService } from './vector-search.service';
import { EmbeddingService } from '../ai/embeddings/embedding-service';

export interface KBSearchResult {
  id: string;
  text: string;
  category: string;
  topic: string | null;
  source: string | null;
  score: number;
}

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openaiService: OpenAIService,
    private readonly vectorSearchService: VectorSearchService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  /**
   * Hybrid search: vector similarity first, fill remaining slots with keyword search.
   * Falls back to keyword-only if embedding generation fails.
   */
  async search(
    query: string,
    category?: string,
    topK: number = 5,
  ): Promise<KBSearchResult[]> {
    const results: KBSearchResult[] = [];
    const seenIds = new Set<string>();

    // Step 1: Try vector search first
    try {
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);
      if (queryEmbedding) {
        const vectorResults = await this.vectorSearchService.searchByVector(
          queryEmbedding,
          category,
          topK,
        );
        for (const r of vectorResults) {
          if (r.score > 0.3) {
            results.push(r);
            seenIds.add(r.id);
          }
        }
      }
    } catch (err) {
      this.logger.warn(`Vector search failed, falling back to keyword: ${(err as Error).message}`);
    }

    // Step 2: Fill remaining slots with keyword search
    if (results.length < topK) {
      const keywordResults = await this.keywordSearch(query, category, topK - results.length);
      for (const r of keywordResults) {
        if (!seenIds.has(r.id)) {
          results.push(r);
          seenIds.add(r.id);
        }
      }
    }

    return results.slice(0, topK);
  }

  /**
   * Keyword-based search using PostgreSQL array overlap.
   */
  private async keywordSearch(
    query: string,
    category?: string,
    topK: number = 5,
  ): Promise<KBSearchResult[]> {
    const queryWords = query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (queryWords.length === 0) return [];

    const where: any = {};
    if (category) {
      where.category = category;
    }

    const candidates = await this.prisma.knowledgeDocument.findMany({
      where: {
        ...where,
        keywords: { hasSome: queryWords },
      },
      take: topK * 3,
      select: {
        id: true,
        text: true,
        category: true,
        topic: true,
        source: true,
        keywords: true,
      },
    });

    if (candidates.length === 0) {
      const textResults = await this.prisma.knowledgeDocument.findMany({
        where: {
          ...where,
          text: { contains: queryWords[0], mode: 'insensitive' },
        },
        take: topK,
        select: {
          id: true,
          text: true,
          category: true,
          topic: true,
          source: true,
          keywords: true,
        },
      });

      return textResults.map((doc: any) => ({
        id: doc.id,
        text: doc.text,
        category: doc.category,
        topic: doc.topic,
        source: doc.source,
        score: this.keywordScore(queryWords, doc.keywords),
      }));
    }

    const scored = candidates.map((doc: any) => ({
      id: doc.id,
      text: doc.text,
      category: doc.category,
      topic: doc.topic,
      source: doc.source,
      score: this.keywordScore(queryWords, doc.keywords),
    }));

    scored.sort((a: any, b: any) => b.score - a.score);
    return scored.slice(0, topK);
  }

  /**
   * Search by category and topic for direct knowledge lookups (no LLM needed).
   */
  async getByTopic(category: string, topic: string, limit: number = 50): Promise<KBSearchResult[]> {
    const docs = await this.prisma.knowledgeDocument.findMany({
      where: { category, topic },
      take: limit,
      select: {
        id: true,
        text: true,
        category: true,
        topic: true,
        source: true,
      },
    });

    return docs.map((doc: any) => ({
      ...doc,
      score: 1.0,
    }));
  }

  /**
   * Get all documents in a category.
   */
  async getByCategory(category: string, limit: number = 100): Promise<KBSearchResult[]> {
    const docs = await this.prisma.knowledgeDocument.findMany({
      where: { category },
      take: limit,
      select: {
        id: true,
        text: true,
        category: true,
        topic: true,
        source: true,
      },
    });

    return docs.map((doc: any) => ({
      ...doc,
      score: 1.0,
    }));
  }

  /**
   * Add a document to the knowledge base with optional vector embedding.
   */
  async addDocument(
    text: string,
    category: string,
    topic?: string,
    source?: string,
  ): Promise<{ id: string }> {
    const keywords = this.extractKeywords(text);

    const doc = await this.prisma.knowledgeDocument.create({
      data: {
        text,
        category,
        topic,
        source,
        keywords,
      },
    });

    // Generate and store embedding asynchronously (non-blocking)
    this.generateAndStoreEmbedding(doc.id, text).catch((err) =>
      this.logger.warn(`Failed to generate embedding for doc ${doc.id}: ${(err as Error).message}`),
    );

    return { id: doc.id };
  }

  private async generateAndStoreEmbedding(docId: string, text: string): Promise<void> {
    const embedding = await this.embeddingService.generateEmbedding(text);
    if (!embedding) return;

    const vecString = `[${embedding.join(',')}]`;
    await this.prisma.$queryRawUnsafe(
      `UPDATE knowledge_documents SET embedding_vec = $1::vector WHERE id = $2::uuid`,
      vecString,
      docId,
    );
  }

  /**
   * Bulk add documents (for seeding).
   */
  async addDocuments(
    items: Array<{
      text: string;
      category: string;
      topic?: string;
      source?: string;
    }>,
  ): Promise<number> {
    let count = 0;
    // Use batches to avoid overwhelming the DB
    const batchSize = 50;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const data = batch.map((item) => ({
        text: item.text,
        category: item.category,
        topic: item.topic,
        source: item.source,
        keywords: this.extractKeywords(item.text),
      }));

      const result = await this.prisma.knowledgeDocument.createMany({ data });
      count += result.count;
    }

    this.logger.log(`Added ${count} documents to knowledge base`);
    return count;
  }

  /**
   * Get document count, optionally by category.
   */
  async getDocumentCount(category?: string): Promise<number> {
    return this.prisma.knowledgeDocument.count({
      where: category ? { category } : undefined,
    });
  }

  /**
   * Assemble RAG context from search results for injection into LLM prompts.
   */
  assembleContext(results: KBSearchResult[]): string {
    if (results.length === 0) return '';

    const parts = results.map((r) => {
      const sourceTag = r.source ? ` [${r.source}]` : '';
      return `${r.text}${sourceTag}`;
    });

    return parts.join('\n\n');
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private keywordScore(queryWords: string[], docKeywords: string[]): number {
    if (queryWords.length === 0) return 0;
    const docSet = new Set(docKeywords.map((k) => k.toLowerCase()));
    const matches = queryWords.filter((w) => docSet.has(w)).length;
    return matches / queryWords.length;
  }

  private extractKeywords(text: string): string[] {
    // Vedic astrology stop words to exclude
    const stopWords = new Set([
      'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'shall', 'can', 'a', 'an',
      'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
      'with', 'by', 'from', 'this', 'that', 'these', 'those', 'it',
      'its', 'they', 'them', 'their', 'we', 'our', 'you', 'your',
      'he', 'she', 'his', 'her', 'not', 'no', 'nor', 'if', 'then',
      'than', 'when', 'where', 'which', 'who', 'whom', 'how', 'what',
      'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
      'some', 'such', 'only', 'very', 'also', 'just', 'about',
    ]);

    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));

    // Deduplicate and take top 30
    return [...new Set(words)].slice(0, 30);
  }
}
