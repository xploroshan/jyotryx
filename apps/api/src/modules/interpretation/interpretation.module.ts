import { Module } from '@nestjs/common';
import { InterpretationController } from './interpretation.controller';
import { InterpretationService } from './interpretation.service';

/**
 * Cross-feature "what this means for you" interpretation layer. Depends only on
 * the global LlmModule (LlmCacheService), so no imports are needed here.
 */
@Module({
  controllers: [InterpretationController],
  providers: [InterpretationService],
  exports: [InterpretationService],
})
export class InterpretationModule {}
