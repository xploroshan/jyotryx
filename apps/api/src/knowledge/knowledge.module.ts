import { Module } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeController } from './knowledge.controller';
import { VectorSearchService } from './vector-search.service';
import { EmbeddingSyncService } from './embedding-sync.service';
import { EmbeddingService } from '../ai/embeddings/embedding-service';

@Module({
  providers: [KnowledgeService, VectorSearchService, EmbeddingSyncService, EmbeddingService],
  controllers: [KnowledgeController],
  exports: [KnowledgeService, VectorSearchService, EmbeddingService],
})
export class KnowledgeModule {}
