import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OpenAIService implements OnModuleInit {
  private readonly logger = new Logger(OpenAIService.name);
  private client: any = null;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('openai.apiKey');
    if (apiKey) {
      const OpenAI = require('openai');
      this.client = new OpenAI({ apiKey });
      this.logger.log('OpenAI client initialized');
    } else {
      this.logger.warn('OpenAI API key not configured - AI features will use fallbacks');
    }
  }

  getClient(): any | null {
    return this.client;
  }

  getModel(): string {
    return this.configService.get<string>('openai.model', 'gpt-4o');
  }

  async chatCompletion(options: {
    messages: any[];
    maxTokens?: number;
    temperature?: number;
    jsonMode?: boolean;
  }): Promise<any | null> {
    if (!this.client) return null;

    try {
      const completion = await this.client.chat.completions.create({
        model: this.getModel(),
        messages: options.messages,
        max_tokens: options.maxTokens ?? 1500,
        temperature: options.temperature ?? 0.7,
        ...(options.jsonMode && { response_format: { type: 'json_object' } }),
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) return null;
      return options.jsonMode ? JSON.parse(content) : content;
    } catch (error) {
      this.logger.error('OpenAI API call failed', error);
      return null;
    }
  }
}
