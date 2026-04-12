/**
 * Pluggable analytics backend interface.
 *
 * The default implementation queries Postgres (via the read replica).
 * When CLICKHOUSE_URL is configured, a ClickHouse adapter is used instead.
 */
export const ANALYTICS_SERVICE = 'ANALYTICS_SERVICE';

export interface LlmCostByUser {
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  calls: number;
  totalTokens: number;
  totalCostUsd: number;
}

export interface LlmTotals {
  calls: number;
  totalTokens: number;
  totalCostUsd: number;
}

export interface LlmUsageByFeature {
  feature: string;
  calls: number;
  totalTokens: number;
  costUsd: number;
}

export interface LlmUsageByProvider {
  provider: string;
  model: string;
  calls: number;
  totalTokens: number;
  costUsd: number;
}

export interface AnalyticsService {
  /**
   * Top users ranked by LLM spend over a given period.
   */
  getLlmCostsByUser(limit: number, days: number): Promise<LlmCostByUser[]>;

  /**
   * Aggregate LLM usage totals for a time window.
   */
  getLlmTotals(days: number): Promise<LlmTotals>;

  /**
   * LLM usage breakdown by feature (chat, kundli, palmistry, etc.).
   */
  getLlmUsageByFeature(days: number): Promise<LlmUsageByFeature[]>;

  /**
   * LLM usage breakdown by provider and model.
   */
  getLlmUsageByProvider(days: number): Promise<LlmUsageByProvider[]>;
}
