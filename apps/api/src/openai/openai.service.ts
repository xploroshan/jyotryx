import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmService } from '../llm/llm.service';

/**
 * Backward-compatible facade over the new LlmService.
 *
 * All existing consumers (chat, report, palmistry, astrology, tarot, vastu,
 * numerology, daily briefing) inject OpenAIService — this delegates every
 * call through to LlmService which adds circuit breaker, retry, timeout,
 * and Anthropic failover.
 */
@Injectable()
export class OpenAIService implements OnModuleInit {
  private readonly logger = new Logger(OpenAIService.name);

  constructor(
    private configService: ConfigService,
    @Optional() private llmService?: LlmService,
  ) {}

  async onModuleInit() {
    if (this.llmService) {
      this.logger.log('OpenAIService delegating to LlmService (circuit breaker + failover enabled)');
    } else {
      this.logger.warn('LlmService not available — OpenAIService running in degraded mode');
    }
  }

  getClient(): any | null {
    return this.llmService?.getClient() ?? null;
  }

  getModel(): string {
    return this.llmService?.getModel() ?? this.configService.get<string>('openai.model', 'gpt-4o-mini');
  }

  getModelForFeature(feature: 'default' | 'precision' | 'vision' | 'palmistry-vision'): string {
    return this.llmService?.getModelForFeature(feature) ?? this.configService.get<string>('openai.model', 'gpt-4o-mini');
  }

  async invalidateCache(): Promise<void> {
    await this.llmService?.invalidateCache();
  }

  computeCost(model: string, promptTokens: number, completionTokens: number): number {
    return this.llmService?.computeCost(model, promptTokens, completionTokens) ?? 0;
  }

  async recordUsage(params: {
    userId?: string | null;
    feature: string;
    provider?: string;
    model: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
  }): Promise<void> {
    await this.llmService?.recordUsage(params);
  }

  /**
   * High-level chat completion — now routed through LlmService with
   * circuit breaker, retry, timeout, and provider failover.
   */
  async chatCompletion(options: {
    messages: any[];
    maxTokens?: number;
    temperature?: number;
    jsonMode?: boolean;
    model?: string;
    userId?: string | null;
    feature?: string;
  }): Promise<any | null> {
    if (!this.llmService) return null;
    return this.llmService.chatCompletion(options);
  }
}
