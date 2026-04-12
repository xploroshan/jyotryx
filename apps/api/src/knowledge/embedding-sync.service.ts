import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmbeddingSyncService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // Run embedding backfill in background (non-blocking)
    this.backfillEmbeddings().catch((err) =>
      this.logger.error('Embedding backfill failed', err.message),
    );
  }

  /**
   * Backfill embeddings for documents that don't have them yet.
   * Uses OpenAI's text-embedding-3-small model via the embedding service.
   * Processes in batches to avoid overwhelming the API.
   */
  async backfillEmbeddings(): Promise<number> {
    let openaiLib: any;
    try {
      openaiLib = require('openai');
    } catch {
      this.logger.warn('openai package not available, skipping embedding backfill');
      return 0;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY not set, skipping embedding backfill');
      return 0;
    }

    // Check if pgvector is available
    try {
      await this.prisma.$queryRawUnsafe(`SELECT 1 FROM pg_extension WHERE extname = 'vector'`);
    } catch {
      this.logger.warn('pgvector extension not available, skipping backfill');
      return 0;
    }

    const client = new openaiLib({ apiKey });
    const BATCH_SIZE = 50;
    let totalProcessed = 0;

    // Process in batches
    while (true) {
      const docs: { id: string; text: string }[] = await this.prisma.$queryRawUnsafe(
        `SELECT id, text FROM knowledge_documents
         WHERE embedding_vec IS NULL
         LIMIT $1`,
        BATCH_SIZE,
      );

      if (docs.length === 0) break;

      try {
        const texts = docs.map((d) => d.text.replace(/\n/g, ' ').trim());
        const response = await client.embeddings.create({
          model: 'text-embedding-3-small',
          input: texts,
        });

        const sorted = response.data.sort((a: any, b: any) => a.index - b.index);

        // Update each document's vector
        for (let i = 0; i < docs.length; i++) {
          const vecString = `[${sorted[i].embedding.join(',')}]`;
          await this.prisma.$queryRawUnsafe(
            `UPDATE knowledge_documents SET embedding_vec = $1::vector WHERE id = $2::uuid`,
            vecString,
            docs[i].id,
          );
        }

        totalProcessed += docs.length;
        this.logger.log(`Backfilled embeddings for ${totalProcessed} documents`);
      } catch (err) {
        this.logger.error(`Embedding batch failed: ${(err as Error).message}`);
        break;
      }
    }

    if (totalProcessed > 0) {
      this.logger.log(`Embedding backfill complete: ${totalProcessed} documents processed`);
    }
    return totalProcessed;
  }
}
