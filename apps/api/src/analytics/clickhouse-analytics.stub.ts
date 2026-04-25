import { Injectable, Logger } from '@nestjs/common';
import {
  AnalyticsService,
  CostProjection,
  DailyCostPoint,
  LlmCostByUser,
  LlmTotals,
  LlmUsageByFeature,
  LlmUsageByProvider,
  TodayUsageByFeature,
} from './analytics.interface';

/**
 * ClickHouse analytics stub.
 *
 * This is a placeholder for future ClickHouse integration. When CLICKHOUSE_URL
 * is configured and a real ClickHouse client is wired in, this service will
 * query the `llm_usage` table in ClickHouse instead of Postgres.
 *
 * To activate:
 *   1. Install `@clickhouse/client`
 *   2. Replace the stub methods with real ClickHouse queries
 *   3. Set CLICKHOUSE_URL in .env
 *
 * Expected ClickHouse schema:
 *   CREATE TABLE IF NOT EXISTS llm_usage (
 *     id UUID,
 *     userId Nullable(UUID),
 *     provider LowCardinality(String),
 *     model LowCardinality(String),
 *     feature LowCardinality(String),
 *     promptTokens UInt32,
 *     completionTokens UInt32,
 *     totalTokens UInt32,
 *     costUsd Decimal(12, 6),
 *     createdAt DateTime64(3)
 *   ) ENGINE = MergeTree()
 *   PARTITION BY toYYYYMM(createdAt)
 *   ORDER BY (createdAt, provider, model)
 *   TTL toDateTime(createdAt) + INTERVAL 2 YEAR;
 */
@Injectable()
export class ClickHouseAnalyticsStub implements AnalyticsService {
  private readonly logger = new Logger(ClickHouseAnalyticsStub.name);

  constructor() {
    this.logger.warn(
      'ClickHouse analytics stub loaded — install @clickhouse/client and implement queries to enable',
    );
  }

  async getLlmCostsByUser(_limit: number, _days: number): Promise<LlmCostByUser[]> {
    // TODO: Implement with ClickHouse client
    // SELECT userId, count() as calls, sum(totalTokens), sum(costUsd)
    // FROM llm_usage WHERE createdAt >= now() - INTERVAL {days} DAY
    // GROUP BY userId ORDER BY sum(costUsd) DESC LIMIT {limit}
    this.logger.warn('getLlmCostsByUser called on ClickHouse stub — returning empty');
    return [];
  }

  async getLlmTotals(_days: number): Promise<LlmTotals> {
    // TODO: Implement with ClickHouse client
    this.logger.warn('getLlmTotals called on ClickHouse stub — returning zeros');
    return { calls: 0, totalTokens: 0, totalCostUsd: 0 };
  }

  async getLlmUsageByFeature(_days: number): Promise<LlmUsageByFeature[]> {
    // TODO: Implement with ClickHouse client
    this.logger.warn('getLlmUsageByFeature called on ClickHouse stub — returning empty');
    return [];
  }

  async getLlmUsageByProvider(_days: number): Promise<LlmUsageByProvider[]> {
    // TODO: Implement with ClickHouse client
    this.logger.warn('getLlmUsageByProvider called on ClickHouse stub — returning empty');
    return [];
  }

  async getCostProjection(): Promise<CostProjection> {
    this.logger.warn('getCostProjection called on ClickHouse stub — returning zeros');
    return { mtdUsd: 0, prevMtdUsd: 0, projectionUsd: 0 };
  }

  async getDailyCostSeries(_days: number): Promise<DailyCostPoint[]> {
    this.logger.warn('getDailyCostSeries called on ClickHouse stub — returning empty');
    return [];
  }

  async getTodayUsageByFeature(): Promise<TodayUsageByFeature> {
    this.logger.warn('getTodayUsageByFeature called on ClickHouse stub — returning empty');
    return {};
  }
}
