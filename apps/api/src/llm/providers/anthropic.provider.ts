import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmProvider, LlmChatOptions, LlmChatResult } from './llm-provider.interface';

@Injectable()
export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';
  private readonly logger = new Logger(AnthropicProvider.name);
  private client: any = null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('anthropic.apiKey');
    if (apiKey) {
      try {
        const Anthropic = require('@anthropic-ai/sdk');
        this.client = new Anthropic({ apiKey });
      } catch {
        this.client = null;
      }
    }
  }

  isAvailable(): boolean {
    return this.client != null;
  }

  async chatCompletion(options: LlmChatOptions): Promise<LlmChatResult> {
    if (!this.client) throw new Error('Anthropic client not available');

    const model = this.mapModel(options.model);

    // Separate system message from conversation messages (Anthropic API format)
    let systemPrompt: string | undefined;
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const msg of options.messages) {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      if (msg.role === 'system') {
        systemPrompt = systemPrompt ? `${systemPrompt}\n${content}` : content;
      } else {
        messages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content,
        });
      }
    }

    // Anthropic requires at least one user message
    if (messages.length === 0) {
      messages.push({ role: 'user', content: 'Please respond.' });
    }

    const response = await this.client.messages.create({
      model,
      max_tokens: options.maxTokens ?? 1500,
      temperature: options.temperature ?? 0.7,
      ...(systemPrompt && { system: systemPrompt }),
      messages,
    });

    const content = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('');

    return {
      content,
      usage: {
        prompt_tokens: response.usage?.input_tokens,
        completion_tokens: response.usage?.output_tokens,
        total_tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0),
      },
      model,
      provider: this.name,
    };
  }

  async *chatCompletionStream(options: LlmChatOptions): AsyncIterable<string> {
    if (!this.client) throw new Error('Anthropic client not available');

    const model = this.mapModel(options.model);

    let systemPrompt: string | undefined;
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const msg of options.messages) {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      if (msg.role === 'system') {
        systemPrompt = systemPrompt ? `${systemPrompt}\n${content}` : content;
      } else {
        messages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content,
        });
      }
    }

    if (messages.length === 0) {
      messages.push({ role: 'user', content: 'Please respond.' });
    }

    const stream = this.client.messages.stream({
      model,
      max_tokens: options.maxTokens ?? 1500,
      temperature: options.temperature ?? 0.7,
      ...(systemPrompt && { system: systemPrompt }),
      messages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        yield event.delta.text;
      }
    }
  }

  private mapModel(openaiModel?: string): string {
    // Map OpenAI model names to Anthropic equivalents
    const defaultModel = this.configService.get<string>('anthropic.model', 'claude-sonnet-4-6');
    if (!openaiModel) return defaultModel;

    const map: Record<string, string> = {
      'gpt-4o': 'claude-sonnet-4-6',
      'gpt-4o-mini': 'claude-haiku-4-5',
      'gpt-4-turbo': 'claude-sonnet-4-6',
      'gpt-4': 'claude-sonnet-4-6',
      'gpt-3.5-turbo': 'claude-haiku-4-5',
    };
    return map[openaiModel] || defaultModel;
  }
}
