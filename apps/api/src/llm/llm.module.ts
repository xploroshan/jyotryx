import { Global, Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { LlmCacheService } from './llm-cache.service';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GeminiProvider } from './providers/gemini.provider';

@Global()
@Module({
  providers: [OpenAIProvider, AnthropicProvider, GeminiProvider, LlmService, LlmCacheService],
  exports: [LlmService, LlmCacheService],
})
export class LlmModule {}
