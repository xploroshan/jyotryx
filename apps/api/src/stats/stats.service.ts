import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaReadReplicaService } from '../prisma/prisma-read-replica.service';

// ────────────────────────────────────────────────────────────────────────
// MRR helpers
// ────────────────────────────────────────────────────────────────────────
// Pricing is stored per-currency in site_settings (INR today). A single
// FX rate converts to USD so MRR is comparable across locales. The
// default rate is a conservative INR→USD approximation that keeps the
// projection numerically stable when the setting is missing — callers
// that want accuracy should configure `pricing.fx.inr_to_usd`.
const DEFAULT_INR_TO_USD = 0.012;

/**
 * Convert a per-plan subscription count into a normalized monthly USD
 * MRR number. MONTHLY plans contribute their sticker price; ANNUAL plans
 * contribute annualPrice / 12 (amortized). FREE plans contribute 0.
 *
 * Exported so funnel/MRR admin endpoints can re-use the same math
 * against live data (not just the StatDaily rollup).
 */
export function computeMrrUsd(
  activeByPlan: Array<{ plan: string; _count: { _all: number } }>,
  pricingSettings: Array<{ key: string; value: string }>,
): number {
  const byKey = new Map(pricingSettings.map((s) => [s.key, s.value]));
  const toNum = (v: string | undefined, fallback = 0) => {
    if (!v || v.trim() === '') return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const monthlyInr = toNum(byKey.get('pricing.monthly.price'), 0);
  const annualInr  = toNum(byKey.get('pricing.annual.price'), 0);
  const fx         = toNum(byKey.get('pricing.fx.inr_to_usd'), DEFAULT_INR_TO_USD);

  let mrrInr = 0;
  for (const row of activeByPlan) {
    const count = row._count?._all ?? 0;
    if (row.plan === 'MONTHLY') mrrInr += count * monthlyInr;
    else if (row.plan === 'ANNUAL') mrrInr += count * (annualInr / 12);
    // FREE contributes nothing to MRR by definition.
  }

  // Round to 2 decimals so the Decimal(12,2) column has a clean value.
  return Math.round(mrrInr * fx * 100) / 100;
}

/**
 * Month-over-month growth rate from two MRR values. Returns 0 when
 * the prior month is zero — avoids infinite "∞% growth" on bootstrap.
 */
export function computeMomDelta(currentMrr: number, priorMrr: number): number {
  if (!priorMrr || priorMrr <= 0) return 0;
  return (currentMrr - priorMrr) / priorMrr;
}

/**
 * Naive 6-month linear projection from the MoM delta. Compounds the
 * monthly growth rate to give the MRR number owners can quote as
 * "where we'll be in 6 months if growth holds". The caller clips
 * negative MRR to zero — a business can't owe MRR.
 */
export function projectMrrSixMonths(currentMrr: number, momDelta: number): number {
  // A MoM delta ≤ -100% means "we lost everything"; compounding that
  // with an even exponent (6 months) would otherwise flip the sign
  // back to positive and project imaginary growth. Clamp to zero so
  // catastrophic-decline scenarios project to $0 instead of bouncing.
  if (momDelta <= -1) return 0;
  const projected = currentMrr * Math.pow(1 + momDelta, 6);
  return Math.max(0, Math.round(projected * 100) / 100);
}

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  /** Read replica for analytics reads; falls back to primary when unconfigured. */
  private readonly readPrisma: PrismaService;

  constructor(
    private readonly prisma: PrismaService,
    readReplicaPrisma: PrismaReadReplicaService,
  ) {
    this.readPrisma = readReplicaPrisma as unknown as PrismaService;
  }

  /**
   * Runs daily at 00:05 to compute and store yesterday's stats.
   */
  @Cron('0 5 0 * * *')
  async computeDailyStatsCron(): Promise<void> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    await this.computeAndStoreDailyStats(yesterday);
  }

  /**
   * Computes aggregate metrics for a given date and upserts into stats_daily.
   */
  async computeAndStoreDailyStats(date: Date): Promise<void> {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    try {
      const [
        totalUsers,
        newUsers,
        premiumUsers,
        activeSubscriptions,
        totalRevenueAgg,
        dailyRevenueAgg,
        totalSessions,
        dailySessions,
        creditsAgg,
        kundliCount,
        matchingCount,
        palmistryCount,
        reportCount,
        tarotCount,
        llmAgg,
        activeByPlan,
        churnedCount,
        paymentFails,
        pricingSettings,
      ] = await Promise.all([
        this.readPrisma.user.count({ where: { createdAt: { lt: dayEnd } } }),
        this.readPrisma.user.count({ where: { createdAt: { gte: dayStart, lt: dayEnd } } }),
        this.readPrisma.user.count({ where: { role: { in: ['PREMIUM', 'ADMIN'] }, createdAt: { lt: dayEnd } } }),
        this.readPrisma.subscription.count({ where: { status: 'ACTIVE', startDate: { lt: dayEnd } } }),
        this.readPrisma.payment.aggregate({
          where: { status: 'SUCCESS', createdAt: { lt: dayEnd } },
          _sum: { amount: true },
        }),
        this.readPrisma.payment.aggregate({
          where: { status: 'SUCCESS', createdAt: { gte: dayStart, lt: dayEnd } },
          _sum: { amount: true },
        }),
        this.readPrisma.chatSession.count({ where: { createdAt: { lt: dayEnd } } }),
        this.readPrisma.chatSession.count({ where: { createdAt: { gte: dayStart, lt: dayEnd } } }),
        this.readPrisma.creditTransaction.aggregate({
          where: { createdAt: { gte: dayStart, lt: dayEnd }, amount: { lt: 0 } },
          _sum: { amount: true },
        }),
        this.readPrisma.kundliChart.count({ where: { createdAt: { lt: dayEnd } } }),
        this.readPrisma.matchingResult.count({ where: { createdAt: { lt: dayEnd } } }),
        this.readPrisma.palmistryReading.count({ where: { createdAt: { lt: dayEnd } } }),
        this.readPrisma.report.count({ where: { createdAt: { lt: dayEnd } } }),
        this.readPrisma.tarotReading.count({ where: { createdAt: { lt: dayEnd } } }),
        this.readPrisma.llmUsage.aggregate({
          where: { createdAt: { gte: dayStart, lt: dayEnd } },
          _sum: { costUsd: true, totalTokens: true },
          _count: true,
        }),
        // ─── Phase 2: MRR inputs ────────────────────────────────────
        // Group active subs by plan so we can blend monthly + annual
        // rates into one normalized MRR figure.
        this.readPrisma.subscription.groupBy({
          by: ['plan'],
          where: { status: 'ACTIVE', startDate: { lt: dayEnd } },
          _count: { _all: true },
        }),
        // Subscriptions whose ACTIVE run ended today — either cancelled
        // explicitly or expired by endDate crossing the day boundary.
        this.readPrisma.subscription.count({
          where: {
            status: { in: ['CANCELLED', 'EXPIRED'] },
            endDate: { gte: dayStart, lt: dayEnd },
          },
        }),
        this.readPrisma.payment.count({
          where: {
            status: { in: ['FAILED', 'REFUNDED'] },
            createdAt: { gte: dayStart, lt: dayEnd },
          },
        }),
        // Pricing is configured per-currency in site_settings. We read
        // INR prices + the INR→USD FX rate once so MRR is reported in
        // a single stable currency across locales.
        this.readPrisma.siteSetting.findMany({
          where: {
            key: {
              in: [
                'pricing.monthly.price',
                'pricing.annual.price',
                'pricing.fx.inr_to_usd',
              ],
            },
          },
          select: { key: true, value: true },
        }),
      ]);

      const mrrUsd = computeMrrUsd(activeByPlan as Array<{ plan: string; _count: { _all: number } }>, pricingSettings as Array<{ key: string; value: string }>);

      await this.prisma.statDaily.upsert({
        where: { date: dayStart },
        update: {
          totalUsers,
          newUsers,
          premiumUsers,
          activeSubscriptions,
          totalRevenue: Number(totalRevenueAgg._sum.amount ?? 0),
          dailyRevenue: Number(dailyRevenueAgg._sum.amount ?? 0),
          totalSessions,
          dailySessions,
          creditsConsumed: Math.abs(Number(creditsAgg._sum.amount ?? 0)),
          kundliCount,
          matchingCount,
          palmistryCount,
          reportCount,
          tarotCount,
          llmCalls: llmAgg._count,
          llmCostUsd: Number(llmAgg._sum.costUsd ?? 0),
          llmTokens: Number(llmAgg._sum.totalTokens ?? 0),
          mrrUsd,
          churnedCount,
          paymentFails,
        },
        create: {
          date: dayStart,
          totalUsers,
          newUsers,
          premiumUsers,
          activeSubscriptions,
          totalRevenue: Number(totalRevenueAgg._sum.amount ?? 0),
          dailyRevenue: Number(dailyRevenueAgg._sum.amount ?? 0),
          totalSessions,
          dailySessions,
          creditsConsumed: Math.abs(Number(creditsAgg._sum.amount ?? 0)),
          kundliCount,
          matchingCount,
          palmistryCount,
          reportCount,
          tarotCount,
          llmCalls: llmAgg._count,
          llmCostUsd: Number(llmAgg._sum.costUsd ?? 0),
          llmTokens: Number(llmAgg._sum.totalTokens ?? 0),
          mrrUsd,
          churnedCount,
          paymentFails,
        },
      });

      this.logger.log(`Stats computed for ${dayStart.toISOString().slice(0, 10)}`);
    } catch (error: any) {
      this.logger.error(`Failed to compute stats for ${date.toISOString().slice(0, 10)}: ${error.message}`);
    }
  }

  /**
   * Get the most recent stats_daily row (for admin dashboard acceleration).
   */
  async getLatestStats() {
    return this.readPrisma.statDaily.findFirst({
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Get stats for a date range (for revenue trends, etc.).
   */
  async getStatsRange(from: Date, to: Date) {
    return this.readPrisma.statDaily.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    });
  }

  // ────────────────────────────────────────────────────────────────────
  // Spend alert (Phase 1)
  // ────────────────────────────────────────────────────────────────────

  /**
   * Hourly sweep: if today's running LLM spend crosses the daily
   * threshold configured in `site_settings.notification.cost.daily_usd`
   * (or the month-to-date total crosses the monthly threshold), write
   * a single `COST_ALERT_TRIPPED` row to `activity_log`. The tripped
   * state is deduped per-day/per-scope by checking whether an alert
   * for the same scope already exists since the window started, so the
   * owner gets one alert per threshold breach — not one every hour.
   *
   * Extracted as a named method so integration tests can call it
   * directly without waiting on the cron.
   */
  @Cron('0 0 * * * *')
  async checkSpendThresholdsCron(): Promise<void> {
    await this.checkSpendThresholds().catch((err) => {
      this.logger.error(`checkSpendThresholds failed: ${err?.message ?? err}`);
    });
  }

  async checkSpendThresholds(): Promise<{ tripped: Array<'daily' | 'monthly'> }> {
    const settings = await this.readPrisma.siteSetting.findMany({
      where: { key: { in: ['notification.cost.daily_usd', 'notification.cost.monthly_usd'] } },
      select: { key: true, value: true },
    });
    const byKey = new Map<string, string>(settings.map((s: any) => [s.key, s.value]));
    const toNum = (v: string | undefined) => (v && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : null);
    const dailyLimit = toNum(byKey.get('notification.cost.daily_usd'));
    const monthlyLimit = toNum(byKey.get('notification.cost.monthly_usd'));
    if (dailyLimit == null && monthlyLimit == null) return { tripped: [] };

    const now = new Date();
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [dayAgg, monthAgg] = await Promise.all([
      this.readPrisma.llmUsage.aggregate({
        where: { createdAt: { gte: dayStart, lte: now } },
        _sum: { costUsd: true },
      }),
      this.readPrisma.llmUsage.aggregate({
        where: { createdAt: { gte: monthStart, lte: now } },
        _sum: { costUsd: true },
      }),
    ]);
    const daySpend = Number(dayAgg._sum.costUsd ?? 0);
    const monthSpend = Number(monthAgg._sum.costUsd ?? 0);

    const tripped: Array<'daily' | 'monthly'> = [];

    // Daily
    if (dailyLimit != null && daySpend >= dailyLimit) {
      const alreadyTripped = await this.readPrisma.activityLog.count({
        where: {
          action: 'COST_ALERT_TRIPPED',
          createdAt: { gte: dayStart },
          entityLabel: 'daily',
        },
      });
      if (alreadyTripped === 0) {
        await this.prisma.activityLog.create({
          data: {
            adminId: null,
            adminEmail: 'system',
            action: 'COST_ALERT_TRIPPED',
            entityType: 'CostAlert',
            entityId: null,
            entityLabel: 'daily',
            previousData: null,
            newData: { scope: 'daily', threshold: dailyLimit, spend: daySpend } as any,
          },
        });
        this.logger.warn(`Daily LLM spend threshold tripped: $${daySpend.toFixed(2)} ≥ $${dailyLimit}`);
        tripped.push('daily');
      }
    }

    // Monthly
    if (monthlyLimit != null && monthSpend >= monthlyLimit) {
      const alreadyTripped = await this.readPrisma.activityLog.count({
        where: {
          action: 'COST_ALERT_TRIPPED',
          createdAt: { gte: monthStart },
          entityLabel: 'monthly',
        },
      });
      if (alreadyTripped === 0) {
        await this.prisma.activityLog.create({
          data: {
            adminId: null,
            adminEmail: 'system',
            action: 'COST_ALERT_TRIPPED',
            entityType: 'CostAlert',
            entityId: null,
            entityLabel: 'monthly',
            previousData: null,
            newData: { scope: 'monthly', threshold: monthlyLimit, spend: monthSpend } as any,
          },
        });
        this.logger.warn(`Monthly LLM spend threshold tripped: $${monthSpend.toFixed(2)} ≥ $${monthlyLimit}`);
        tripped.push('monthly');
      }
    }

    return { tripped };
  }
}
