import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaReadReplicaService } from '../prisma/prisma-read-replica.service';
import {
  holtForecast,
  linearTrend,
  daysUntilLimit,
  HoltForecastResult,
} from './forecast-helpers';

// ─── Response shapes ──────────────────────────────────────────────────────

export interface CostForecastPoint {
  date: string;
  /** History datapoint (null on future dates). */
  actualUsd: number | null;
  /** Forecast datapoint (null on past dates). */
  predictedUsd: number | null;
  /** 1-sigma confidence band around the prediction. */
  lowerUsd: number | null;
  upperUsd: number | null;
}

export interface CostForecast {
  /** Flattened series suitable for a single stacked chart: past + future. */
  points: CostForecastPoint[];
  /** Parameters the caller may want to display ("forecast drifts at $X/day"). */
  level: number;
  trend: number;
  residualStd: number;
}

export interface CapacityForecast {
  provider: string;
  /** Admin-configured TPM (tokens per minute) ceiling, or null if unset. */
  tpmLimit: number | null;
  /** Trailing-7d peak TPM (max minute across all days). */
  currentPeakTpm: number;
  /** Daily change in peak TPM from the linear fit. */
  slopePerDay: number;
  /** Rounded days until peak TPM crosses the configured limit. Infinity if never. */
  daysUntilHit: number | null;
}

@Injectable()
export class ForecastService {
  private readonly logger = new Logger(ForecastService.name);
  private readonly readPrisma: PrismaService;

  constructor(
    _prisma: PrismaService,
    readReplica: PrismaReadReplicaService,
  ) {
    this.readPrisma = readReplica as unknown as PrismaService;
  }

  // ────────────────────────────────────────────────────────────────────
  // Cost forecast (Holt trend smoothing over stat_daily.llmCostUsd)
  // ────────────────────────────────────────────────────────────────────

  /**
   * Build a forecast curve for the admin Cost tab. Pulls the past
   * `lookbackDays` of `stat_daily.llmCostUsd`, fits the Holt model on
   * that history, and returns a single series covering both history
   * and `forecastDays` future days so the chart can render them as
   * one continuous line.
   */
  async getCostForecast(opts: {
    lookbackDays?: number;
    forecastDays?: number;
  } = {}): Promise<CostForecast> {
    const lookback = Math.min(365, Math.max(7, opts.lookbackDays ?? 60));
    const horizon = Math.min(90, Math.max(7, opts.forecastDays ?? 30));

    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - lookback);

    const rows = await this.readPrisma.statDaily.findMany({
      where: { date: { gte: since } },
      orderBy: { date: 'asc' },
      select: { date: true, llmCostUsd: true },
    });

    const history = rows.map((r: any) => Number(r.llmCostUsd ?? 0));
    const fit: HoltForecastResult = holtForecast(history, horizon);

    const points: CostForecastPoint[] = [];

    // Historical dates — actuals, no forecast overlay yet.
    for (let i = 0; i < rows.length; i++) {
      points.push({
        date: (rows[i].date as Date).toISOString().slice(0, 10),
        actualUsd: history[i],
        predictedUsd: null,
        lowerUsd: null,
        upperUsd: null,
      });
    }

    // Future dates — forecast + 1σ band. Date seed is "day after last
    // historical row" so the chart's x-axis is contiguous.
    const lastDate = rows.length > 0
      ? new Date(rows[rows.length - 1].date as Date)
      : (() => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d; })();
    for (let h = 1; h <= horizon; h++) {
      const d = new Date(lastDate);
      d.setUTCDate(d.getUTCDate() + h);
      const predicted = fit.forecast[h - 1];
      points.push({
        date: d.toISOString().slice(0, 10),
        actualUsd: null,
        predictedUsd: round2(predicted),
        lowerUsd: round2(Math.max(0, predicted - fit.residualStd)),
        upperUsd: round2(predicted + fit.residualStd),
      });
    }

    return {
      points,
      level: round2(fit.level),
      trend: round2(fit.trend),
      residualStd: round2(fit.residualStd),
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // Capacity forecast (minute-peak TPM vs provider limit)
  // ────────────────────────────────────────────────────────────────────

  /**
   * "Hit OpenAI TPM limit in N days" — reads the trailing 7 days of
   * `llm_usage`, buckets into (day, minute) and finds the peak-minute
   * tokens per day, fits a linear trend, and projects against the
   * admin-configured ceiling at `pricing.llm.{provider}.tpm_limit`.
   *
   * When no ceiling is configured, `tpmLimit` and `daysUntilHit` are
   * null and the UI renders "set a TPM limit to enable this forecast".
   */
  async getCapacityForecast(providers: string[] = ['openai']): Promise<CapacityForecast[]> {
    // Read all configured provider TPM ceilings in one shot so we
    // don't N+1 the settings table.
    const settings = await this.readPrisma.siteSetting.findMany({
      where: {
        key: { in: providers.map((p) => `pricing.llm.${p}.tpm_limit`) },
      },
      select: { key: true, value: true },
    });
    const limitByProvider = new Map<string, number>();
    for (const s of settings as Array<{ key: string; value: string }>) {
      const provider = s.key.slice('pricing.llm.'.length, -'.tpm_limit'.length);
      const n = Number(s.value);
      if (Number.isFinite(n) && n > 0) limitByProvider.set(provider, n);
    }

    const out: CapacityForecast[] = [];
    for (const provider of providers) {
      out.push(await this.computeProviderCapacity(provider, limitByProvider.get(provider) ?? null));
    }
    return out;
  }

  private async computeProviderCapacity(
    provider: string,
    limit: number | null,
  ): Promise<CapacityForecast> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400 * 1000);

    // Bucket into (day, minute) and sum total_tokens, then take the
    // MAX per day to get the day's peak TPM. Single SQL — cheap on
    // the 7-day partition slice.
    const rows = await this.readPrisma.$queryRawUnsafe<
      Array<{ day: Date; peak_tpm: bigint | number }>
    >(
      `
      WITH per_minute AS (
        SELECT
          DATE_TRUNC('day', "created_at" AT TIME ZONE 'UTC')::date AS day,
          DATE_TRUNC('minute', "created_at") AS minute,
          SUM("total_tokens")::bigint AS minute_tokens
        FROM "llm_usage"
        WHERE "created_at" >= $1::timestamptz
          AND "provider" = $2
          AND "error_code" IS NULL
        GROUP BY day, minute
      )
      SELECT day, MAX(minute_tokens)::bigint AS peak_tpm
      FROM per_minute
      GROUP BY day
      ORDER BY day ASC
      `,
      sevenDaysAgo,
      provider,
    );

    const series = rows.map((r: any) => Number(r.peak_tpm));
    const currentPeakTpm = series.length > 0 ? series[series.length - 1] : 0;
    const { slope } = linearTrend(series);

    const days = limit != null ? daysUntilLimit(currentPeakTpm, slope, limit) : null;

    return {
      provider,
      tpmLimit: limit,
      currentPeakTpm,
      slopePerDay: Math.round(slope * 100) / 100,
      daysUntilHit: days === null
        ? null
        : !Number.isFinite(days) ? null : days,
    };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
