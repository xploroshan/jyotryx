import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';

import { Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaReadReplicaService } from '../../prisma/prisma-read-replica.service';
import { OpenAIService } from '../../openai/openai.service';
import { StatsService } from '../../stats/stats.service';
import { ANALYTICS_SERVICE, AnalyticsService } from '../../analytics/analytics.interface';
import { GdprPurgeService } from './gdpr-purge.service';

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
  credits: number;
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

    return {
      users: users.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        credits: u.credits,
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
      llmTotals,
      llmByProvider,
      llmByFeature,
      llmRecent,
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
      llmUsage: {
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
      },
    };
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

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      role: updated.role,
      credits: updated.credits,
      provider: updated.provider,
      createdAt: updated.createdAt.toISOString(),
      subscriptionStatus: (updated as any).subscriptions[0]?.status ?? null,
      subscriptionPlan: (updated as any).subscriptions[0]?.plan ?? null,
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
    const log = await this.prisma.activityLog.findUnique({ where: { id: logId } });
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
      where: { id: logId },
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

    return {
      sessionsToday,
      sessionsLast7Days,
      avgSessionsPerDay: Math.round((sessionsLast7Days / 7) * 10) / 10,
      avgChatLength: totalSessions > 0 ? Math.round((totalChatMessages / totalSessions) * 10) / 10 : 0,
      creditsConsumedToday: Math.abs(Number(creditsToday._sum.amount ?? 0)),
      creditsConsumedLast7Days: Math.abs(Number(creditsLast7Days._sum.amount ?? 0)),
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
}
