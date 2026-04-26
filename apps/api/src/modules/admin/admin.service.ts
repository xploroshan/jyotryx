import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';

import { Inject } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaReadReplicaService } from '../../prisma/prisma-read-replica.service';
import { OpenAIService } from '../../openai/openai.service';
import { StatsService } from '../../stats/stats.service';
import {
  ANALYTICS_SERVICE,
  AnalyticsService,
  CostProjection,
  DailyCostPoint,
  LlmUsageByFeature,
  LlmUsageByProvider,
  TodayUsageByFeature,
} from '../../analytics/analytics.interface';
import { GdprPurgeService } from './gdpr-purge.service';
import { AuthService } from '../auth/auth.service';
import { LlmService } from '../../llm/llm.service';
import { BroadcastService, BroadcastRequest } from '../../ops/broadcast.service';
// Phase 4 injections — safety + GDPR + in-app notifications (for the
// churn retry-email action). The forecast service is called directly
// from the controller because it has no activity-log side effects.
import {
  SafetyService,
  FlaggedMessageRow,
  ResolveAction,
} from '../../safety/safety.service';
import {
  GdprRequestService,
  GdprRequestRow,
  GdprType,
  UserDataExport,
} from '../../gdpr/gdpr-request.service';
import { NotificationService } from '../notification/notification.service';

export interface DashboardStats {
  totalUsers: number;
  premiumUsers: number;
  totalRevenue: number;
  totalChats: number;
  totalKundlis: number;
  totalPayments: number;
  newUsersToday: number;
  activeSubscriptions: number;
}

export interface UserListItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  /** Current balance (already in `users.credits`). */
  credits: number;
  /** Lifetime sum of negative `credit_transactions` rows for this user.
   *  The "given" total is derived client-side as `credits + creditsUsed`,
   *  which is mathematically correct for users who have only ever been
   *  granted credits and consumed them — i.e. everyone except cases
   *  where Edit-User absolute sets reduced the balance, which are rare
   *  and don't write transaction rows. */
  creditsUsed: number;
  provider: string;
  createdAt: string;
  subscriptionStatus: string | null;
  subscriptionPlan: string | null;
}

export interface UserDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  credits: number;
  provider: string;
  gender: string | null;
  dateOfBirth: string | null;
  timeOfBirth: string | null;
  placeOfBirth: any;
  preferredLanguage: string;
  createdAt: string;
  updatedAt: string;
  subscriptions: any[];
  recentPayments: any[];
  recentChats: any[];
  creditTransactions: any[];
  reports: any[];
  stats: {
    totalChats: number;
    totalPayments: number;
    totalSpent: number;
    totalCreditsUsed: number;
    kundliCharts: number;
    palmistryReadings: number;
    matchingResults: number;
  };
  /**
   * Per-feature credit-spend breakdown derived from `credit_transactions`
   * descriptions. Same source as `creditTransactions[]` above; this is
   * the GROUP-BY rollup so the user-detail panel can show
   * "Kundli: 8, Chat: 12, Tarot: 3" without the client recomputing.
   */
  creditsByFeature: Array<{ feature: string; totalCredits: number; count: number }>;
  llmUsage: {
    totalCostUsd: number;
    totalTokens: number;
    totalCalls: number;
    byProvider: Array<{ provider: string; model: string; calls: number; totalTokens: number; costUsd: number }>;
    byFeature: Array<{ feature: string; calls: number; totalTokens: number; costUsd: number }>;
    recent: Array<{ id: string; provider: string; model: string; feature: string; totalTokens: number; costUsd: number; createdAt: string }>;
  };
}

export interface PlatformAnalytics {
  sessionsToday: number;
  sessionsLast7Days: number;
  avgSessionsPerDay: number;
  avgChatLength: number;
  creditsConsumedToday: number;
  creditsConsumedLast7Days: number;
  /**
   * Org-level credits spent grouped by feature over the last 7 days.
   * Same shape as the per-user `creditsByFeature` on UserDetail. Lets
   * the Analytics tab answer "what are users actually buying with
   * their credits" without joining against feature-specific tables.
   */
  creditsByFeatureLast7Days: Array<{ feature: string; totalCredits: number; count: number }>;
  revenueTrend: Array<{ date: string; revenue: number }>; // last 7 days
  featureUsage: Array<{ feature: string; count: number; percent: number }>;
  conversionRate: number; // % of total users who are premium
  retention: { day1: number; day7: number; day30: number };
  llmTotals: {
    callsLast7Days: number;
    totalCostUsdLast7Days: number;
    totalTokensLast7Days: number;
  };
}

export interface LlmCostRow {
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  calls: number;
  totalTokens: number;
  totalCostUsd: number;
}

export interface AdminUserUpdate {
  role?: 'USER' | 'PREMIUM' | 'ADMIN';
  credits?: number;
  name?: string;
  email?: string;
  phone?: string | null;
  gender?: string | null;
  preferredLanguage?: string;
}

export interface ActivityLogItem {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  previousData: any;
  newData: any;
  undone: boolean;
  undoneAt: string | null;
  createdAt: string;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  /** Read replica for analytics queries; falls back to primary when unconfigured. */
  private readonly readPrisma: PrismaService;

  constructor(
    private prisma: PrismaService,
    private readReplicaPrisma: PrismaReadReplicaService,
    private openaiService: OpenAIService,
    private statsService: StatsService,
    @Inject(ANALYTICS_SERVICE) private analyticsService: AnalyticsService,
    private gdprPurgeService: GdprPurgeService,
    private authService: AuthService,
    private llmService: LlmService,
    private broadcastSvc: BroadcastService,
    private safetyService: SafetyService,
    private gdprRequestService: GdprRequestService,
    private notificationService: NotificationService,
  ) {
    // Analytics / read-only queries go through the replica
    this.readPrisma = readReplicaPrisma as unknown as PrismaService;
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      premiumUsers,
      revenueResult,
      totalChats,
      totalKundlis,
      totalPayments,
      newUsersToday,
      activeSubscriptions,
    ] = await Promise.all([
      this.readPrisma.user.count(),
      this.readPrisma.user.count({ where: { role: { in: ['PREMIUM', 'ADMIN'] } } }),
      this.readPrisma.payment.aggregate({
        where: { status: 'SUCCESS' },
        _sum: { amount: true },
      }),
      this.readPrisma.chatSession.count(),
      this.readPrisma.kundliChart.count(),
      this.readPrisma.payment.count({ where: { status: 'SUCCESS' } }),
      this.readPrisma.user.count({ where: { createdAt: { gte: today } } }),
      this.readPrisma.subscription.count({ where: { status: 'ACTIVE' } }),
    ]);

