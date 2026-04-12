import { Injectable, Logger } from '@nestjs/common';
import { PrismaReadReplicaService } from '../prisma/prisma-read-replica.service';
import {
  AnalyticsService,
  LlmCostByUser,
  LlmTotals,
  LlmUsageByFeature,
  LlmUsageByProvider,
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
}
