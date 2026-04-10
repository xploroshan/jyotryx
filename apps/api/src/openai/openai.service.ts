import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Per-model token cost table (USD per 1M tokens).
 * Only OpenAI models are currently wired at runtime; other providers
 * are kept here so cost attribution stays accurate if the admin points
 * the `llm.default.provider` setting elsewhere in the future.
 */
const MODEL_COSTS_USD_PER_1M: Record<string, { prompt: number; completion: number }> = {
  // OpenAI
  'gpt-4o': { prompt: 2.5, completion: 10 },
  'gpt-4o-mini': { prompt: 0.15, completion: 0.6 },
  'gpt-4-turbo': { prompt: 10, completion: 30 },
  'gpt-4': { prompt: 30, completion: 60 },
  'gpt-3.5-turbo': { prompt: 0.5, completion: 1.5 },
  // Anthropic
  'claude-opus-4-6': { prompt: 15, completion: 75 },
  'claude-sonnet-4-6': { prompt: 3, completion: 15 },
  'claude-haiku-4-5': { prompt: 0.8, completion: 4 },
  // Google Gemini
  'gemini-1.5-pro': { prompt: 1.25, completion: 5 },
  'gemini-1.5-flash': { prompt: 0.075, completion: 0.3 },
  // Mistral
  'mistral-large': { prompt: 2, completion: 6 },
  // Cohere
  'command-r-plus': { prompt: 3, completion: 15 },
  // Groq
  'llama-3.1-70b': { prompt: 0.59, completion: 0.79 },
};

const DEFAULT_COST = { prompt: 0.15, completion: 0.6 };

interface LlmRuntimeConfig {
  provider: string;
  apiKey: string | null;
  defaultModel: string;
  precisionModel: string;
  visionModel: string;
  temperature: number;
}

@Injectable()
export class OpenAIService implements OnModuleInit {
  private readonly logger = new Logger(OpenAIService.name);
  private client: any = null;
  private currentConfig: LlmRuntimeConfig;
  private configLoadedAt: number = 0;
  private readonly CONFIG_TTL_MS = 30_000;
  private openaiLib: any = null;

  constructor(
    private configService: ConfigService,
    @Optional() private prisma?: PrismaService,
  ) {
    // Seed config from env vars so sync getters work even before the
    // first DB load (including in unit tests that don't provide Prisma).
    const envKey = this.configService.get<string>('openai.apiKey') || null;
    this.currentConfig = {
      provider: 'openai',
      apiKey: envKey,
      defaultModel: this.configService.get<string>('openai.model', 'gpt-4o-mini'),
      precisionModel: this.configService.get<string>('openai.modelPrecision', 'gpt-4o'),
      visionModel: this.configService.get<string>('openai.modelVision', 'gpt-4o-mini'),
      temperature: 0.7,
    };

    try {
      this.openaiLib = require('openai');
    } catch {
      this.openaiLib = null;
    }
    if (envKey && this.openaiLib) {
      try {
        this.client = new this.openaiLib({ apiKey: envKey });
      } catch {
        this.client = null;
      }
    }
  }

  async onModuleInit() {
    if (!this.openaiLib) {
      this.logger.warn('openai package not installed - LLM features will use fallbacks');
      return;
    }
    // Pull live settings from DB on boot (with env fallback).
    await this.reloadConfig(true).catch(() => {});
    if (this.client) {
      this.logger.log(`OpenAI client ready (provider=${this.currentConfig.provider}, model=${this.currentConfig.defaultModel})`);
    } else {
      this.logger.warn('OpenAI API key not configured - AI features will use fallbacks');
    }
  }

  /**
   * Reload configuration from `site_settings` rows prefixed with `llm.`,
   * falling back to environment variables. Re-initializes the OpenAI
   * client when the resolved API key changes.
   */
  private async reloadConfig(force = false): Promise<void> {
    const now = Date.now();
    if (!force && now - this.configLoadedAt < this.CONFIG_TTL_MS) return;
    this.configLoadedAt = now;

    let settings: Record<string, string> = {};
    if (this.prisma) {
      try {
        const rows = await this.prisma.siteSetting.findMany({
          where: { key: { startsWith: 'llm.' } },
        });
        settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      } catch {
        // DB unavailable — keep env-based config.
      }
    }

    const envKey = this.configService.get<string>('openai.apiKey') || null;
    const envModel = this.configService.get<string>('openai.model') || 'gpt-4o-mini';
    const envPrecision = this.configService.get<string>('openai.modelPrecision') || 'gpt-4o';
    const envVision = this.configService.get<string>('openai.modelVision') || 'gpt-4o-mini';

    const next: LlmRuntimeConfig = {
      provider: settings['llm.default.provider'] || 'openai',
      apiKey: settings['llm.openai.key'] || envKey,
      defaultModel: settings['llm.default.model'] || envModel,
      precisionModel: settings['llm.precision.model'] || envPrecision,
      visionModel: settings['llm.vision.model'] || envVision,
      temperature: parseFloat(settings['llm.default.temperature'] || '0.7') || 0.7,
    };

    const keyChanged = next.apiKey !== this.currentConfig.apiKey;
    this.currentConfig = next;

    if (keyChanged || !this.client) {
      if (next.apiKey && this.openaiLib) {
        try {
          this.client = new this.openaiLib({ apiKey: next.apiKey });
          this.logger.log(`OpenAI client (re)initialized (provider=${next.provider}, model=${next.defaultModel})`);
        } catch (e) {
          this.logger.error('Failed to initialize OpenAI client', e);
          this.client = null;
        }
      } else if (!next.apiKey) {
        this.client = null;
      }
    }
  }

