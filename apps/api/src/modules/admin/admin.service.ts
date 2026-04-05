import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

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

  constructor(private prisma: PrismaService) {}

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
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: { in: ['PREMIUM', 'ADMIN'] } } }),
      this.prisma.payment.aggregate({
        where: { status: 'SUCCESS' },
        _sum: { amount: true },
      }),
      this.prisma.chatSession.count(),
      this.prisma.kundliChart.count(),
      this.prisma.payment.count({ where: { status: 'SUCCESS' } }),
      this.prisma.user.count({ where: { createdAt: { gte: today } } }),
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
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
      this.prisma.user.findMany({
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
      this.prisma.user.count({ where }),
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
    const user = await this.prisma.user.findUnique({
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
          include: { _count: { select: { messages: true } } },
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

    const [totalPaymentsAgg, totalCreditsUsed, kundliCount, palmistryCount, matchingCount] = await Promise.all([
      this.prisma.payment.aggregate({
        where: { userId, status: 'SUCCESS' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.creditTransaction.aggregate({
        where: { userId, amount: { lt: 0 } },
        _sum: { amount: true },
      }),
      this.prisma.kundliChart.count({ where: { userId } }),
      this.prisma.palmistryReading.count({ where: { userId } }),
      this.prisma.matchingResult.count({ where: { userId } }),
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
      recentChats: user.chatSessions.map((c: any) => ({
        id: c.id,
        title: c.title,
        category: c.category,
        messageCount: c._count.messages,
        updatedAt: c.updatedAt.toISOString(),
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

    await this.prisma.user.delete({ where: { id: userId } });
    this.logger.log(`Admin ${adminEmail} deleted user: ${userId} (${user.email})`);
    return { deleted: true };
  }

  async getRecentPayments(limit: number = 20) {
    const payments = await this.prisma.payment.findMany({
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
    const sessions = await this.prisma.chatSession.findMany({
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        user: { select: { name: true, email: true } },
        _count: { select: { messages: true } },
      },
    });

    return sessions.map((s: any) => ({
      id: s.id,
      userName: s.user.name,
      userEmail: s.user.email,
      title: s.title,
      category: s.category,
      messageCount: s._count.messages,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
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
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.activityLog.count({ where }),
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
}
