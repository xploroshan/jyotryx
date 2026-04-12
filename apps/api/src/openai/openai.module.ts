import { Global, Module } from '@nestjs/common';
import { OpenAIService } from './openai.service';
import { MemoryCacheService } from '../common/cache.service';
import { LlmModule } from '../llm/llm.module';

@Global()
@Module({
  imports: [LlmModule],
  providers: [OpenAIService, MemoryCacheService],
  exports: [OpenAIService, MemoryCacheService, LlmModule],
})
export class OpenAIModule {}
