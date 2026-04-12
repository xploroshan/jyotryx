import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmProvider, LlmChatOptions, LlmChatResult } from './llm-provider.interface';

@Injectable()
export class OpenAIProvider implements LlmProvider {
  readonly name = 'openai';
  private readonly logger = new Logger(OpenAIProvider.name);
  private client: any = null;
  private openaiLib: any = null;

  constructor(private configService: ConfigService) {
    try {
      this.openaiLib = require('openai');
    } catch {
      this.openaiLib = null;
    }
    const apiKey = this.configService.get<string>('openai.apiKey');
    if (apiKey && this.openaiLib) {
      try {
        this.client = new this.openaiLib({ apiKey });
      } catch {
        this.client = null;
      }
    }
  }

  isAvailable(): boolean {
    return this.client != null;
  }

  reinitialize(apiKey: string): void {
    if (apiKey && this.openaiLib) {
      try {
        this.client = new this.openaiLib({ apiKey });
      } catch {
        this.client = null;
      }
    } else {
      this.client = null;
    }
  }

  async chatCompletion(options: LlmChatOptions): Promise<LlmChatResult> {
    if (!this.client) throw new Error('OpenAI client not available');

    const model = options.model || this.configService.get<string>('openai.model', 'gpt-4o-mini');
    const completion = await this.client.chat.completions.create({
      model,
      messages: options.messages,
      max_tokens: options.maxTokens ?? 1500,
      temperature: options.temperature ?? 0.7,
      ...(options.jsonMode && { response_format: { type: 'json_object' } }),
    });

    const content = completion.choices[0]?.message?.content || '';
    return {
      content,
      usage: completion.usage,
      model,
      provider: this.name,
    };
  }

  async *chatCompletionStream(options: LlmChatOptions): AsyncIterable<string> {
    if (!this.client) throw new Error('OpenAI client not available');

    const model = options.model || this.configService.get<string>('openai.model', 'gpt-4o-mini');
    const stream = await this.client.chat.completions.create({
      model,
      messages: options.messages,
      max_tokens: options.maxTokens ?? 1500,
      temperature: options.temperature ?? 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }
}
