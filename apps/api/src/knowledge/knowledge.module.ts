import { Module } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeController } from './knowledge.controller';
import { VectorSearchService } from './vector-search.service';
import { EmbeddingSyncService } from './embedding-sync.service';
import { EmbeddingService } from '../ai/embeddings/embedding-service';
import { KbService } from './kb.service';

@Module({
  providers: [KnowledgeService, VectorSearchService, EmbeddingSyncService, EmbeddingService, KbService],
  controllers: [KnowledgeController],
  exports: [KnowledgeService, VectorSearchService, EmbeddingService, KbService],
})
export class KnowledgeModule {}
