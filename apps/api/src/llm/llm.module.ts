import { Global, Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';

@Global()
@Module({
  providers: [OpenAIProvider, AnthropicProvider, LlmService],
  exports: [LlmService],
})
export class LlmModule {}
