import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AdminService } from '../src/modules/admin/admin.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: {
        count: jest.fn().mockResolvedValue(100),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      payment: {
        count: jest.fn().mockResolvedValue(50),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 50000 } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      chatSession: {
        count: jest.fn().mockResolvedValue(200),
        findMany: jest.fn().mockResolvedValue([]),
      },
      chatMessage: {
        count: jest.fn().mockResolvedValue(500),
      },
      kundliChart: {
        count: jest.fn().mockResolvedValue(75),
      },
      subscription: {
        count: jest.fn().mockResolvedValue(25),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      activityLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      siteSetting: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  describe('getDashboardStats', () => {
    it('should return aggregated stats', async () => {
      const stats = await service.getDashboardStats();

      expect(stats.totalUsers).toBe(100);
      expect(stats.totalRevenue).toBe(50000);
      expect(stats.totalChats).toBe(200);
      expect(stats.totalKundlis).toBe(75);
      expect(stats.totalPayments).toBe(50);
      expect(stats.activeSubscriptions).toBe(25);
    });
  });

  describe('getUsers', () => {
    it('should return paginated users', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: '1', name: 'User 1', email: 'u1@test.com', phone: null, role: 'USER', credits: 10, provider: 'LOCAL', createdAt: new Date(), subscriptions: [] },
      ]);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.getUsers(1, 20);

      expect(result.users.length).toBe(1);
      expect(result.total).toBe(1);
    });

    it('should search users by name or email', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      const result = await service.getUsers(1, 20, 'test');

      expect(result.users.length).toBe(0);
      expect(prisma.user.findMany).toHaveBeenCalled();
    });
  });

  describe('updateUser', () => {
    it('should update user role', async () => {
      const existingUser = { id: '1', name: 'User', email: 'u@test.com', phone: null, role: 'USER', credits: 10, provider: 'LOCAL', createdAt: new Date(), subscriptions: [] };
      const updatedUser = { ...existingUser, role: 'PREMIUM' };
      prisma.user.findUnique.mockResolvedValue(existingUser);
      prisma.user.update.mockResolvedValue(updatedUser);

      const result = await service.updateUser('1', { role: 'PREMIUM' }, 'admin-id', 'admin@test.com');

      expect(result.role).toBe('PREMIUM');
    });

    it('should throw BadRequestException when no changes provided', async () => {
      const existingUser = { id: '1', name: 'User', email: 'u@test.com', role: 'USER', credits: 10 };
      prisma.user.findUnique.mockResolvedValue(existingUser);

      await expect(
        service.updateUser('1', {}, 'admin-id', 'admin@test.com'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteUser', () => {
    it('should delete user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: '1', name: 'User', email: 'u@test.com', role: 'USER' });
      prisma.user.delete.mockResolvedValue({});

      const result = await service.deleteUser('1', 'admin-id', 'admin@test.com');

      expect(result.deleted).toBe(true);
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteUser('non-existent', 'admin-id', 'admin@test.com'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSettings', () => {
    it('should return site settings', async () => {
      prisma.siteSetting.findMany.mockResolvedValue([
        { key: 'pricing.monthly.price', value: '499', updatedAt: new Date() },
        { key: 'pricing.annual.price', value: '4999', updatedAt: new Date() },
      ]);

      const result = await service.getSettings('pricing');

      expect(prisma.siteSetting.findMany).toHaveBeenCalled();
    });
  });

  describe('getActivityLogs', () => {
    it('should return paginated activity logs', async () => {
      prisma.activityLog.findMany.mockResolvedValue([]);
      prisma.activityLog.count.mockResolvedValue(0);

      const result = await service.getActivityLogs(1, 20);

      expect(result.logs).toEqual([]);
    });
  });
});
