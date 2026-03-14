import { Test, TestingModule } from '@nestjs/testing';
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
      kundliChart: {
        count: jest.fn().mockResolvedValue(75),
      },
      subscription: {
        count: jest.fn().mockResolvedValue(25),
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
        { id: '1', name: 'User 1', email: 'u1@test.com', phone: null, role: 'USER', credits: 10, provider: 'LOCAL', createdAt: new Date() },
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
      const mockUser = { id: '1', name: 'User', email: 'u@test.com', phone: null, role: 'PREMIUM', credits: 10, provider: 'LOCAL', createdAt: new Date() };
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);

      const result = await service.updateUser('1', { role: 'PREMIUM' });

      expect(result.role).toBe('PREMIUM');
    });
  });

  describe('deleteUser', () => {
    it('should delete user', async () => {
      prisma.user.delete.mockResolvedValue({});

      const result = await service.deleteUser('1');

      expect(result.deleted).toBe(true);
    });
  });
});
