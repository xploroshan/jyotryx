import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name);

  constructor(private readonly prisma: PrismaService) {}

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
        this.prisma.user.count({ where: { createdAt: { lt: dayEnd } } }),
        this.prisma.user.count({ where: { createdAt: { gte: dayStart, lt: dayEnd } } }),
        this.prisma.user.count({ where: { role: { in: ['PREMIUM', 'ADMIN'] }, createdAt: { lt: dayEnd } } }),
        this.prisma.subscription.count({ where: { status: 'ACTIVE', startDate: { lt: dayEnd } } }),
        this.prisma.payment.aggregate({
          where: { status: 'SUCCESS', createdAt: { lt: dayEnd } },
          _sum: { amount: true },
        }),
        this.prisma.payment.aggregate({
          where: { status: 'SUCCESS', createdAt: { gte: dayStart, lt: dayEnd } },
          _sum: { amount: true },
        }),
        this.prisma.chatSession.count({ where: { createdAt: { lt: dayEnd } } }),
        this.prisma.chatSession.count({ where: { createdAt: { gte: dayStart, lt: dayEnd } } }),
        this.prisma.creditTransaction.aggregate({
          where: { createdAt: { gte: dayStart, lt: dayEnd }, amount: { lt: 0 } },
          _sum: { amount: true },
        }),
        this.prisma.kundliChart.count({ where: { createdAt: { lt: dayEnd } } }),
        this.prisma.matchingResult.count({ where: { createdAt: { lt: dayEnd } } }),
        this.prisma.palmistryReading.count({ where: { createdAt: { lt: dayEnd } } }),
        this.prisma.report.count({ where: { createdAt: { lt: dayEnd } } }),
        this.prisma.tarotReading.count({ where: { createdAt: { lt: dayEnd } } }),
        this.prisma.llmUsage.aggregate({
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
    return this.prisma.statDaily.findFirst({
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Get stats for a date range (for revenue trends, etc.).
   */
  async getStatsRange(from: Date, to: Date) {
    return this.prisma.statDaily.findMany({
      where: { date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    });
  }
}
