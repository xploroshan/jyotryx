import { Injectable, Logger } from '@nestjs/common';
import { PrismaReadReplicaService } from '../prisma/prisma-read-replica.service';
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
 * Postgres-backed analytics implementation.
 * Queries the read replica for all aggregations — keeps the primary lean.
 */
@Injectable()
export class PostgresAnalyticsService implements AnalyticsService {
  private readonly logger = new Logger(PostgresAnalyticsService.name);
  private readonly prisma: any;

  constructor(private readonly readPrisma: PrismaReadReplicaService) {
    this.prisma = readPrisma;
  }

  async getLlmCostsByUser(limit: number = 20, days: number = 30): Promise<LlmCostByUser[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const grouped = await this.prisma.llmUsage.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: since } },
      _sum: { costUsd: true, totalTokens: true },
      _count: true,
      orderBy: { _sum: { costUsd: 'desc' } },
      take: limit,
    });

    const userIds = grouped
      .map((g: any) => g.userId)
      .filter((id: string | null): id is string => !!id);

    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];

    type UserRow = { id: string; name: string | null; email: string };
    const userMap = new Map<string, UserRow>(
      users.map((u: UserRow) => [u.id, u]),
    );

    return grouped.map((row: any) => {
      const user: UserRow | null = row.userId
        ? userMap.get(row.userId) ?? null
        : null;
      return {
        userId: row.userId,
        userName: user?.name ?? null,
        userEmail: user?.email ?? null,
        calls: row._count,
        totalTokens: Number(row._sum.totalTokens ?? 0),
        totalCostUsd: Number(row._sum.costUsd ?? 0),
      };
    });
  }

  async getLlmTotals(days: number = 7): Promise<LlmTotals> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const agg = await this.prisma.llmUsage.aggregate({
      where: { createdAt: { gte: since } },
      _sum: { costUsd: true, totalTokens: true },
      _count: true,
    });

    return {
      calls: agg._count,
      totalTokens: Number(agg._sum.totalTokens ?? 0),
      totalCostUsd: Number(agg._sum.costUsd ?? 0),
    };
  }

  async getLlmUsageByFeature(days: number = 30): Promise<LlmUsageByFeature[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const grouped = await this.prisma.llmUsage.groupBy({
      by: ['feature'],
      where: { createdAt: { gte: since } },
      _sum: { costUsd: true, totalTokens: true },
      _count: true,
      orderBy: { _sum: { costUsd: 'desc' } },
    });

    return grouped.map((row: any) => ({
      feature: row.feature,
      calls: row._count,
      totalTokens: Number(row._sum.totalTokens ?? 0),
      costUsd: Number(row._sum.costUsd ?? 0),
    }));
  }

  async getLlmUsageByProvider(days: number = 30): Promise<LlmUsageByProvider[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const grouped = await this.prisma.llmUsage.groupBy({
      by: ['provider', 'model'],
      where: { createdAt: { gte: since } },
      _sum: { costUsd: true, totalTokens: true },
      _count: true,
      orderBy: { _sum: { costUsd: 'desc' } },
    });

    return grouped.map((row: any) => ({
      provider: row.provider,
      model: row.model,
      calls: row._count,
      totalTokens: Number(row._sum.totalTokens ?? 0),
      costUsd: Number(row._sum.costUsd ?? 0),
    }));
  }

  async getCostProjection(): Promise<CostProjection> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    // Same point-in-month a month ago — if today is the 24th, compare
    // against the 1st-to-24th window of the previous month.
    const prevMonthSameDay = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      now.getDate(),
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
    );
    const daysElapsed = Math.max(1, Math.floor((now.getTime() - monthStart.getTime()) / 86_400_000) + 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const [mtdAgg, prevAgg] = await Promise.all([
      this.prisma.llmUsage.aggregate({
        where: { createdAt: { gte: monthStart, lte: now } },
        _sum: { costUsd: true },
      }),
      this.prisma.llmUsage.aggregate({
        where: { createdAt: { gte: prevMonthStart, lte: prevMonthSameDay } },
        _sum: { costUsd: true },
      }),
    ]);

    const mtdUsd = Number(mtdAgg._sum.costUsd ?? 0);
    const prevMtdUsd = Number(prevAgg._sum.costUsd ?? 0);
    // Project linearly from MTD. Rounds to 2 dp so the UI number is
    // stable across reloads.
    const projectionUsd = Math.round((mtdUsd * daysInMonth) / daysElapsed * 100) / 100;

    return { mtdUsd, prevMtdUsd, projectionUsd };
  }

  async getDailyCostSeries(days: number = 30): Promise<DailyCostPoint[]> {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));

    // stat_daily is one row per date, written by StatsService cron at
    // 00:05 UTC. Querying it instead of llm_usage keeps this endpoint
    // fast (≤ 90 rows even on a year-window) and avoids repeat scans
    // over the partitioned source table.
    const rows = await this.prisma.statDaily.findMany({
      where: { date: { gte: since } },
      orderBy: { date: 'asc' },
      select: { date: true, llmCostUsd: true, llmTokens: true },
    });

    // Fill missing days with zeros so the frontend sparkline has a
    // contiguous series regardless of cron timing.
    const byDate = new Map<string, { costUsd: number; tokens: number }>();
    for (const r of rows) {
      const key = (r.date as Date).toISOString().slice(0, 10);
      byDate.set(key, { costUsd: Number(r.llmCostUsd ?? 0), tokens: Number(r.llmTokens ?? 0) });
    }

    const series: DailyCostPoint[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const hit = byDate.get(key);
      series.push({ date: key, costUsd: hit?.costUsd ?? 0, tokens: hit?.tokens ?? 0 });
    }
    return series;
  }

  async getTodayUsageByFeature(): Promise<TodayUsageByFeature> {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);

    const grouped = await this.prisma.llmUsage.groupBy({
      by: ['feature'],
      where: { createdAt: { gte: dayStart } },
      _sum: { costUsd: true, totalTokens: true },
    });

    const out: TodayUsageByFeature = {};
    for (const row of grouped) {
      out[row.feature] = {
        tokens: Number(row._sum.totalTokens ?? 0),
        costUsd: Number(row._sum.costUsd ?? 0),
      };
    }
    return out;
  }
}