  /**
   * Fire-and-forget refresh used to make sync getters eventually consistent
   * with live settings. Safe to call from sync code paths.
   */
  private maybeRefreshInBackground(): void {
    if (Date.now() - this.configLoadedAt >= this.CONFIG_TTL_MS) {
      this.reloadConfig(false).catch(() => {});
    }
  }

  getClient(): any | null {
    this.maybeRefreshInBackground();
    return this.client;
  }

  getModel(): string {
    this.maybeRefreshInBackground();
    return this.currentConfig.defaultModel;
  }

  getModelForFeature(feature: 'default' | 'precision' | 'vision'): string {
    this.maybeRefreshInBackground();
    switch (feature) {
      case 'precision':
        return this.currentConfig.precisionModel;
      case 'vision':
        return this.currentConfig.visionModel;
      default:
        return this.currentConfig.defaultModel;
    }
  }

  /** Force a config refresh on the next call — invoked after admin saves settings. */
  async invalidateCache(): Promise<void> {
    await this.reloadConfig(true).catch(() => {});
  }

  /**
   * Compute USD cost for a given model + token counts.
   * Returns a value rounded to 6 decimal places.
   */
  computeCost(model: string, promptTokens: number, completionTokens: number): number {
    const rate = MODEL_COSTS_USD_PER_1M[model] || DEFAULT_COST;
    const cost = (promptTokens * rate.prompt + completionTokens * rate.completion) / 1_000_000;
    return Math.round(cost * 1_000_000) / 1_000_000;
  }

  /**
   * Persist a single LLM call to the `llm_usage` table. Non-blocking —
   * errors are logged but never propagated to the caller.
   */
  async recordUsage(params: {
    userId?: string | null;
    feature: string;
    provider?: string;
    model: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
  }): Promise<void> {
    if (!this.prisma) return;
    try {
      const promptTokens = params.usage?.prompt_tokens ?? 0;
      const completionTokens = params.usage?.completion_tokens ?? 0;
      const totalTokens = params.usage?.total_tokens ?? promptTokens + completionTokens;
      const costUsd = this.computeCost(params.model, promptTokens, completionTokens);

      await this.prisma.llmUsage.create({
        data: {
          userId: params.userId || null,
          provider: params.provider || this.currentConfig.provider || 'openai',
          model: params.model,
          feature: params.feature,
          promptTokens,
          completionTokens,
          totalTokens,
          costUsd,
        },
      });
    } catch (err) {
      this.logger.error('Failed to record LLM usage', err);
    }
  }

  /**
   * High-level chat completion that handles client init, error fallback,
   * JSON parsing, and per-user usage tracking in one call.
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
    // Ensure we have fresh config before each call (cheap thanks to TTL).
    await this.reloadConfig(false).catch(() => {});
    if (!this.client) return null;

    const model = options.model || this.currentConfig.defaultModel;
    const feature = options.feature || 'chat';

    try {
      const completion = await this.client.chat.completions.create({
        model,
        messages: options.messages,
        max_tokens: options.maxTokens ?? 1500,
        temperature: options.temperature ?? this.currentConfig.temperature,
        ...(options.jsonMode && { response_format: { type: 'json_object' } }),
        timeout: 30000,
      });

      // Fire-and-forget usage tracking — never blocks or fails the call.
      this.recordUsage({
        userId: options.userId,
        feature,
        provider: this.currentConfig.provider,
        model,
        usage: completion.usage,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) return null;

      if (options.jsonMode) {
        try {
          return JSON.parse(content);
        } catch (parseError) {
          this.logger.error('Failed to parse OpenAI JSON response', parseError);
          return null;
        }
      }
      return content;
    } catch (error) {
      this.logger.error('OpenAI API call failed', error);
      return null;
    }
  }
}
