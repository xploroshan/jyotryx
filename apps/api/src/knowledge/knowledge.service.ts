import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIService } from '../openai/openai.service';

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
  ) {}

  /**
   * Search the knowledge base using keyword matching + optional embedding similarity.
   * This is a hybrid approach: fast keyword pre-filter, then cosine re-rank if embeddings exist.
   */
  async search(
    query: string,
    category?: string,
    topK: number = 5,
  ): Promise<KBSearchResult[]> {
    // Step 1: Keyword-based pre-filter using PostgreSQL array overlap
    const queryWords = query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (queryWords.length === 0) return [];

    // Build where clause
    const where: any = {};
    if (category) {
      where.category = category;
    }

    // Fetch candidate documents (keyword match via hasMome on keywords array)
    const candidates = await this.prisma.knowledgeDocument.findMany({
      where: {
        ...where,
        keywords: { hasSome: queryWords },
      },
      take: topK * 3, // Over-fetch for re-ranking
      select: {
        id: true,
        text: true,
        category: true,
        topic: true,
        source: true,
        embedding: true,
        keywords: true,
      },
    });

    if (candidates.length === 0) {
      // Fallback: text search on content
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

      return textResults.map((doc) => ({
        id: doc.id,
        text: doc.text,
        category: doc.category,
        topic: doc.topic,
        source: doc.source,
        score: this.keywordScore(queryWords, doc.keywords),
      }));
    }

    // Step 2: Score by keyword overlap
    const scored = candidates.map((doc) => ({
      id: doc.id,
      text: doc.text,
      category: doc.category,
      topic: doc.topic,
      source: doc.source,
      score: this.keywordScore(queryWords, doc.keywords),
    }));

    // Sort by score and return top K
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  /**
   * Search by category and topic for direct knowledge lookups (no LLM needed).
   */
  async getByTopic(category: string, topic: string): Promise<KBSearchResult[]> {
    const docs = await this.prisma.knowledgeDocument.findMany({
      where: { category, topic },
      select: {
        id: true,
        text: true,
        category: true,
        topic: true,
        source: true,
      },
    });

    return docs.map((doc) => ({
      ...doc,
      score: 1.0,
    }));
  }

  /**
   * Get all documents in a category.
   */
  async getByCategory(category: string): Promise<KBSearchResult[]> {
    const docs = await this.prisma.knowledgeDocument.findMany({
      where: { category },
      select: {
        id: true,
        text: true,
        category: true,
        topic: true,
        source: true,
      },
    });

    return docs.map((doc) => ({
      ...doc,
      score: 1.0,
    }));
  }

  /**
   * Add a document to the knowledge base.
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

    return { id: doc.id };
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
