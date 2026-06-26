import { Module } from '@nestjs/common';
import { InterpretationController } from './interpretation.controller';
import { InterpretationService } from './interpretation.service';
import { KnowledgeModule } from '../../knowledge/knowledge.module';
import { UserModule } from '../user/user.module';
import { FeatureAccessModule } from '../../common/feature-access/feature-access.module';

/**
 * Cross-feature "what this means for you" interpretation layer. Uses the global
 * LlmModule (LlmCacheService) for prose generation, plus KnowledgeModule
 * (KbService) for the KB-first path that skips the LLM entirely on domains the
 * placement library covers (e.g. dasha).
 */
@Module({
  imports: [KnowledgeModule, UserModule, FeatureAccessModule],
  controllers: [InterpretationController],
  providers: [InterpretationService],
  exports: [InterpretationService],
})
export class InterpretationModule {}