    return {
      totalUsers,
      premiumUsers,
      totalRevenue: Number(revenueResult._sum.amount ?? 0),
      totalChats,
      totalKundlis,
      totalPayments,
      newUsersToday,
      activeSubscriptions,
    };
  }

  async getUsers(page: number = 1, limit: number = 20, search?: string): Promise<{ users: UserListItem[]; total: number }> {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.readPrisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          credits: true,
          provider: true,
          createdAt: true,
          subscriptions: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { plan: true, status: true },
          },
        },
      }),
      this.readPrisma.user.count({ where }),
    ]);

    // Single round-trip group-by for the page's users; avoids the
    // N+1 we'd get from per-row aggregates and keeps the list endpoint
    // fast even when `limit` climbs.
    const userIds = users.map((u: any) => u.id);
    const usageRows =
      userIds.length === 0
        ? []
        : await this.readPrisma.creditTransaction.groupBy({
            by: ['userId'],
            where: { userId: { in: userIds }, amount: { lt: 0 } },
            _sum: { amount: true },
          });
    const usageMap = new Map<string, number>(
      usageRows.map((r: any) => [r.userId as string, Math.abs(Number(r._sum.amount ?? 0))]),
    );

    return {
      users: users.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        credits: u.credits,
        creditsUsed: usageMap.get(u.id) ?? 0,
        provider: u.provider,
        createdAt: u.createdAt.toISOString(),
        subscriptionStatus: u.subscriptions[0]?.status ?? null,
        subscriptionPlan: u.subscriptions[0]?.plan ?? null,
      })),
      total,
    };
  }

  async getUserDetail(userId: string): Promise<UserDetail> {
    const user = await this.readPrisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        chatSessions: {
          orderBy: { updatedAt: 'desc' },
          take: 10,
        },
        creditTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 30,
        },
        reports: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const [
      totalPaymentsAgg,
      totalCreditsUsed,
      kundliCount,
      palmistryCount,
      matchingCount,
      creditsByFeature,
    ] = await Promise.all([
      this.readPrisma.payment.aggregate({
        where: { userId, status: 'SUCCESS' },
        _sum: { amount: true },
        _count: true,
      }),
      this.readPrisma.creditTransaction.aggregate({
        where: { userId, amount: { lt: 0 } },
        _sum: { amount: true },
      }),
      this.readPrisma.kundliChart.count({ where: { userId } }),
      this.readPrisma.palmistryReading.count({ where: { userId } }),
      this.readPrisma.matchingResult.count({ where: { userId } }),
      this.aggregateCreditsByFeature(userId),
    ]);

    // The llm_usage queries are split out from the Promise.all above so a
    // schema-drift hiccup on that one table can't take the whole user
    // detail panel offline. The findMany returns every column on
    // `llm_usage` — the four ops-telemetry columns (`duration_ms` etc.)
    // are now `@map`'d in schema.prisma, but if the deployed Prisma
    // client ever drifts ahead of an unmigrated DB again the panel
    // should still render with the rest of the data and a zeroed
    // `llmUsage` block instead of a 500.
    const llm = await this.fetchLlmUsageSafely(userId);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      credits: user.credits,
      provider: user.provider,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth?.toISOString() ?? null,
      timeOfBirth: user.timeOfBirth,
      placeOfBirth: user.placeOfBirth,
      preferredLanguage: user.preferredLanguage,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      subscriptions: user.subscriptions.map((s: any) => ({
        id: s.id,
        plan: s.plan,
        status: s.status,
        startDate: s.startDate.toISOString(),
        endDate: s.endDate?.toISOString() ?? null,
        createdAt: s.createdAt.toISOString(),
      })),
      recentPayments: user.payments.map((p: any) => ({
        id: p.id,
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status,
        type: p.type,
        createdAt: p.createdAt.toISOString(),
      })),
      recentChats: await Promise.all(user.chatSessions.map(async (c: any) => {
        const msgCount = await this.readPrisma.chatMessage.count({ where: { sessionId: c.id } });
        return {
          id: c.id,
          title: c.title,
          category: c.category,
          messageCount: msgCount,
          updatedAt: c.updatedAt.toISOString(),
        };
      })),
      creditTransactions: user.creditTransactions.map((t: any) => ({
        id: t.id,
        amount: t.amount,
        type: t.type,
        description: t.description,
        createdAt: t.createdAt.toISOString(),
      })),
      reports: user.reports.map((r: any) => ({
        id: r.id,
        type: r.type,
        status: r.status,
        price: Number(r.price),
        createdAt: r.createdAt.toISOString(),
      })),
      stats: {
        totalChats: user.chatSessions.length,
        totalPayments: totalPaymentsAgg._count,
        totalSpent: Number(totalPaymentsAgg._sum.amount ?? 0),
        totalCreditsUsed: Math.abs(Number(totalCreditsUsed._sum.amount ?? 0)),
        kundliCharts: kundliCount,
        palmistryReadings: palmistryCount,
        matchingResults: matchingCount,
      },
      creditsByFeature,
      llmUsage: llm,
    };
  }

  /**
   * Group a user's negative-amount `credit_transactions` rows into
   * feature buckets by parsing the description prefix. The descriptions
   * are written by the deductCredits call sites (kundli/chat/palmistry/
   * tarot/vastu/report) so the prefix maps deterministically.
   *
   * Returned rows are sorted by spend descending; the empty-history case
   * yields `[]` rather than a 500.
   */
  private async aggregateCreditsByFeature(
    userId: string,
  ): Promise<Array<{ feature: string; totalCredits: number; count: number }>> {
    const rows = await this.readPrisma.$queryRawUnsafe<
      Array<{ feature: string; total_credits: bigint; count: bigint }>
    >(
      AdminService.CREDITS_BY_FEATURE_SQL +
        ` WHERE "userId" = $1::uuid AND amount < 0
          GROUP BY feature
          ORDER BY total_credits DESC`,
      userId,
    );
    return rows.map((r) => ({
      feature: r.feature,
      totalCredits: Number(r.total_credits),
      count: Number(r.count),
    }));
  }

  /**
   * SQL fragment that classifies a `credit_transactions` description
   * into a high-level feature bucket. Used in two places: per-user in
   * `aggregateCreditsByFeature`, and org-wide in `getPlatformAnalytics`.
   * Kept as a class constant so both queries stay in lock-step when a
   * new feature description prefix is added.
   */
  private static readonly CREDITS_BY_FEATURE_SQL = `
    SELECT
      CASE
        WHEN description ILIKE 'Kundli%'      THEN 'Kundli'
        WHEN description ILIKE 'Divisional%'  THEN 'Astrology'
        WHEN description ILIKE 'Chat%'        THEN 'Chat'
        WHEN description ILIKE 'Palmistry%'   THEN 'Palmistry'
        WHEN description ILIKE 'Tarot%'       THEN 'Tarot'
        WHEN description ILIKE 'Vastu%'       THEN 'Vastu'
        WHEN description ILIKE '%report%'     THEN 'Report'
        ELSE COALESCE(NULLIF(description, ''), 'Other')
      END AS feature,
      ABS(SUM(amount))::bigint AS total_credits,
      COUNT(*)::bigint AS count
    FROM credit_transactions`;

  /**
   * LLM-usage block of `getUserDetail`, hardened so any single failure
   * (Prisma client/schema drift, partition gone missing, JSON encoding
   * of bigints) returns zeros instead of bubbling a 500 to the admin
   * panel. Logs the underlying error so we still see drift in the
   * service log.
   */
  private async fetchLlmUsageSafely(userId: string): Promise<UserDetail['llmUsage']> {
    const empty: UserDetail['llmUsage'] = {
      totalCostUsd: 0,
      totalTokens: 0,
      totalCalls: 0,
      byProvider: [],
      byFeature: [],
      recent: [],
    };
    try {
      const [llmTotals, llmByProvider, llmByFeature, llmRecent] = await Promise.all([
        this.readPrisma.llmUsage.aggregate({
          where: { userId },
          _sum: { costUsd: true, totalTokens: true },
          _count: true,
        }),
        this.readPrisma.llmUsage.groupBy({
          by: ['provider', 'model'],
          where: { userId },
          _sum: { costUsd: true, totalTokens: true },
          _count: true,
        }),
        this.readPrisma.llmUsage.groupBy({
          by: ['feature'],
          where: { userId },
          _sum: { costUsd: true, totalTokens: true },
          _count: true,
        }),
        this.readPrisma.llmUsage.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      ]);
      return {
        totalCostUsd: Number(llmTotals._sum.costUsd ?? 0),
        totalTokens: Number(llmTotals._sum.totalTokens ?? 0),
        totalCalls: llmTotals._count,
        byProvider: llmByProvider.map((row: any) => ({
          provider: row.provider,
          model: row.model,
          calls: row._count,
          totalTokens: Number(row._sum.totalTokens ?? 0),
          costUsd: Number(row._sum.costUsd ?? 0),
        })),
        byFeature: llmByFeature.map((row: any) => ({
          feature: row.feature,
          calls: row._count,
          totalTokens: Number(row._sum.totalTokens ?? 0),
          costUsd: Number(row._sum.costUsd ?? 0),
        })),
        recent: llmRecent.map((row: any) => ({
          id: row.id,
          provider: row.provider,
          model: row.model,
          feature: row.feature,
          totalTokens: row.totalTokens,
          costUsd: Number(row.costUsd),
          createdAt: row.createdAt.toISOString(),
        })),
      };
    } catch (err: any) {
      this.logger.warn(
        `getUserDetail: llm_usage block failed for ${userId}, returning zeros: ${err?.message ?? err}`,
      );
      return empty;
    }
  }

  async updateUser(
    userId: string,
    dto: AdminUserUpdate,
    adminId: string,
    adminEmail: string,
  ): Promise<UserListItem> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          take: 1,
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const previousData: Record<string, any> = {};
    const newData: Record<string, any> = {};
    const updateData: Record<string, any> = {};

    if (dto.role && dto.role !== user.role) {
      previousData.role = user.role;
      newData.role = dto.role;
      updateData.role = dto.role;
    }
    if (dto.credits !== undefined && dto.credits !== user.credits) {
      previousData.credits = user.credits;
      newData.credits = dto.credits;
      updateData.credits = dto.credits;
    }
    if (dto.name && dto.name !== user.name) {
      previousData.name = user.name;
      newData.name = dto.name;
      updateData.name = dto.name;
    }
    if (dto.email && dto.email !== user.email) {
      previousData.email = user.email;
      newData.email = dto.email;
      updateData.email = dto.email;
    }
    if (dto.phone !== undefined && dto.phone !== user.phone) {
      previousData.phone = user.phone;
      newData.phone = dto.phone;
      updateData.phone = dto.phone;
    }
    if (dto.gender !== undefined && dto.gender !== user.gender) {
      previousData.gender = user.gender;
      newData.gender = dto.gender;
      updateData.gender = dto.gender;
    }
    if (dto.preferredLanguage && dto.preferredLanguage !== user.preferredLanguage) {
      previousData.preferredLanguage = user.preferredLanguage;
      newData.preferredLanguage = dto.preferredLanguage;
      updateData.preferredLanguage = dto.preferredLanguage;
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('No changes to apply');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          take: 1,
        },
      },
    });

    // Determine action type
    let action: 'USER_UPDATE' | 'USER_CREDITS_UPDATE' | 'USER_ROLE_CHANGE' = 'USER_UPDATE';
    if (dto.role && Object.keys(updateData).length === 1) action = 'USER_ROLE_CHANGE';
    if (dto.credits !== undefined && Object.keys(updateData).length === 1) action = 'USER_CREDITS_UPDATE';

    await this.prisma.activityLog.create({
      data: {
        adminId,
        adminEmail,
        action,
        entityType: 'User',
        entityId: userId,
        entityLabel: user.email,
        previousData,
        newData,
      },
    });

    this.logger.log(`Admin ${adminEmail} updated user ${userId}: ${JSON.stringify(dto)}`);

    // Same lifetime-deductions sum used by `getUsers`, so the row the
    // frontend re-renders after Edit User keeps the Usage column accurate.
    const usedAgg = await this.readPrisma.creditTransaction.aggregate({
      where: { userId, amount: { lt: 0 } },
      _sum: { amount: true },
    });

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      role: updated.role,
      credits: updated.credits,
      creditsUsed: Math.abs(Number(usedAgg._sum.amount ?? 0)),
      provider: updated.provider,
      createdAt: updated.createdAt.toISOString(),
      subscriptionStatus: (updated as any).subscriptions[0]?.status ?? null,
      subscriptionPlan: (updated as any).subscriptions[0]?.plan ?? null,
    };
  }

  /**
   * Atomically credit `amount` to the user, write a typed
   * `credit_transactions` row of type ADMIN_GRANT, and stamp the
   * activity log so the operator action is auditable. Negative or
   * zero amounts are rejected — use the regular Edit User flow if you
   * actually want to set an absolute balance, since that path also
   * writes a `previousData/newData` audit row.
   */
  async grantCredits(
    userId: string,
    amount: number,
    reason: string | undefined,
    adminId: string,
    adminEmail: string,
  ): Promise<{ id: string; email: string; credits: number; granted: number }> {
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(amount)) {
      throw new BadRequestException('amount must be a positive integer');
    }
    if (amount > 100_000) {
      throw new BadRequestException('amount exceeds the per-grant ceiling (100000)');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, credits: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const description = reason && reason.trim().length > 0
      ? `Admin grant: ${reason.trim().slice(0, 200)}`
      : 'Admin grant';

    // Mirrors `UserService.addCredits` — single-statement CTE so the
    // increment and the credit_transactions row land together (or not
    // at all). PgBouncer-compatible because there's no client-side
    // transaction. Casting `$3` to the enum keeps the type-safe shape
    // even though we're going through `$queryRawUnsafe`.
    const result: { affected: bigint }[] = await this.prisma.$queryRawUnsafe(
      `WITH credited AS (
        UPDATE users
        SET credits = credits + $1, "updatedAt" = NOW()
        WHERE id = $2::uuid
        RETURNING id
      )
      INSERT INTO credit_transactions (id, "userId", amount, type, description, "createdAt")
      SELECT gen_random_uuid(), $2::uuid, $1, 'ADMIN_GRANT'::"CreditTransactionType", $3, NOW()
      FROM credited
      RETURNING (SELECT count(*) FROM credited)::int AS affected`,
      amount,
      userId,
      description,
    );
    if (Number(result[0]?.affected ?? 0) === 0) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.activityLog.create({
      data: {
        adminId,
        adminEmail,
        action: 'USER_CREDITS_UPDATE',
        entityType: 'User',
        entityId: userId,
        entityLabel: user.email,
        previousData: { credits: user.credits },
        newData: { credits: user.credits + amount, granted: amount, reason: description },
      },
    });

    this.logger.log(
      `Admin ${adminEmail} granted ${amount} credits to ${user.email} (${userId}): ${description}`,
    );

    return {
      id: user.id,
      email: user.email,
      credits: user.credits + amount,
      granted: amount,
    };
  }

  async deleteUser(
    userId: string,
    adminId: string,
    adminEmail: string,
  ): Promise<{ deleted: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Log before delete so we capture the data
    await this.prisma.activityLog.create({
      data: {
        adminId,
        adminEmail,
        action: 'USER_DELETE',
        entityType: 'User',
        entityId: userId,
        entityLabel: user.email,
        previousData: {
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          credits: user.credits,
          provider: user.provider,
          gender: user.gender,
          preferredLanguage: user.preferredLanguage,
        },
        newData: undefined,
      },
    });

    // Purge data from partitioned tables (FK cascading was removed)
    await this.gdprPurgeService.purgeUserData(userId);

    await this.prisma.user.delete({ where: { id: userId } });
    this.logger.log(`Admin ${adminEmail} deleted user: ${userId} (${user.email})`);
    return { deleted: true };
  }

  async getRecentPayments(limit: number = 20) {
    const payments = await this.readPrisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { name: true, email: true } } },
    });

    return payments.map((p: any) => ({
      id: p.id,
      userName: p.user.name,
      userEmail: p.user.email,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      type: p.type,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  async getRecentChats(limit: number = 20) {
    const sessions = await this.readPrisma.chatSession.findMany({
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        user: { select: { name: true, email: true } },
      },
    });

    return Promise.all(sessions.map(async (s: any) => {
      const messageCount = await this.readPrisma.chatMessage.count({ where: { sessionId: s.id } });
      return {
        id: s.id,
        userName: s.user.name,
        userEmail: s.user.email,
        title: s.title,
        category: s.category,
        messageCount,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
      };
    }));
  }

  // ─── Activity Log ───────────────────────────────────────────────────────────

  async getActivityLogs(
    page: number = 1,
    limit: number = 30,
    action?: string,
  ): Promise<{ logs: ActivityLogItem[]; total: number }> {
    const where = action ? { action: action as any } : {};

    const [logs, total] = await Promise.all([
      this.readPrisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.readPrisma.activityLog.count({ where }),
    ]);

    return {
      logs: logs.map((l: any) => ({
        id: l.id,
        adminId: l.adminId,
        adminEmail: l.adminEmail,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        entityLabel: l.entityLabel,
        previousData: l.previousData,
        newData: l.newData,
        undone: l.undone,
        undoneAt: l.undoneAt?.toISOString() ?? null,
        createdAt: l.createdAt.toISOString(),
      })),
      total,
    };
  }

  async undoActivity(
    logId: string,
    adminId: string,
    adminEmail: string,
  ): Promise<{ success: boolean; message: string }> {
    const log = await this.prisma.activityLog.findFirst({ where: { id: logId } });
    if (!log) throw new NotFoundException('Activity log not found');
    if (log.undone) throw new BadRequestException('This action has already been undone');
    if (log.action === 'USER_DELETE') {
      throw new BadRequestException('User deletion cannot be undone. The user data has been permanently removed.');
    }

    const previousData = log.previousData as Record<string, any> | null;
    if (!previousData || Object.keys(previousData).length === 0) {
      throw new BadRequestException('No previous data available to restore');
    }

    // Check if entity still exists
    if (log.entityType === 'User') {
      const user = await this.prisma.user.findUnique({ where: { id: log.entityId } });
      if (!user) throw new BadRequestException('User no longer exists, cannot undo');

      await this.prisma.user.update({
        where: { id: log.entityId },
        data: previousData,
      });
    } else if (log.entityType === 'Subscription') {
      const sub = await this.prisma.subscription.findUnique({ where: { id: log.entityId } });
      if (!sub) throw new BadRequestException('Subscription no longer exists, cannot undo');

      await this.prisma.subscription.update({
        where: { id: log.entityId },
        data: previousData,
      });
    }

    await this.prisma.activityLog.update({
      where: { id_createdAt: { id: logId, createdAt: log.createdAt } },
      data: { undone: true, undoneAt: new Date() },
    });

    this.logger.log(`Admin ${adminEmail} undid activity ${logId} (${log.action})`);
    return { success: true, message: `Successfully reverted ${log.action} on ${log.entityLabel}` };
  }

  // ─── Site Settings ──────────────────────────────────────────────────────────

  async getSettings(prefix?: string): Promise<Record<string, string>> {
    const where = prefix ? { key: { startsWith: prefix } } : {};
    const rows = await this.prisma.siteSetting.findMany({ where });
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  async updateSettings(
    settings: Record<string, string>,
    adminId: string,
    adminEmail: string,
  ): Promise<Record<string, string>> {
    const existing = await this.getSettings();

    for (const [key, value] of Object.entries(settings)) {
      await this.prisma.siteSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }

    // If any llm.* setting was touched, force the OpenAIService to reload
    // its cached client so the new key/model takes effect immediately.
    if (Object.keys(settings).some((k) => k.startsWith('llm.'))) {
      try {
        await this.openaiService.invalidateCache();
      } catch (err) {
        this.logger.warn(`Failed to invalidate OpenAI cache: ${err}`);
      }
    }

    this.logger.log(`Admin ${adminEmail} updated settings: ${JSON.stringify(Object.keys(settings))}`);
    return this.getSettings();
  }

  async cancelSubscription(
    subscriptionId: string,
    adminId: string,
    adminEmail: string,
  ): Promise<{ cancelled: boolean }> {
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: { select: { email: true } } },
    });
    if (!sub) throw new NotFoundException('Subscription not found');

    await this.prisma.activityLog.create({
      data: {
        adminId,
        adminEmail,
        action: 'SUBSCRIPTION_CANCEL',
        entityType: 'Subscription',
        entityId: subscriptionId,
        entityLabel: sub.user.email,
        previousData: { status: sub.status, plan: sub.plan },
        newData: { status: 'CANCELLED' },
      },
    });

    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'CANCELLED', endDate: new Date() },
    });

    this.logger.log(`Admin ${adminEmail} cancelled subscription ${subscriptionId}`);
    return { cancelled: true };
  }

  // ─── Analytics ────────────────────────────────────────────────────────────

  /**
   * Returns high-level platform analytics for the admin dashboard.
   * All numbers are computed live from the DB — nothing hardcoded.
   */
  async getPlatformAnalytics(): Promise<PlatformAnalytics> {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      sessionsToday,
      sessionsLast7Days,
      totalChatMessages,
      totalSessions,
      creditsToday,
      creditsLast7Days,
      totalUsers,
      premiumUsers,
      kundliCount,
      matchingCount,
      palmistryCount,
      reportCount,
      tarotCount,
      chatsLast7,
      paymentsLast7,
      llmLast7,
    ] = await Promise.all([
      this.readPrisma.chatSession.count({ where: { createdAt: { gte: today } } }),
      this.readPrisma.chatSession.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.readPrisma.chatMessage.count(),
      this.readPrisma.chatSession.count(),
      this.readPrisma.creditTransaction.aggregate({
        where: { createdAt: { gte: today }, amount: { lt: 0 } },
        _sum: { amount: true },
      }),
      this.readPrisma.creditTransaction.aggregate({
        where: { createdAt: { gte: sevenDaysAgo }, amount: { lt: 0 } },
        _sum: { amount: true },
      }),
      this.readPrisma.user.count(),
      this.readPrisma.user.count({ where: { role: { in: ['PREMIUM', 'ADMIN'] } } }),
      this.readPrisma.kundliChart.count(),
      this.readPrisma.matchingResult.count(),
      this.readPrisma.palmistryReading.count(),
      this.readPrisma.report.count(),
      this.readPrisma.tarotReading.count(),
      this.readPrisma.chatSession.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.readPrisma.payment.findMany({
        where: { status: 'SUCCESS', createdAt: { gte: sevenDaysAgo } },
        select: { amount: true, createdAt: true },
      }),
      this.readPrisma.llmUsage.aggregate({
        where: { createdAt: { gte: sevenDaysAgo } },
        _sum: { costUsd: true, totalTokens: true },
        _count: true,
      }),
    ]);

    // Build revenue trend (last 7 days, oldest → newest).
    // Use stats_daily for historical days, live query for today.
    const revenueByDay = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      revenueByDay.set(d.toISOString().slice(0, 10), 0);
    }

    const historicalStats = await this.statsService.getStatsRange(sevenDaysAgo, today);
    for (const stat of historicalStats) {
      const day = stat.date.toISOString().slice(0, 10);
      if (revenueByDay.has(day)) {
        revenueByDay.set(day, Number(stat.dailyRevenue));
      }
    }

    // Today's revenue from live payments (not yet aggregated)
    const todayKey = today.toISOString().slice(0, 10);
    if (revenueByDay.has(todayKey)) {
      let todayRevenue = 0;
      for (const p of paymentsLast7) {
        if (p.createdAt.toISOString().slice(0, 10) === todayKey) {
          todayRevenue += Number(p.amount);
        }
      }
      revenueByDay.set(todayKey, todayRevenue);
    }

    const revenueTrend = Array.from(revenueByDay.entries()).map(([date, revenue]) => ({ date, revenue }));

    // Feature usage breakdown — percentages of total interactions.
    const featureCounts = [
      { feature: 'Chat', count: totalSessions },
      { feature: 'Kundli', count: kundliCount },
      { feature: 'Matching', count: matchingCount },
      { feature: 'Palmistry', count: palmistryCount },
      { feature: 'Reports', count: reportCount },
      { feature: 'Tarot', count: tarotCount },
    ];
    const totalFeatureUsage = featureCounts.reduce((sum, f) => sum + f.count, 0) || 1;
    const featureUsage = featureCounts.map((f) => ({
      feature: f.feature,
      count: f.count,
      percent: Math.round((f.count / totalFeatureUsage) * 1000) / 10,
    }));

    // Retention: % of users who created something in the first N days
    // after signup. Approximated by counting users whose most recent
    // activity timestamp is within the cohort window.
    const [retainedDay1, retainedDay7, retainedDay30] = await Promise.all([
      this.readPrisma.user.count({
        where: {
          createdAt: { lte: now },
          OR: [
            { chatSessions: { some: {} } },
            { kundliCharts: { some: {} } },
          ],
        },
      }),
      this.readPrisma.user.count({
        where: {
          createdAt: { gte: thirtyDaysAgo, lte: sevenDaysAgo },
          chatSessions: { some: { createdAt: { gte: sevenDaysAgo } } },
        },
      }),
      this.readPrisma.user.count({
        where: {
          createdAt: { lte: thirtyDaysAgo },
          chatSessions: { some: { createdAt: { gte: thirtyDaysAgo } } },
        },
      }),
    ]);
    const retention = {
      day1: totalUsers > 0 ? Math.round((retainedDay1 / totalUsers) * 1000) / 10 : 0,
      day7: totalUsers > 0 ? Math.round((retainedDay7 / totalUsers) * 1000) / 10 : 0,
      day30: totalUsers > 0 ? Math.round((retainedDay30 / totalUsers) * 1000) / 10 : 0,
    };

    // Org-level credits-by-feature breakdown for the same 7-day window
    // the rest of the dashboard uses. Same SQL classifier as the
    // per-user breakdown so a new deductCredits caller only needs the
    // CASE row updated in one place.
    const creditsByFeatureRows = await this.readPrisma.$queryRawUnsafe<
      Array<{ feature: string; total_credits: bigint; count: bigint }>
    >(
      AdminService.CREDITS_BY_FEATURE_SQL +
        ` WHERE amount < 0 AND "createdAt" >= $1::timestamptz
          GROUP BY feature
          ORDER BY total_credits DESC`,
      sevenDaysAgo,
    );
    const creditsByFeatureLast7Days = creditsByFeatureRows.map((r) => ({
      feature: r.feature,
      totalCredits: Number(r.total_credits),
      count: Number(r.count),
    }));

    return {
      sessionsToday,
      sessionsLast7Days,
      avgSessionsPerDay: Math.round((sessionsLast7Days / 7) * 10) / 10,
      avgChatLength: totalSessions > 0 ? Math.round((totalChatMessages / totalSessions) * 10) / 10 : 0,
      creditsConsumedToday: Math.abs(Number(creditsToday._sum.amount ?? 0)),
      creditsConsumedLast7Days: Math.abs(Number(creditsLast7Days._sum.amount ?? 0)),
      creditsByFeatureLast7Days,
      revenueTrend,
      featureUsage,
      conversionRate: totalUsers > 0 ? Math.round((premiumUsers / totalUsers) * 1000) / 10 : 0,
      retention,
      llmTotals: {
        callsLast7Days: llmLast7._count,
        totalCostUsdLast7Days: Number(llmLast7._sum.costUsd ?? 0),
        totalTokensLast7Days: Number(llmLast7._sum.totalTokens ?? 0),
      },
    };
  }

  /**
   * Returns real counts for the admin Content tab. Each section's item
   * count is derived from the actual data in the database.
   */
  async getContentStats(): Promise<{
    knowledgeDocuments: number;
    knowledgeCategories: Array<{ category: string; count: number }>;
    tarotReadings: number;
    kundliCharts: number;
    reports: number;
    palmistryReadings: number;
    matchingResults: number;
    chatSessions: number;
    notifications: number;
  }> {
    const [
      knowledgeDocuments,
      tarotReadings,
      kundliCharts,
      reports,
      palmistryReadings,
      matchingResults,
      chatSessions,
      notifications,
      kbByCategory,
    ] = await Promise.all([
      this.readPrisma.knowledgeDocument.count(),
      this.readPrisma.tarotReading.count(),
      this.readPrisma.kundliChart.count(),
      this.readPrisma.report.count(),
      this.readPrisma.palmistryReading.count(),
      this.readPrisma.matchingResult.count(),
      this.readPrisma.chatSession.count(),
      this.readPrisma.notification.count(),
      this.readPrisma.knowledgeDocument.groupBy({
        by: ['category'],
        _count: true,
      }),
    ]);

    return {
      knowledgeDocuments,
      knowledgeCategories: kbByCategory.map((row: any) => ({
        category: row.category,
        count: row._count,
      })),
      tarotReadings,
      kundliCharts,
      reports,
      palmistryReadings,
      matchingResults,
      chatSessions,
      notifications,
    };
  }

  /**
   * Returns the top users ranked by LLM spend (USD) over a given period.
   * Delegates to the pluggable AnalyticsService (Postgres or ClickHouse).
   */
  async getLlmCostsByUser(limit: number = 20, days: number = 30): Promise<LlmCostRow[]> {
    return this.analyticsService.getLlmCostsByUser(limit, days);
  }

  // ────────────────────────────────────────────────────────────────────
  // Cost Tab (Phase 1)
  // ────────────────────────────────────────────────────────────────────

  /**
   * Headline numbers for the Cost tab: MTD spend, previous-month
   * same-window spend, naive end-of-month projection, and the
   * currently-configured daily/monthly USD alert thresholds.
   * Thresholds come from `site_settings` under the `notification.cost.*`
   * prefix (writable via the existing admin settings whitelist).
   */
  async getCostSummary(): Promise<CostProjection & { dailyThreshold: number | null; monthlyThreshold: number | null }> {
    const [projection, thresholds] = await Promise.all([
      this.analyticsService.getCostProjection(),
      this.readPrisma.siteSetting.findMany({
        where: { key: { in: ['notification.cost.daily_usd', 'notification.cost.monthly_usd'] } },
        select: { key: true, value: true },
      }),
    ]);
    const byKey = new Map<string, string>(thresholds.map((r: any) => [r.key, r.value]));
    const toNum = (v: string | undefined) => (v && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : null);
    return {
      ...projection,
      dailyThreshold: toNum(byKey.get('notification.cost.daily_usd')),
      monthlyThreshold: toNum(byKey.get('notification.cost.monthly_usd')),
    };
  }

  async getCostByFeature(days: number = 30): Promise<LlmUsageByFeature[]> {
    return this.analyticsService.getLlmUsageByFeature(days);
  }

  async getCostByProvider(days: number = 30): Promise<LlmUsageByProvider[]> {
    return this.analyticsService.getLlmUsageByProvider(days);
  }

  async getDailyCost(days: number = 30): Promise<DailyCostPoint[]> {
    return this.analyticsService.getDailyCostSeries(days);
  }

  async getTodayLlmUsage(): Promise<TodayUsageByFeature> {
    return this.analyticsService.getTodayUsageByFeature();
  }

  // ────────────────────────────────────────────────────────────────────
  // Stuck onboarding (Phase 1)
  // ────────────────────────────────────────────────────────────────────

  /**
   * Users who signed up in the last 7 days but never finished
   * onboarding — either birth details still missing or zero chat
   * sessions. Surfaces the leakiest step of the funnel for quick ops
   * follow-up without requiring full funnel analytics (Phase 2).
   */
  async getStuckOnboarding(): Promise<
    Array<{ userId: string; email: string; name: string; createdAt: Date; missing: string[] }>
  > {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    // Pull the candidate set + flag which onboarding bits are absent.
    // Field predicates intentionally mirror the web `ProfileGate` logic
    // so "stuck" here means the same thing a user sees on the site.
    const users = await this.readPrisma.user.findMany({
      where: { createdAt: { gte: since } },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        dateOfBirth: true,
        timeOfBirth: true,
        placeOfBirth: true,
        gender: true,
        _count: { select: { chatSessions: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const out: Array<{ userId: string; email: string; name: string; createdAt: Date; missing: string[] }> = [];
    for (const u of users as any[]) {
      const missing: string[] = [];
      if (!u.dateOfBirth) missing.push('dateOfBirth');
      if (!u.timeOfBirth) missing.push('timeOfBirth');
      if (!u.placeOfBirth) missing.push('placeOfBirth');
      if (!u.gender) missing.push('gender');
      if ((u._count?.chatSessions ?? 0) === 0) missing.push('chatStarted');
      if (missing.length === 0) continue;
      out.push({ userId: u.id, email: u.email, name: u.name, createdAt: u.createdAt, missing });
    }
    return out;
  }

  // ────────────────────────────────────────────────────────────────────
  // Impersonation (Phase 1)
  // ────────────────────────────────────────────────────────────────────

  /**
   * Mint a short-lived (1h) impersonation JWT for a target user and
   * write an activity-log row capturing who impersonated whom.
   *
   * Anti-footguns:
   *   - Admins can't impersonate other admins (privilege escalation
   *     boundary).
   *   - No refresh token is issued — the session dies at expiry.
   *   - The log row is non-undoable; once issued, it's part of the
   *     permanent audit trail.
   */
  async impersonateUser(
    targetUserId: string,
    adminId: string,
    adminEmail: string,
  ): Promise<{ accessToken: string; expiresAt: string }> {
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === 'ADMIN') {
      // Refuse ADMIN → ADMIN impersonation to prevent silent
      // cross-admin action masking.
      throw new BadRequestException('Admin accounts cannot be impersonated.');
    }

    const token = await this.authService.issueImpersonationToken(
      target.id,
      target.email,
      target.name,
      adminEmail,
    );

    await this.prisma.activityLog.create({
      data: {
        adminId,
        adminEmail,
        action: 'USER_IMPERSONATE',
        entityType: 'User',
        entityId: target.id,
        entityLabel: target.email,
        previousData: Prisma.JsonNull,
        newData: { expiresAt: token.expiresAt } as any,
      },
    });

    this.logger.log(`Admin ${adminEmail} impersonated user ${target.email}`);
    return token;
  }

  // ──────────────────────────────────────────────────────────────────
  // Phase 3: provider kill-switch, key rotation, broadcast, force-logout
  // ──────────────────────────────────────────────────────────────────

  /**
   * Write `llm.provider.{name}.enabled` to site_settings and invalidate
   * the LlmService config cache so the flip is effective within seconds,
   * not the full 30s TTL. Writes an undoable `LLM_PROVIDER_TOGGLE` row
   * to activity_log — the existing undo path at `undoActivity()`
   * handles generic settings-style log rows.
   */
  async setLlmProviderEnabled(
    provider: string,
    enabled: boolean,
    adminId: string,
    adminEmail: string,
  ): Promise<{ enabled: boolean; provider: string }> {
    const key = `llm.provider.${provider}.enabled`;
    const previous = await this.prisma.siteSetting.findUnique({ where: { key } });
    const next = enabled ? 'true' : 'false';
    await this.prisma.siteSetting.upsert({
      where: { key },
      update: { value: next },
      create: { key, value: next },
    });
    await this.llmService.invalidateCache().catch(() => {});

    await this.prisma.activityLog.create({
      data: {
        adminId,
        adminEmail,
        action: 'LLM_PROVIDER_TOGGLE',
        entityType: 'LlmProvider',
        entityId: provider,
        entityLabel: provider,
        previousData: previous ? { enabled: previous.value } : Prisma.JsonNull,
        newData: { enabled: next } as any,
      },
    });
    this.logger.log(`Admin ${adminEmail} set provider ${provider} enabled=${enabled}`);
    return { enabled, provider };
  }

  /**
   * Rotate the stored API key for a provider. The new key is persisted
   * under `llm.{provider}.key` — the same key shape LlmService reads
   * for `openai` — and the LlmService reload cache is invalidated so
   * the next call picks the new key up immediately.
   *
   * Non-undoable: `previousData` is NOT populated with the old key
   * (that would paste a secret into activity_log). Only a redacted
   * fingerprint lands in the log.
   */
  async rotateLlmKey(
    provider: string,
    newKey: string,
    adminId: string,
    adminEmail: string,
  ): Promise<{ provider: string; rotatedAt: string }> {
    const key = `llm.${provider}.key`;
    await this.prisma.siteSetting.upsert({
      where: { key },
      update: { value: newKey },
      create: { key, value: newKey },
    });
    await this.llmService.invalidateCache().catch(() => {});

    const rotatedAt = new Date().toISOString();
    const fingerprint = `${newKey.slice(0, 4)}…${newKey.slice(-4)}`;
    await this.prisma.activityLog.create({
      data: {
        adminId,
        adminEmail,
        action: 'LLM_KEY_ROTATE',
        entityType: 'LlmKey',
        entityId: provider,
        entityLabel: provider,
        previousData: Prisma.JsonNull,
        // newData is deliberately a fingerprint — never the full key.
        newData: { fingerprint, rotatedAt } as any,
      },
    });
    this.logger.log(`Admin ${adminEmail} rotated ${provider} key (${fingerprint})`);
    return { provider, rotatedAt };
  }

  /**
   * Enqueue an admin broadcast. Delegates to `BroadcastService.enqueue()`
   * which does the validation + audience sizing; we keep the activity
   * log write here because that's where every admin mutation is
   * logged from.
   */
  async createBroadcast(
    req: BroadcastRequest,
    adminId: string,
    adminEmail: string,
  ): Promise<{ jobId: string; audienceSize: number }> {
    const result = await this.broadcastSvc.enqueue(req, adminEmail);
    await this.prisma.activityLog.create({
      data: {
        adminId,
        adminEmail,
        action: 'BROADCAST_SENT',
        entityType: 'Broadcast',
        entityId: result.jobId,
        entityLabel: req.audience.type,
        previousData: Prisma.JsonNull,
        newData: {
          audience: req.audience,
          subject: req.subject,
          channel: req.channel,
          audienceSize: result.audienceSize,
        } as any,
      },
    });
    return result;
  }

  /**
   * Force-logout wraps `AuthService.revokeAllUserTokens()` and logs
   * the action. The target user is looked up first to capture the
   * email for a readable audit row.
   */
  async forceLogoutUser(
    userId: string,
    adminId: string,
    adminEmail: string,
  ): Promise<{ familiesRevoked: number }> {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!target) throw new NotFoundException('User not found');

    const result = await this.authService.revokeAllUserTokens(userId);
    await this.prisma.activityLog.create({
      data: {
        adminId,
        adminEmail,
        action: 'USER_FORCE_LOGOUT',
        entityType: 'User',
        entityId: target.id,
        entityLabel: target.email,
        previousData: Prisma.JsonNull,
        newData: { familiesRevoked: result.familiesRevoked } as any,
      },
    });
    this.logger.log(`Admin ${adminEmail} force-logged-out ${target.email} (${result.familiesRevoked} families)`);
    return result;
  }

  // ──────────────────────────────────────────────────────────────────
  // Phase 4: safety + GDPR + churn-retry
  // ──────────────────────────────────────────────────────────────────

  /**
   * Resolve a flagged message and write the corresponding activity
   * log row. The `action` string lands in `newData` so the audit trail
   * records *what* the admin did ("hide" vs "approve") — not just
   * "a resolution happened".
   */
  async resolveFlaggedMessage(
    flaggedId: string,
    action: ResolveAction,
    adminId: string,
    adminEmail: string,
  ): Promise<FlaggedMessageRow> {
    const resolved = await this.safetyService.resolve(flaggedId, action, adminId);
    await this.prisma.activityLog.create({
      data: {
        adminId,
        adminEmail,
        action: 'FLAGGED_MESSAGE_RESOLVE',
        entityType: 'FlaggedMessage',
        entityId: flaggedId,
        entityLabel: resolved.userEmail ?? resolved.userId,
        previousData: { status: 'pending' } as any,
        newData: { status: resolved.status, action } as any,
      },
    });
    this.logger.log(`Admin ${adminEmail} resolved flagged ${flaggedId}: ${action}`);
    return resolved;
  }

  /**
   * Admin-initiated GDPR request. The request itself is created in
   * GdprRequestService (which enforces one-pending-per-(user,type));
   * we additionally write an activity-log row so the audit trail
   * attributes the creation to the admin that acted.
   */
  async createGdprRequest(
    userId: string,
    type: GdprType,
    note: string | undefined,
    adminId: string,
    adminEmail: string,
  ): Promise<GdprRequestRow> {
    const row = await this.gdprRequestService.create({ userId, type, note });
    await this.prisma.activityLog.create({
      data: {
        adminId,
        adminEmail,
        action: 'GDPR_REQUEST_CREATE',
        entityType: 'GdprRequest',
        entityId: row.id,
        entityLabel: row.userEmail ?? row.userId,
        previousData: Prisma.JsonNull,
        newData: { type, dueBy: row.dueBy } as any,
      },
    });
    return row;
  }

  /**
   * Fulfill a GDPR request. Delegates to GdprRequestService which
   * either produces an export payload or triggers the purge service
   * depending on the request type. We unwrap the export payload so
   * the admin controller can stream it to the browser on the same
   * response.
   */
  async fulfillGdprRequest(
    requestId: string,
    adminId: string,
    adminEmail: string,
    note?: string,
  ): Promise<{ row: GdprRequestRow; exportPayload?: UserDataExport }> {
    const result = await this.gdprRequestService.fulfill(requestId, adminId, note);
    await this.prisma.activityLog.create({
      data: {
        adminId,
        adminEmail,
        action: 'GDPR_REQUEST_FULFILL',
        entityType: 'GdprRequest',
        entityId: requestId,
        entityLabel: result.row.userEmail ?? result.row.userId,
        previousData: { status: 'pending' } as any,
        newData: { status: 'fulfilled', type: result.row.type } as any,
      },
    });
    this.logger.log(`Admin ${adminEmail} fulfilled GDPR ${result.row.type} for ${result.row.userEmail ?? result.row.userId}`);
    return result;
  }

  async rejectGdprRequest(
    requestId: string,
    adminId: string,
    adminEmail: string,
    note: string,
  ): Promise<GdprRequestRow> {
    const row = await this.gdprRequestService.reject(requestId, adminId, note);
    await this.prisma.activityLog.create({
      data: {
        adminId,
        adminEmail,
        action: 'GDPR_REQUEST_REJECT',
        entityType: 'GdprRequest',
        entityId: requestId,
        entityLabel: row.userEmail ?? row.userId,
        previousData: { status: 'pending' } as any,
        newData: { status: 'rejected', note } as any,
      },
    });
    return row;
  }

  /**
   * Phase 4 churn retry-email action: fire a single in-app
   * notification at a user flagged as churn-risk with reason
   * `payment_fail`. Currently in-app only — email transport lands
   * here when the notifications module grows one.
   */
  async sendRetryEmail(
    userId: string,
    adminId: string,
    adminEmail: string,
  ): Promise<{ sent: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const sent = await this.notificationService.sendPushNotification({
      userId,
      title: 'Payment method needs a refresh',
      body: 'We noticed a recent payment didn\'t go through. Update your card or try again to keep your premium features active.',
      type: 'system',
    });

    await this.prisma.activityLog.create({
      data: {
        adminId,
        adminEmail,
        action: 'CHURN_RETRY_EMAIL',
        entityType: 'User',
        entityId: userId,
        entityLabel: user.email,
        previousData: Prisma.JsonNull,
        newData: { sent, channel: 'inapp' } as any,
      },
    });
    return { sent };
  }
}
