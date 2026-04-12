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
  ): Promise<VectorSearchResult[]> {
    const vecString = `[${queryEmbedding.join(',')}]`;

    try {
      const results: VectorSearchResult[] = category
        ? await this.prisma.$queryRawUnsafe(
            `SELECT id, text, category, topic, source,
                    1 - (embedding_vec <=> $1::vector) as score
             FROM knowledge_documents
             WHERE embedding_vec IS NOT NULL AND category = $2
             ORDER BY embedding_vec <=> $1::vector
             LIMIT $3`,
            vecString,
            category,
            topK,
          )
        : await this.prisma.$queryRawUnsafe(
            `SELECT id, text, category, topic, source,
                    1 - (embedding_vec <=> $1::vector) as score
             FROM knowledge_documents
             WHERE embedding_vec IS NOT NULL
             ORDER BY embedding_vec <=> $1::vector
             LIMIT $2`,
            vecString,
            topK,
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
