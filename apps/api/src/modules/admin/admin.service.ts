import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
}

export interface AdminUserUpdate {
  role?: 'USER' | 'PREMIUM' | 'ADMIN';
  credits?: number;
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
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: users.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
      })),
      total,
    };
  }

  async updateUser(userId: string, dto: AdminUserUpdate): Promise<UserListItem> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.role && { role: dto.role }),
        ...(dto.credits !== undefined && { credits: dto.credits }),
      },
    });

    this.logger.log(`Admin updated user ${userId}: ${JSON.stringify(dto)}`);

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      role: updated.role,
      credits: updated.credits,
      provider: updated.provider,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async deleteUser(userId: string): Promise<{ deleted: boolean }> {
    await this.prisma.user.delete({ where: { id: userId } });
    this.logger.log(`Admin deleted user: ${userId}`);
    return { deleted: true };
  }

  async getRecentPayments(limit: number = 20) {
    const payments = await this.prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { name: true, email: true } } },
    });

    return payments.map((p) => ({
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

    return sessions.map((s) => ({
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
}
