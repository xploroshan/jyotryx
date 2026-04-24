import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { LlmChatOptions, LlmChatResult, LlmProvider } from './providers/llm-provider.interface';
import { createLlmPolicy, ResiliencePolicy } from './llm-resilience';

/**
 * Per-model token cost table (USD per 1M tokens).
 */
const MODEL_COSTS_USD_PER_1M: Record<string, { prompt: number; completion: number }> = {
  'gpt-4o': { prompt: 2.5, completion: 10 },
  'gpt-4o-mini': { prompt: 0.15, completion: 0.6 },
  'gpt-4-turbo': { prompt: 10, completion: 30 },
  'gpt-4': { prompt: 30, completion: 60 },
  'gpt-3.5-turbo': { prompt: 0.5, completion: 1.5 },
  'claude-opus-4-6': { prompt: 15, completion: 75 },
  'claude-sonnet-4-6': { prompt: 3, completion: 15 },
  'claude-haiku-4-5': { prompt: 0.8, completion: 4 },
  'gemini-2.0-flash': { prompt: 0.10, completion: 0.40 },
  'gemini-2.0-flash-lite': { prompt: 0.075, completion: 0.30 },
  'gemini-1.5-pro': { prompt: 1.25, completion: 5 },
  'gemini-1.5-flash': { prompt: 0.075, completion: 0.3 },
  'mistral-large': { prompt: 2, completion: 6 },
  'command-r-plus': { prompt: 3, completion: 15 },
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
export class LlmService implements OnModuleInit {
  private readonly logger = new Logger(LlmService.name);

  private readonly openaiPolicy: ResiliencePolicy;
  private readonly anthropicPolicy: ResiliencePolicy;
  private readonly geminiPolicy: ResiliencePolicy;

  private currentConfig!: LlmRuntimeConfig;
  private configLoadedAt = 0;
  private readonly CONFIG_TTL_MS = 30_000;

  private failoverEnabled: boolean;

  constructor(
    private configService: ConfigService,
    private openaiProvider: OpenAIProvider,
    private anthropicProvider: AnthropicProvider,
    private geminiProvider: GeminiProvider,
    @Optional() private prisma?: PrismaService,
  ) {
    this.openaiPolicy = createLlmPolicy('openai');
    this.anthropicPolicy = createLlmPolicy('anthropic');
    this.geminiPolicy = createLlmPolicy('gemini');

    this.failoverEnabled = this.configService.get<string>('llm.failoverEnabled', 'true') !== 'false';

    // Seed config from env vars
    const envKey = this.configService.get<string>('openai.apiKey') || null;
    this.currentConfig = {
      provider: 'openai',
      apiKey: envKey,
      defaultModel: this.configService.get<string>('openai.model', 'gpt-4o-mini'),
      precisionModel: this.configService.get<string>('openai.modelPrecision', 'gpt-4o'),
      visionModel: this.configService.get<string>('openai.modelVision', 'gpt-4o-mini'),
      temperature: 0.7,
    };
  }

  async onModuleInit() {
    await this.reloadConfig(true).catch(() => {});
    const primary = this.openaiProvider.isAvailable() ? 'OpenAI' : 'none';
    const secondary = this.geminiProvider.isAvailable() ? 'Gemini' : 'none';
    const tertiary = this.anthropicProvider.isAvailable() ? 'Anthropic' : 'none';
    this.logger.log(`LLM service ready — primary: ${primary}, secondary: ${secondary}, tertiary: ${tertiary}, failover: ${this.failoverEnabled}`);
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  getModel(): string {
    this.maybeRefreshInBackground();
    return this.currentConfig.defaultModel;
  }

  getModelForFeature(feature: 'default' | 'precision' | 'vision'): string {
    this.maybeRefreshInBackground();
    switch (feature) {
      case 'precision': return this.currentConfig.precisionModel;
      case 'vision': return this.currentConfig.visionModel;
      default: return this.currentConfig.defaultModel;
    }
  }

  getClient(): any | null {
    // Backward-compat: returns the OpenAI SDK client directly for callers
    // that need raw access (e.g., vision with image_url).
    this.maybeRefreshInBackground();
    return this.openaiProvider.isAvailable() ? (this.openaiProvider as any).client : null;
  }

  async invalidateCache(): Promise<void> {
    await this.reloadConfig(true).catch(() => {});
  }

  computeCost(model: string, promptTokens: number, completionTokens: number): number {
    const rate = MODEL_COSTS_USD_PER_1M[model] || DEFAULT_COST;
    const cost = (promptTokens * rate.prompt + completionTokens * rate.completion) / 1_000_000;
    return Math.round(cost * 1_000_000) / 1_000_000;
  }

  async recordUsage(params: {
    userId?: string | null;
    feature: string;
    provider?: string;
    model: string;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
    // ─── Ops telemetry (optional — callers pre-instrumentation omit these) ───
    durationMs?: number | null;
    cacheHit?: boolean;
    errorCode?: string | null;
    retryCount?: number;
  }): Promise<void> {
    if (!this.prisma) return;
    try {
      const promptTokens = params.usage?.prompt_tokens ?? 0;
      const completionTokens = params.usage?.completion_tokens ?? 0;
      const totalTokens = params.usage?.total_tokens ?? promptTokens + completionTokens;
      // Cache hits and failed calls have zero billable tokens — skip the
      // cost computation and write 0 so dashboards stay honest.
      const costUsd =
        params.cacheHit || params.errorCode
          ? 0
          : this.computeCost(params.model, promptTokens, completionTokens);

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
          durationMs: params.durationMs ?? null,
          cacheHit: params.cacheHit ?? false,
          errorCode: params.errorCode ?? null,
          retryCount: params.retryCount ?? 0,
        },
      });
    } catch (err) {
      this.logger.error('Failed to record LLM usage', err);
    }
  }

  /**
   * Map an arbitrary provider error to a short, aggregatable code. Used
   * by the failure path of recordUsage() so the admin error-rate
   * dashboard has a small cardinality of values to group by.
   */
  private classifyError(err: unknown): string {
    const message = (err instanceof Error ? err.message : String(err)).toLowerCase();
    if (message.includes('timeout') || message.includes('timed out')) return 'TIMEOUT';
    if (message.includes('rate limit') || message.includes('429')) return 'RATE_LIMIT';
    if (message.includes('bad request') || message.includes('400')) return 'BAD_REQUEST';
    if (message.includes('unauthorized') || message.includes('401') || message.includes('403')) return 'AUTH';
    if (message.includes('circuit') || message.includes('breaker')) return 'CIRCUIT_OPEN';
    return 'PROVIDER_ERROR';
  }

  /**
   * Chat completion with circuit breaker, retry, timeout, and provider failover.
   * Returns parsed JSON if jsonMode is true, raw string otherwise, or null on total failure.
   */
  async chatCompletion(options: LlmChatOptions & { jsonMode?: boolean }): Promise<any | null> {
    await this.reloadConfig(false).catch(() => {});

    const model = options.model || this.currentConfig.defaultModel;
    const feature = options.feature || 'chat';
    const enrichedOptions = { ...options, model };

    // Ordered list of (name, availability, policy, provider) tuples — the
    // first tuple is always tried; the rest only run when failoverEnabled.
    // Building it once keeps the loop linear and lets us assign a
    // retryCount that actually reflects provider-failover depth.
    const chain: Array<{ name: string; available: boolean; policy: ResiliencePolicy; run: () => Promise<any> }> = [
      { name: 'openai',    available: this.openaiProvider.isAvailable(),                              policy: this.openaiPolicy,    run: () => this.openaiProvider.chatCompletion(enrichedOptions) },
      { name: 'gemini',    available: this.failoverEnabled && this.geminiProvider.isAvailable(),      policy: this.geminiPolicy,    run: () => this.geminiProvider.chatCompletion(enrichedOptions) },
      { name: 'anthropic', available: this.failoverEnabled && this.anthropicProvider.isAvailable(),   policy: this.anthropicPolicy, run: () => this.anthropicProvider.chatCompletion(enrichedOptions) },
    ];

    for (let i = 0; i < chain.length; i++) {
      const link = chain[i];
      if (!link.available) continue;
      const start = performance.now();
      try {
        const result = await link.policy.execute(link.run);
        const durationMs = Math.round(performance.now() - start);
        this.recordUsage({
          userId: options.userId,
          feature,
          provider: result.provider,
          model: result.model,
          usage: result.usage,
          durationMs,
          retryCount: i,
        });
        return this.processResult(result, options.jsonMode);
      } catch (err) {
        const durationMs = Math.round(performance.now() - start);
        const errorCode = this.classifyError(err);
        // Record the failure so error-rate dashboards and provider
        // latency percentiles include it. Zero tokens / zero cost.
        this.recordUsage({
          userId: options.userId,
          feature,
          provider: link.name,
          model,
          durationMs,
          errorCode,
          retryCount: i,
        });
        const level = i === chain.length - 1 ? 'error' : 'warn';
        this.logger[level](`${link.name} failed (${errorCode}): ${(err as Error).message}`);
      }
    }

    return null;
  }

  /**
   * Streaming chat completion with failover.
   * Returns an async iterable of string chunks, or null if no provider is available.
   */
  async chatCompletionStream(options: LlmChatOptions): Promise<AsyncIterable<string> | null> {
    await this.reloadConfig(false).catch(() => {});

    const model = options.model || this.currentConfig.defaultModel;
    const enrichedOptions = { ...options, model };

    if (this.openaiProvider.isAvailable()) {
      try {
        return this.openaiProvider.chatCompletionStream(enrichedOptions);
      } catch (err) {
        this.logger.warn(`OpenAI stream failed: ${(err as Error).message}`);
      }
    }

    if (this.failoverEnabled && this.geminiProvider.isAvailable()) {
      try {
        return this.geminiProvider.chatCompletionStream(enrichedOptions);
      } catch (err) {
        this.logger.warn(`Gemini stream also failed: ${(err as Error).message}`);
      }
    }

    if (this.failoverEnabled && this.anthropicProvider.isAvailable()) {
      try {
        return this.anthropicProvider.chatCompletionStream(enrichedOptions);
      } catch (err) {
        this.logger.error(`Anthropic stream also failed: ${(err as Error).message}`);
      }
    }

    return null;
  }

  /**
   * Submit a chat completion via OpenAI's Batch API for async processing.
   * Returns the batch ID for status polling, or null if unavailable.
   * Ideal for non-real-time features like report generation (50% cost discount).
   */
  async batchCompletion(options: LlmChatOptions & { jsonMode?: boolean; customId: string }): Promise<string | null> {
    const client = this.getClient();
    if (!client) return null;

    const model = options.model || this.currentConfig.defaultModel;

    try {
      const requestBody = {
        model,
        messages: options.messages,
        max_tokens: options.maxTokens ?? 2000,
        temperature: options.temperature ?? 0.7,
        ...(options.jsonMode && { response_format: { type: 'json_object' } }),
      };

      // Create a JSONL batch input as a file
      const batchLine = JSON.stringify({
        custom_id: options.customId,
        method: 'POST',
        url: '/v1/chat/completions',
        body: requestBody,
      });

      const file = await client.files.create({
        file: new Blob([batchLine], { type: 'application/jsonl' }),
        purpose: 'batch',
      });

      const batch = await client.batches.create({
        input_file_id: file.id,
        endpoint: '/v1/chat/completions',
        completion_window: '24h',
      });

      this.logger.log(`Batch submitted: ${batch.id} for custom_id=${options.customId}`);
      return batch.id;
    } catch (err) {
      this.logger.error(`Batch submission failed: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Check the status of a batch job and retrieve results if complete.
   */
  async getBatchResult(batchId: string): Promise<{ status: string; result?: any } | null> {
    const client = this.getClient();
    if (!client) return null;

    try {
      const batch = await client.batches.retrieve(batchId);

      if (batch.status === 'completed' && batch.output_file_id) {
        const fileResponse = await client.files.content(batch.output_file_id);
        const text = await fileResponse.text();
        const lines = text.trim().split('\n').map((l: string) => JSON.parse(l));
        return { status: 'completed', result: lines };
      }

      return { status: batch.status };
    } catch (err) {
      this.logger.error(`Batch status check failed: ${(err as Error).message}`);
      return null;
    }
  }

  // ─── Config Management ──────────────────────────────────────────────────

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
        settings = Object.fromEntries(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
      } catch {
        // DB unavailable — keep env-based config.
      }
    }

    const envKey = this.configService.get<string>('openai.apiKey') || null;

    const next: LlmRuntimeConfig = {
      provider: settings['llm.default.provider'] || 'openai',
      apiKey: settings['llm.openai.key'] || envKey,
      defaultModel: settings['llm.default.model'] || this.configService.get<string>('openai.model', 'gpt-4o-mini'),
      precisionModel: settings['llm.precision.model'] || this.configService.get<string>('openai.modelPrecision', 'gpt-4o'),
      visionModel: settings['llm.vision.model'] || this.configService.get<string>('openai.modelVision', 'gpt-4o-mini'),
      temperature: parseFloat(settings['llm.default.temperature'] || '0.7') || 0.7,
    };

    const keyChanged = next.apiKey !== this.currentConfig.apiKey;
    this.currentConfig = next;

    if (keyChanged) {
      this.openaiProvider.reinitialize(next.apiKey || '');
    }
  }

  private maybeRefreshInBackground(): void {
    if (Date.now() - this.configLoadedAt >= this.CONFIG_TTL_MS) {
      this.reloadConfig(false).catch(() => {});
    }
  }

  private processResult(result: LlmChatResult, jsonMode?: boolean): any {
    if (!result.content) return null;
    if (jsonMode) {
      try {
        return JSON.parse(result.content);
      } catch {
        this.logger.error('Failed to parse LLM JSON response');
        return null;
      }
    }
    return result.content;
  }
}
