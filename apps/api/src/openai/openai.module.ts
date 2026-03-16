import { Global, Module } from '@nestjs/common';
import { OpenAIService } from './openai.service';
import { MemoryCacheService } from '../common/cache.service';

@Global()
@Module({
  providers: [OpenAIService, MemoryCacheService],
  exports: [OpenAIService, MemoryCacheService],
})
export class OpenAIModule {}
