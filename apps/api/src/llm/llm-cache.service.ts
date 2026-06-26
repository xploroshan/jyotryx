import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { createHash } from 'crypto';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { LlmService } from './llm.service';
import { LlmChatOptions } from './providers/llm-provider.interface';

/**
 * Per-feature TTL configuration (seconds).
 * Features with deterministic inputs benefit most from caching.
 */
const FEATURE_TTL: Record<string, number> = {
  'daily-briefing': 86_400, // 24 hours — same zodiac sign, same day
  'numerology': 604_800,    // 7 days — deterministic (name + DOB)
  'tarot': 0,               // no cache — tarot draws should be unique
  'chat': 0,                // no cache — conversational
  'kundli': 259_200,        // 3 days — same birth details = same chart
  'vastu': 604_800,         // 7 days — deterministic inputs
  // "What this means for you" interpretation layer. Inputs are deterministic
  // (same chart/numbers/lines => same explanation), so cache hard. Transient
  // domains (panchang/transits/horoscope) get short TTLs; chart-based ones long.
  'interpretation:kundli': 604_800,
  'interpretation:dosha': 604_800,
  'interpretation:matching': 604_800,
  'interpretation:numerology': 604_800,
  'interpretation:palmistry': 604_800,
  'interpretation:divisional': 604_800,
  'interpretation:kp': 604_800,
  'interpretation:western-natal': 604_800,
  'interpretation:bazi': 604_800,
  'interpretation:dasha': 259_200,
  'interpretation:vastu': 604_800,
  'interpretation:horoscope': 86_400,
  'interpretation:transits': 86_400,
  'interpretation:panchang': 86_400,
  'interpretation:muhurat': 86_400,
  'interpretation:decision': 86_400,
  'interpretation:cosmic-calendar': 86_400,
  'interpretation:chinese-zodiac': 604_800,
  'interpretation:medical': 604_800,
  'interpretation:synastry': 604_800,
  'interpretation:tarot': 86_400,
  'interpretation:hellenistic': 604_800,
  'interpretation:horary': 86_400,
  'interpretation:general': 86_400,
};

@Injectable()
export class LlmCacheService {
  private readonly logger = new Logger(LlmCacheService.name);

  constructor(
    private readonly llmService: LlmService,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis?: Redis,
  ) {}

  /**
   * Chat completion with Redis response caching for deterministic features.
   * Falls through to LlmService.chatCompletion if caching is disabled or misses.
   */
  async cachedChatCompletion(
    options: LlmChatOptions & { jsonMode?: boolean },
  ): Promise<any | null> {
    const feature = options.feature || 'chat';
    // Paid deep-dive readings (interpretation:deep:<domain>) are deterministic
    // per result and re-viewed for free, so cache them hard even though each
    // exact key isn't enumerated above.
    const ttl =
      FEATURE_TTL[feature] ?? (feature.startsWith('interpretation:deep:') ? 604_800 : 0);

    // Skip cache for non-cacheable features or if Redis is unavailable
    if (ttl === 0 || !this.redis) {
      return this.llmService.chatCompletion(options);
    }

    const cacheKey = this.buildCacheKey(options);

    // Check cache
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        this.logger.debug(`Cache HIT for ${feature}: ${cacheKey}`);
        // Record the cache hit as a zero-cost row so the admin cache
        // hit-rate dashboard has data to aggregate. `cacheHit: true`
        // flags it; no provider/duration/cost are recorded.
        this.llmService.recordUsage({
          userId: options.userId,
          feature,
          model: options.model ?? 'cache',
          cacheHit: true,
        });
        return JSON.parse(cached);
      }
    } catch {
      // Redis failure — proceed without cache
    }

    // Cache miss — call LLM
    const result = await this.llmService.chatCompletion(options);
    if (result == null) return null;

    // Store in cache
    try {
      await this.redis.setex(cacheKey, ttl, JSON.stringify(result));
      this.logger.debug(`Cache SET for ${feature}: ${cacheKey} (TTL=${ttl}s)`);
    } catch {
      // Redis failure — result is still returned
    }

    return result;
  }

  /**
   * Build a deterministic cache key from the chat options.
   * Hash includes: feature, model, messages content, and temperature.
   */
  private buildCacheKey(options: LlmChatOptions): string {
    const payload = JSON.stringify({
      feature: options.feature,
      model: options.model,
      messages: options.messages,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    });
    const hash = createHash('sha256').update(payload).digest('hex').slice(0, 16);
    return `llm:cache:${options.feature || 'default'}:${hash}`;
  }
}
