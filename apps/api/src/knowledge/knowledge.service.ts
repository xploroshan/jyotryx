import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIService } from '../openai/openai.service';
import { VectorSearchService } from './vector-search.service';
import { EmbeddingService } from '../ai/embeddings/embedding-service';
import { extractKeywords, tokenizeQuery } from './keywords.util';
import type { KbCategory } from './kb-categories';

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
  /**
   * Retrieve grounding chunks.
   *
   * `locale` prefers same-language chunks and falls back to English when the
   * corpus has none — so a Hindi query grounds on Hindi text once translated
   * chunks exist, and behaves exactly as before until then. Never returns
   * empty purely because a locale is untranslated.
   */
  async search(
    query: string,
    category?: KbCategory,
    topK: number = 5,
    locale?: string,
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
          locale,
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
      const keywordResults = await this.keywordSearch(query, category, topK - results.length, locale);
      for (const r of keywordResults) {
        if (!seenIds.has(r.id)) {
          results.push(r);
          seenIds.add(r.id);
        }
      }
    }

    if (results.length === 0 && category) {
      // Distinguish "this query matched nothing" (fine) from "this category
      // holds no rows at all" (a config/seed bug that silently ungrounds the
      // caller). The latter is how tarot/vastu ran unseeded and how the four
      // wrong chat category names went unnoticed. Checked once per category
      // per process, so this costs one COUNT on first miss.
      void this.warnIfCategoryEmpty(category);
    }

    return results.slice(0, topK);
  }

  /** Categories already checked for emptiness — one DB COUNT per process. */
  private readonly emptyCategoryChecked = new Set<string>();

  private async warnIfCategoryEmpty(category: KbCategory): Promise<void> {
    if (this.emptyCategoryChecked.has(category)) return;
    this.emptyCategoryChecked.add(category);
    try {
      const count = await this.getDocumentCount(category);
      if (count === 0) {
        this.logger.error(
          `KB category "${category}" has ZERO documents — every lookup against it ` +
            'returns no grounding and the caller falls back to ungrounded output. ' +
            'Run `npm run kb:sync` to backfill the seed corpus.',
        );
      }
    } catch {
      // Never let an observability check break a request.
    }
  }

  /**
   * Keyword-based search using PostgreSQL array overlap.
   */
  private async keywordSearch(
    query: string,
    category?: KbCategory,
    topK: number = 5,
    locale?: string,
  ): Promise<KBSearchResult[]> {
    const queryWords = tokenizeQuery(query);

    if (queryWords.length === 0) return [];

    const where: any = {};
    if (category) {
      where.category = category;
    }

    // Prefer the requested locale, but never exclude English — an
    // untranslated corpus must still ground the answer rather than
    // returning nothing.
    const norm = (locale ?? 'en').toLowerCase();
    if (norm !== 'en') where.locale = { in: [norm, 'en'] };

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
  async getByTopic(category: KbCategory, topic: string, limit: number = 50): Promise<KBSearchResult[]> {
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
  async getByCategory(category: KbCategory, limit: number = 100): Promise<KBSearchResult[]> {
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
    const keywords = extractKeywords(text);

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
        keywords: extractKeywords(item.text),
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

}
