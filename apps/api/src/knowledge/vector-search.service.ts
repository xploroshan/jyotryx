import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface VectorSearchResult {
  id: string;
  text: string;
  category: string;
  topic: string | null;
  source: string | null;
  score: number;
}

@Injectable()
export class VectorSearchService {
  private readonly logger = new Logger(VectorSearchService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Search knowledge documents by vector similarity using pgvector.
   * Uses cosine distance operator (<=>).
   */
  async searchByVector(
    queryEmbedding: number[],
    category?: string,
    topK = 5,
    locale?: string,
  ): Promise<VectorSearchResult[]> {
    const vecString = `[${queryEmbedding.join(',')}]`;

    // Build the filter incrementally so the parameter positions stay correct
    // for every combination of category/locale rather than duplicating the
    // query per case (which is how the two-branch version drifted).
    const conditions: string[] = ['embedding_vec IS NOT NULL'];
    const params: unknown[] = [vecString];
    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }
    // Prefer the requested locale but always keep English: an untranslated
    // corpus must still ground the answer. No-op while every row is 'en'.
    const norm = (locale ?? 'en').toLowerCase();
    if (norm !== 'en') {
      params.push(norm);
      conditions.push(`locale IN ($${params.length}, 'en')`);
    }
    params.push(topK);
    const limitPos = params.length;

    try {
      const results: VectorSearchResult[] = await this.prisma.$queryRawUnsafe(
        `SELECT id, text, category, topic, source,
                1 - (embedding_vec <=> $1::vector) as score
         FROM knowledge_documents
         WHERE ${conditions.join(' AND ')}
         ORDER BY embedding_vec <=> $1::vector
         LIMIT $${limitPos}`,
        ...params,
      );

      return results.map((r) => ({
        ...r,
        score: Number(r.score),
      }));
    } catch (err) {
      this.logger.error('Vector search failed (pgvector may not be enabled)', (err as Error).message);
      return [];
    }
  }
}
