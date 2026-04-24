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

export interface CostProjection {
  /** Month-to-date spend (from the 1st of the current local month). */
  mtdUsd: number;
  /** Same-window spend in the previous month for MoM comparison. */
  prevMtdUsd: number;
  /**
   * Naive linear projection of end-of-month total: mtd × (days_in_month /
   * days_elapsed). Deliberately simple so the owner can reason about it.
   */
  projectionUsd: number;
}

export interface DailyCostPoint {
  /** ISO date (YYYY-MM-DD) in server local time. */
  date: string;
  costUsd: number;
  tokens: number;
}

export interface TodayUsageByFeature {
  [feature: string]: { tokens: number; costUsd: number };
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

  /**
   * MTD spend + previous-month same-window spend + naive end-of-month
   * projection. Used by the admin Cost tab headline tiles and by the
   * hourly spend-alert cron.
   */
  getCostProjection(): Promise<CostProjection>;

  /**
   * One row per day for the last `days` days, sourced from `stat_daily`
   * so the query is O(days) rows. Missing days (e.g. a stat_daily cron
   * that hasn't run yet) are filled with zeros so the UI can render a
   * contiguous sparkline.
   */
  getDailyCostSeries(days: number): Promise<DailyCostPoint[]>;

  /**
   * Today's spend and tokens grouped by `feature` tag. Hits `llm_usage`
   * live (today's partition only, small scan) so the admin dashboard
   * can show in-day cost attribution before the next stat_daily rollup.
   */
  getTodayUsageByFeature(): Promise<TodayUsageByFeature>;
}
