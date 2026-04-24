import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaReadReplicaService } from '../prisma/prisma-read-replica.service';

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
      ]);

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
