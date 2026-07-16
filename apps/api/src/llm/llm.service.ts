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

/** Per-feature routing overrides set from the admin LLM tab
 *  (`llm.feature.{root}.provider|model|max_tokens`). Matched on the ROOT of
 *  the usage feature tag (`report:life` → `report`). */
interface FeatureOverride {
  provider?: string;
  model?: string;
  maxTokens?: number;
}

interface LlmRuntimeConfig {
  provider: string;
  apiKey: string | null;
  /** Anthropic/Gemini keys are runtime-rotatable too — previously they were
   *  write-only settings (stored by the admin panel, read by nothing) and the
   *  providers only ever initialized from env. */
  anthropicKey: string | null;
  geminiKey: string | null;
  featureOverrides: Record<string, FeatureOverride>;
  defaultModel: string;
  precisionModel: string;
  visionModel: string;
  /** Vision model for palmistry specifically — accuracy-critical, paid feature.
   *  Defaults to the precision-grade gpt-4o rather than the mini vision bucket;
   *  admin-overridable at runtime via `llm.vision.palmistryModel`. */
  palmistryVisionModel: string;
  temperature: number;
  // ─── Phase 3 admin kill-switch + pricing overrides ─────────────────
  // `providerEnabled[name]` is the operator's explicit enable/disable
  // flag — checked in the provider chain alongside `isAvailable()`.
  // Absence means "no explicit override"; the flag falls back to
  // `true` so the existing behaviour is preserved until an admin
  // touches the setting.
  providerEnabled: Record<string, boolean>;
  // `modelCostOverrides` lets admins override the static per-model
  // USD/1M-token table without a code deploy. Either half of the pair
  // can be overridden independently. Historical llm_usage rows are
  // never re-costed — overrides only affect calls made after the
  // 30s reload picks up the new setting.
  modelCostOverrides: Record<string, { prompt?: number; completion?: number }>;
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
      anthropicKey: this.configService.get<string>('anthropic.apiKey') || null,
      geminiKey: this.configService.get<string>('gemini.apiKey') || null,
      featureOverrides: {},
      defaultModel: this.configService.get<string>('openai.model', 'gpt-4o-mini'),
      precisionModel: this.configService.get<string>('openai.modelPrecision', 'gpt-4o'),
      visionModel: this.configService.get<string>('openai.modelVision', 'gpt-4o-mini'),
      palmistryVisionModel: this.configService.get<string>('openai.modelVisionPalmistry', 'gpt-4o'),
      temperature: 0.7,
      providerEnabled: {},
      modelCostOverrides: {},
    };
  }

  /**
   * Is a provider enabled by the admin kill-switch? Absence of the
   * flag means "no opinion" — we default to enabled so installs that
   * never touch site_settings behave exactly as before. Both the
   * canonical Phase 3 key (`llm.provider.{name}.enabled`) and the
   * pre-existing LlmTab-managed key (`llm.{name}.enabled`) are
   * honoured; either one set to "false" flips the provider off.
   */
  isProviderEnabled(name: string): boolean {
    const flag = this.currentConfig.providerEnabled[name];
    return flag !== false;
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

  getModelForFeature(feature: 'default' | 'precision' | 'vision' | 'palmistry-vision'): string {
    this.maybeRefreshInBackground();
    switch (feature) {
      case 'precision': return this.currentConfig.precisionModel;
      case 'vision': return this.currentConfig.visionModel;
      case 'palmistry-vision': return this.currentConfig.palmistryVisionModel;
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
    // Admin can override either half of the per-model rate via
    // site_settings. Either half left unset falls back to the static
    // table (and the static table itself falls back to DEFAULT_COST
    // for unknown models).
    const override = this.currentConfig.modelCostOverrides[model] ?? {};
    const base = MODEL_COSTS_USD_PER_1M[model] || DEFAULT_COST;
    const promptRate = override.prompt ?? base.prompt;
    const completionRate = override.completion ?? base.completion;
    const cost = (promptTokens * promptRate + completionTokens * completionRate) / 1_000_000;
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
   * Provider descriptors ordered so the effective primary comes first:
   * an explicit per-feature provider override, else the admin's
   * `llm.default.provider`, else openai. Previously the dropdown was stored
   * but the chain stayed hardcoded openai → gemini → anthropic, so choosing
   * "Anthropic" routed nothing (every request still hit OpenAI first).
   */
  private buildProviderChain(
    preferred?: string,
  ): Array<{ name: string; provider: OpenAIProvider | AnthropicProvider | GeminiProvider; policy: ResiliencePolicy }> {
    const registry = {
      openai: { name: 'openai', provider: this.openaiProvider, policy: this.openaiPolicy },
      gemini: { name: 'gemini', provider: this.geminiProvider, policy: this.geminiPolicy },
      anthropic: { name: 'anthropic', provider: this.anthropicProvider, policy: this.anthropicPolicy },
    } as const;
    const names = Object.keys(registry) as Array<keyof typeof registry>;
    const pick = (candidate?: string): keyof typeof registry | null =>
      candidate && names.includes(candidate as keyof typeof registry)
        ? (candidate as keyof typeof registry)
        : null;
    const primary = pick(preferred) ?? pick(this.currentConfig.provider) ?? 'openai';
    return [registry[primary], ...names.filter((n) => n !== primary).map((n) => registry[n])];
  }

  /**
   * Chat completion with circuit breaker, retry, timeout, and provider failover.
   * Returns parsed JSON if jsonMode is true, raw string otherwise, or null on total failure.
   */
  async chatCompletion(options: LlmChatOptions & { jsonMode?: boolean }): Promise<any | null> {
    await this.reloadConfig(false).catch(() => {});

    const feature = options.feature || 'chat';
    // Admin per-feature routing (llm.feature.{root}.*): an explicit override
    // wins over the caller's own defaults — that's the point of the control.
    const override = this.currentConfig.featureOverrides[feature.split(':')[0]] ?? {};
    const model = override.model || options.model || this.currentConfig.defaultModel;
    const enrichedOptions = {
      ...options,
      model,
      maxTokens: override.maxTokens ?? options.maxTokens,
      // llm.default.temperature applies whenever the caller didn't choose one.
      temperature: options.temperature ?? this.currentConfig.temperature,
    };

    // Ordered list of (name, availability, policy, provider) tuples — the
    // first tuple is always tried; the rest only run when failoverEnabled.
    // Building it once keeps the loop linear and lets us assign a
    // retryCount that actually reflects provider-failover depth.
    // `isProviderEnabled()` adds the Phase 3 admin kill-switch on top
    // of the provider's own `isAvailable()` check. A disabled provider
    // is skipped silently — the caller doesn't even see the breaker
    // trip, and the retryCount on the next successful row reflects
    // the real failover depth we exercised.
    const chain = this.buildProviderChain(override.provider).map(({ name, provider, policy }, idx) => ({
      name,
      // The primary is always eligible; the rest are failovers and are
      // additionally gated on the failover flag.
      available:
        this.isProviderEnabled(name) && (idx === 0 || this.failoverEnabled) && provider.isAvailable(),
      policy,
      run: () => provider.chatCompletion(enrichedOptions),
    }));

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

  /** Max wait for the next stream chunk before failing over / aborting. */
  private static readonly STREAM_IDLE_TIMEOUT_MS = 30_000;

  /**
   * Streaming chat completion with REAL failover + usage recording.
   *
   * Provider `chatCompletionStream` methods are async generators that do no
   * work until the first pull, so the previous `try { return provider.stream }`
   * could never catch a connection error — failover was dead code and streamed
   * chat was completely uncosted. We now prime each candidate (await the first
   * chunk); only a provider that actually connects is returned, wrapped so the
   * rest of the stream runs under an idle timeout and one llm_usage row is
   * written when it ends. Returns null only when every provider fails to start.
   */
  async chatCompletionStream(options: LlmChatOptions): Promise<AsyncIterable<string> | null> {
    await this.reloadConfig(false).catch(() => {});

    // Same admin routing as chatCompletion: per-feature override, then the
    // default-provider ordering, then temperature/max-token defaults.
    const override = this.currentConfig.featureOverrides[(options.feature || 'chat').split(':')[0]] ?? {};
    const model = override.model || options.model || this.currentConfig.defaultModel;
    const enrichedOptions = {
      ...options,
      model,
      maxTokens: override.maxTokens ?? options.maxTokens,
      temperature: options.temperature ?? this.currentConfig.temperature,
    };

    const candidates: Array<[string, LlmProvider]> = this.buildProviderChain(override.provider)
      .filter(
        ({ name, provider }, idx) =>
          this.isProviderEnabled(name) && (idx === 0 || this.failoverEnabled) && provider.isAvailable(),
      )
      .map(({ name, provider }) => [name, provider]);

    for (const [name, provider] of candidates) {
      try {
        const iterator = provider.chatCompletionStream(enrichedOptions)[Symbol.asyncIterator]();
        // Prime: forces the underlying network call so connect/auth failures
        // surface here and fall through to the next provider.
        const first = await this.withIdleTimeout(
          iterator.next(),
          LlmService.STREAM_IDLE_TIMEOUT_MS,
          name,
        );
        return this.wrapStream(name, model, enrichedOptions, iterator, first);
      } catch (err) {
        this.logger.warn(`${name} stream failed to start: ${(err as Error).message}`);
      }
    }

    return null;
  }

  /** Reject if `p` doesn't settle within `ms` (ms <= 0 disables the timeout). */
  private withIdleTimeout<T>(p: Promise<T>, ms: number, providerName: string): Promise<T> {
    if (!ms || ms <= 0) return p;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`${providerName} stream timed out after ${ms}ms of inactivity`)),
        ms,
      );
      p.then(
        (v) => { clearTimeout(timer); resolve(v); },
        (e) => { clearTimeout(timer); reject(e); },
      );
    });
  }

  /**
   * Re-emit the primed first chunk, drain the rest under a per-chunk idle
   * timeout, and record one llm_usage row (estimated tokens — streaming
   * providers don't return exact counts) when the stream ends or errors.
   */
  private async *wrapStream(
    providerName: string,
    model: string,
    options: LlmChatOptions,
    iterator: AsyncIterator<string>,
    first: IteratorResult<string>,
  ): AsyncGenerator<string> {
    const start = performance.now();
    let output = '';
    let errorCode: string | null = null;
    try {
      let current = first;
      while (!current.done) {
        output += current.value;
        yield current.value;
        current = await this.withIdleTimeout(
          iterator.next(),
          LlmService.STREAM_IDLE_TIMEOUT_MS,
          providerName,
        );
      }
    } catch (err) {
      errorCode = this.classifyError(err);
      throw err;
    } finally {
      const promptChars = (options.messages ?? []).reduce(
        (n, m) => n + (typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content).length),
        0,
      );
      this.recordUsage({
        userId: options.userId,
        feature: options.feature ?? 'chat:stream',
        provider: providerName,
        model,
        usage: {
          prompt_tokens: Math.ceil(promptChars / 4),
          completion_tokens: Math.ceil(output.length / 4),
        },
        durationMs: Math.round(performance.now() - start),
        errorCode,
      }).catch(() => {});
    }
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
        temperature: options.temperature ?? this.currentConfig.temperature,
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
        // Pull both `llm.*` (provider keys, models, kill-switch flags)
        // and `pricing.llm.*` (admin-editable per-model cost overrides)
        // in a single query — they live under different prefixes but
        // this service is the one consumer for both.
        const rows = await this.prisma.siteSetting.findMany({
          where: {
            OR: [
              { key: { startsWith: 'llm.' } },
              { key: { startsWith: 'pricing.llm.' } },
            ],
          },
        });
        settings = Object.fromEntries(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
      } catch {
        // DB unavailable — keep env-based config.
      }
    }

    const envKey = this.configService.get<string>('openai.apiKey') || null;

    // ─── Provider kill-switch flags ────────────────────────────────────
    // Two compatible key shapes are honoured so existing LlmTab toggles
    // (`llm.openai.enabled`) and the Phase 3 canonical shape
    // (`llm.provider.openai.enabled`) both work. Setting either to
    // "false" disables the provider.
    const readEnabled = (name: string): boolean => {
      const a = settings[`llm.provider.${name}.enabled`];
      // Legacy: the old LlmTab labelled Gemini "google", so installs that
      // toggled it wrote llm.google.enabled — honour that intent too.
      const b =
        settings[`llm.${name}.enabled`] ??
        (name === 'gemini' ? settings['llm.google.enabled'] : undefined);
      const effective = a !== undefined ? a : b;
      if (effective === undefined) return true; // no opinion → enabled
      return effective !== 'false';
    };
    const providerEnabled: Record<string, boolean> = {
      openai:    readEnabled('openai'),
      gemini:    readEnabled('gemini'),
      anthropic: readEnabled('anthropic'),
    };

    // ─── Per-model cost overrides ──────────────────────────────────────
    // Key shape: `pricing.llm.{model}.{prompt|completion}`. Model names
    // can contain dots (e.g. `claude-sonnet-4-6`), so we split from the
    // right — the last segment is prompt|completion, everything in
    // between is the model id.
    const modelCostOverrides: Record<string, { prompt?: number; completion?: number }> = {};
    for (const [key, raw] of Object.entries(settings)) {
      if (!key.startsWith('pricing.llm.')) continue;
      const tail = key.slice('pricing.llm.'.length);
      const lastDot = tail.lastIndexOf('.');
      if (lastDot <= 0) continue;
      const model = tail.slice(0, lastDot);
      const half = tail.slice(lastDot + 1);
      if (half !== 'prompt' && half !== 'completion') continue;
      const num = Number(raw);
      if (!Number.isFinite(num) || num < 0) continue;
      if (!modelCostOverrides[model]) modelCostOverrides[model] = {};
      modelCostOverrides[model][half as 'prompt' | 'completion'] = num;
    }

    // ─── Per-feature routing overrides ─────────────────────────────────
    // Key shape: `llm.feature.{root}.{provider|model|max_tokens}`, written
    // by the admin LLM tab's Feature Controls and consumed in
    // chatCompletion/chatCompletionStream above.
    const featureOverrides: Record<string, FeatureOverride> = {};
    for (const [key, raw] of Object.entries(settings)) {
      const m = key.match(/^llm\.feature\.([a-z0-9_-]+)\.(model|provider|max_tokens)$/i);
      if (!m || !raw) continue;
      const entry = (featureOverrides[m[1]] ??= {});
      if (m[2] === 'model') entry.model = raw;
      else if (m[2] === 'provider') entry.provider = raw;
      else {
        const n = parseInt(raw, 10);
        if (Number.isFinite(n) && n > 0) entry.maxTokens = n;
      }
    }

    const next: LlmRuntimeConfig = {
      provider: settings['llm.default.provider'] || 'openai',
      apiKey: settings['llm.openai.key'] || envKey,
      anthropicKey:
        settings['llm.anthropic.key'] || this.configService.get<string>('anthropic.apiKey') || null,
      // Legacy alias: the old LlmTab stored the Gemini key as llm.google.key.
      geminiKey:
        settings['llm.gemini.key'] ||
        settings['llm.google.key'] ||
        this.configService.get<string>('gemini.apiKey') ||
        null,
      featureOverrides,
      defaultModel: settings['llm.default.model'] || this.configService.get<string>('openai.model', 'gpt-4o-mini'),
      precisionModel: settings['llm.precision.model'] || this.configService.get<string>('openai.modelPrecision', 'gpt-4o'),
      visionModel: settings['llm.vision.model'] || this.configService.get<string>('openai.modelVision', 'gpt-4o-mini'),
      palmistryVisionModel:
        settings['llm.vision.palmistryModel'] ||
        this.configService.get<string>('openai.modelVisionPalmistry', 'gpt-4o'),
      temperature: parseFloat(settings['llm.default.temperature'] || '0.7') || 0.7,
      providerEnabled,
      modelCostOverrides,
    };

    const openaiKeyChanged = next.apiKey !== this.currentConfig.apiKey;
    const anthropicKeyChanged = next.anthropicKey !== this.currentConfig.anthropicKey;
    const geminiKeyChanged = next.geminiKey !== this.currentConfig.geminiKey;
    this.currentConfig = next;

    // Rotated keys must actually reach a client — previously only OpenAI
    // reinitialized, so pasting/rotating an Anthropic or Gemini key stored a
    // secret nothing ever read.
    if (openaiKeyChanged) {
      this.openaiProvider.reinitialize(next.apiKey || '');
    }
    if (anthropicKeyChanged) {
      this.anthropicProvider.reinitialize(next.anthropicKey || '');
    }
    if (geminiKeyChanged) {
      this.geminiProvider.reinitialize(next.geminiKey || '');
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
