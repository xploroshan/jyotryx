/**
 * Embedding Service
 *
 * Generates vector embeddings using the OpenAI Embeddings API.
 * Used by the RAG pipeline to convert text into vectors for
 * similarity search in the knowledge base.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from "openai";

export interface EmbeddingResult {
  embedding: number[];
  tokensUsed: number;
}

export interface BatchEmbeddingResult {
  embeddings: number[][];
  totalTokensUsed: number;
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly openai: OpenAI | null;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('openai.apiKey') || process.env.OPENAI_API_KEY;
    this.model = 'text-embedding-3-small';
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    } else {
      this.openai = null;
      this.logger.warn('OPENAI_API_KEY not configured — embedding generation disabled');
    }
  }

  /**
   * Generate an embedding vector for a single text string.
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    if (!this.openai) return null;

    const sanitized = text.replace(/\n/g, " ").trim();

    const response = await this.openai.embeddings.create({
      model: this.model,
      input: sanitized,
    });

    return response.data[0].embedding;
  }

  /**
   * Generate embedding vectors for multiple texts in a single API call.
   * OpenAI supports batching up to 2048 inputs per request.
   */
  async generateBatchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult | null> {
    if (!this.openai) return null;
    if (texts.length === 0) {
      return { embeddings: [], totalTokensUsed: 0 };
    }

    const sanitized = texts.map((t) => t.replace(/\n/g, " ").trim());

    // OpenAI allows up to 2048 inputs per batch; chunk if needed
    const BATCH_LIMIT = 2048;
    const allEmbeddings: number[][] = [];
    let totalTokens = 0;

    for (let i = 0; i < sanitized.length; i += BATCH_LIMIT) {
      const batch = sanitized.slice(i, i + BATCH_LIMIT);

      const response = await this.openai.embeddings.create({
        model: this.model,
        input: batch,
      });

      // Ensure results are in the correct order
      const sorted = response.data.sort((a, b) => a.index - b.index);
      allEmbeddings.push(...sorted.map((d) => d.embedding));
      totalTokens += response.usage.total_tokens;
    }

    return {
      embeddings: allEmbeddings,
      totalTokensUsed: totalTokens,
    };
  }

  /**
   * Generate an embedding and return it alongside token usage metadata.
   */
  async generateEmbeddingWithMetadata(text: string): Promise<EmbeddingResult | null> {
    if (!this.openai) return null;

    const sanitized = text.replace(/\n/g, " ").trim();

    const response = await this.openai.embeddings.create({
      model: this.model,
      input: sanitized,
    });

    return {
      embedding: response.data[0].embedding,
      tokensUsed: response.usage.total_tokens,
    };
  }

  /**
   * Compute cosine similarity between two embedding vectors.
   * Useful for client-side re-ranking or threshold filtering.
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Vectors must have the same length");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}
