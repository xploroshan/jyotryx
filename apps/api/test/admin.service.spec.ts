import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AdminService } from '../src/modules/admin/admin.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaReadReplicaService } from '../src/prisma/prisma-read-replica.service';
import { OpenAIService } from '../src/openai/openai.service';
import { StatsService } from '../src/stats/stats.service';
import { GdprPurgeService } from '../src/modules/admin/gdpr-purge.service';
import { ANALYTICS_SERVICE } from '../src/analytics/analytics.interface';
import { AuthService } from '../src/modules/auth/auth.service';
import { LlmService } from '../src/llm/llm.service';
import { BroadcastService } from '../src/ops/broadcast.service';
import { SafetyService } from '../src/safety/safety.service';
import { GdprRequestService } from '../src/gdpr/gdpr-request.service';
import { NotificationService } from '../src/modules/notification/notification.service';
import { mockOpenAIService } from './helpers/mocks';

describe('AdminService', () => {
  let service: AdminService;
  let prisma: any;
  let mockAnalyticsService: any;

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
      creditTransaction: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        // `getUsers` group-by-userId aggregation (added with the
        // Users-tab Usage column). Empty result → every row's
        // creditsUsed defaults to 0 in the mapping.
        groupBy: jest.fn().mockResolvedValue([]),
      },
      matchingResult: {
        count: jest.fn().mockResolvedValue(0),
      },
      palmistryReading: {
        count: jest.fn().mockResolvedValue(0),
      },
      report: {
        count: jest.fn().mockResolvedValue(0),
      },
      tarotReading: {
        count: jest.fn().mockResolvedValue(0),
      },
      notification: {
        count: jest.fn().mockResolvedValue(0),
      },
      knowledgeDocument: {
        count: jest.fn().mockResolvedValue(0),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      llmUsage: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { costUsd: 0, totalTokens: 0 }, _count: 0 }),
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([]),
      },
      // Top-level Prisma raw-query escape hatch. Used by
      // `aggregateCreditsByFeature` (per-user) and the analytics
      // `creditsByFeatureLast7Days` rollup. Returning [] is the
      // empty-history happy path; tests that assert on these rollups
      // override this on the per-test mock.
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    };

    const mockStatsService = {
      getStatsRange: jest.fn().mockResolvedValue([]),
      getLatestStats: jest.fn().mockResolvedValue(null),
      computeAndStoreDailyStats: jest.fn(),
    };

    mockAnalyticsService = {
      getLlmCostsByUser: jest.fn().mockResolvedValue([]),
      getLlmTotals: jest.fn().mockResolvedValue({ calls: 0, totalTokens: 0, totalCostUsd: 0 }),
      getLlmUsageByFeature: jest.fn().mockResolvedValue([]),
      getLlmUsageByProvider: jest.fn().mockResolvedValue([]),
    };

    const mockGdprPurgeService = {
      purgeUserData: jest.fn().mockResolvedValue(undefined),
    };

    // AdminService's constructor picked up AuthService (Phase 1
    // impersonation), LlmService + BroadcastService (Phase 3 kill-switch
    // + broadcast). Stub them here so the DI module compiles.
    const mockAuthService = {
      issueImpersonationToken: jest.fn().mockResolvedValue({
        accessToken: 'imp-token',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      }),
      revokeAllUserTokens: jest.fn().mockResolvedValue({ familiesRevoked: 0 }),
    };
    const mockLlmService = {
      invalidateCache: jest.fn().mockResolvedValue(undefined),
      isProviderEnabled: jest.fn().mockReturnValue(true),
      computeCost: jest.fn().mockReturnValue(0),
    };
    const mockBroadcastService = {
      enqueue: jest.fn().mockResolvedValue({ jobId: 'job-1', audienceSize: 0 }),
      audienceCount: jest.fn().mockResolvedValue(0),
    };
    // Phase 4 additions — safety/gdpr/notification wrappers. Each
    // stub returns the minimum shape the delegating AdminService
    // methods expect on the happy path.
    const mockSafetyService = {
      resolve: jest.fn().mockResolvedValue({
        id: 'f-1', status: 'hidden', userEmail: 'a@b.com', userId: 'u-1',
      }),
      list: jest.fn().mockResolvedValue([]),
    };
    const mockGdprRequestService = {
      create: jest.fn().mockResolvedValue({ id: 'g-1', userEmail: 'a@b.com', userId: 'u-1', type: 'export', status: 'pending', dueBy: new Date().toISOString() }),
      fulfill: jest.fn().mockResolvedValue({ row: { id: 'g-1', userEmail: 'a@b.com', userId: 'u-1', type: 'export', status: 'fulfilled' } }),
      reject: jest.fn().mockResolvedValue({ id: 'g-1', userEmail: 'a@b.com', userId: 'u-1', type: 'export', status: 'rejected' }),
      list: jest.fn().mockResolvedValue([]),
    };
    const mockNotificationService = {
      sendPushNotification: jest.fn().mockResolvedValue(true),
      sendBulkNotification: jest.fn().mockResolvedValue({ sent: 0, failed: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: PrismaReadReplicaService, useValue: prisma },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: StatsService, useValue: mockStatsService },
        { provide: ANALYTICS_SERVICE, useValue: mockAnalyticsService },
        { provide: GdprPurgeService, useValue: mockGdprPurgeService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: LlmService, useValue: mockLlmService },
        { provide: BroadcastService, useValue: mockBroadcastService },
        { provide: SafetyService, useValue: mockSafetyService },
        { provide: GdprRequestService, useValue: mockGdprRequestService },
        { provide: NotificationService, useValue: mockNotificationService },
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

  describe('getPlatformAnalytics', () => {
    it('should aggregate sessions, revenue trend, feature usage, and LLM totals', async () => {
      prisma.chatSession.count.mockImplementation(({ where }: any = {}) => {
        // sessionsToday & sessionsLast7Days & totalSessions & chatsLast7
        if (where?.createdAt?.gte) return Promise.resolve(5);
        return Promise.resolve(200);
      });
      prisma.chatMessage.count.mockResolvedValue(940);
      prisma.creditTransaction.aggregate.mockResolvedValue({ _sum: { amount: -15 } });
      prisma.user.count.mockImplementation(({ where }: any = {}) => {
        if (where?.role) return Promise.resolve(10); // premium
        if (where?.OR || where?.chatSessions) return Promise.resolve(30); // retention
        return Promise.resolve(100); // total
      });
      prisma.kundliChart.count.mockResolvedValue(40);
      prisma.matchingResult.count.mockResolvedValue(20);
      prisma.palmistryReading.count.mockResolvedValue(10);
      prisma.report.count.mockResolvedValue(5);
      prisma.tarotReading.count.mockResolvedValue(8);
      prisma.payment.findMany.mockResolvedValue([
        { amount: 500, createdAt: new Date() },
        { amount: 300, createdAt: new Date() },
      ]);
      prisma.llmUsage.aggregate.mockResolvedValue({
        _sum: { costUsd: 12.345678, totalTokens: 98765 },
        _count: 42,
      });

      const result = await service.getPlatformAnalytics();

      expect(result.sessionsLast7Days).toBe(5);
      expect(result.avgChatLength).toBe(4.7); // 940/200
      expect(result.revenueTrend.length).toBe(7);
      expect(result.featureUsage.find((f) => f.feature === 'Chat')).toBeDefined();
      expect(result.featureUsage.find((f) => f.feature === 'Kundli')?.count).toBe(40);
      expect(result.conversionRate).toBe(10); // 10/100
      expect(result.llmTotals.callsLast7Days).toBe(42);
      expect(result.llmTotals.totalCostUsdLast7Days).toBeCloseTo(12.345678);
      expect(result.llmTotals.totalTokensLast7Days).toBe(98765);
    });

    it('should handle zero users without divide-by-zero', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.chatSession.count.mockResolvedValue(0);
      prisma.chatMessage.count.mockResolvedValue(0);
      prisma.kundliChart.count.mockResolvedValue(0);
      prisma.matchingResult.count.mockResolvedValue(0);
      prisma.palmistryReading.count.mockResolvedValue(0);
      prisma.report.count.mockResolvedValue(0);
      prisma.tarotReading.count.mockResolvedValue(0);
      prisma.payment.findMany.mockResolvedValue([]);

      const result = await service.getPlatformAnalytics();

      expect(result.conversionRate).toBe(0);
      expect(result.avgChatLength).toBe(0);
      expect(result.retention.day1).toBe(0);
      expect(result.retention.day7).toBe(0);
      expect(result.retention.day30).toBe(0);
    });
  });

  describe('getLlmCostsByUser', () => {
    it('should delegate to analyticsService and return results', async () => {
      mockAnalyticsService.getLlmCostsByUser.mockResolvedValue([
        {
          userId: 'u1',
          userName: 'Alice',
          userEmail: 'alice@test.com',
          calls: 15,
          totalTokens: 12000,
          totalCostUsd: 5.25,
        },
        {
          userId: 'u2',
          userName: 'Bob',
          userEmail: 'bob@test.com',
          calls: 4,
          totalTokens: 4000,
          totalCostUsd: 1.1,
        },
      ]);

      const result = await service.getLlmCostsByUser(20, 30);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        userId: 'u1',
        userName: 'Alice',
        userEmail: 'alice@test.com',
        calls: 15,
        totalTokens: 12000,
        totalCostUsd: 5.25,
      });
      expect(result[1].userName).toBe('Bob');
      expect(mockAnalyticsService.getLlmCostsByUser).toHaveBeenCalledWith(20, 30);
    });

    it('should handle null userId rows (deleted users)', async () => {
      mockAnalyticsService.getLlmCostsByUser.mockResolvedValue([
        {
          userId: null,
          userName: null,
          userEmail: null,
          calls: 3,
          totalTokens: 5000,
          totalCostUsd: 2.0,
        },
      ]);

      const result = await service.getLlmCostsByUser();

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBeNull();
      expect(result[0].userName).toBeNull();
      expect(result[0].userEmail).toBeNull();
      expect(result[0].totalCostUsd).toBe(2.0);
    });

    it('should return empty array when no usage', async () => {
      const result = await service.getLlmCostsByUser();
      expect(result).toEqual([]);
    });
  });

  describe('getContentStats', () => {
    it('should return counts for all content sections', async () => {
      prisma.knowledgeDocument.count.mockResolvedValue(120);
      prisma.knowledgeDocument.groupBy.mockResolvedValue([
        { category: 'astrology', _count: 60 },
        { category: 'numerology', _count: 40 },
        { category: 'palmistry', _count: 20 },
      ]);
      prisma.tarotReading.count.mockResolvedValue(45);
      prisma.kundliChart.count.mockResolvedValue(230);
      prisma.report.count.mockResolvedValue(18);
      prisma.palmistryReading.count.mockResolvedValue(52);
      prisma.matchingResult.count.mockResolvedValue(33);
      prisma.chatSession.count.mockResolvedValue(600);
      prisma.notification.count.mockResolvedValue(75);

      const result = await service.getContentStats();

      expect(result.knowledgeDocuments).toBe(120);
      expect(result.knowledgeCategories).toHaveLength(3);
      expect(result.knowledgeCategories[0]).toEqual({ category: 'astrology', count: 60 });
      expect(result.tarotReadings).toBe(45);
      expect(result.kundliCharts).toBe(230);
      expect(result.reports).toBe(18);
      expect(result.palmistryReadings).toBe(52);
      expect(result.matchingResults).toBe(33);
      expect(result.chatSessions).toBe(600);
      expect(result.notifications).toBe(75);
    });

    it('should return zero counts when DB is empty', async () => {
      const result = await service.getContentStats();
      expect(result.knowledgeDocuments).toBe(0);
      expect(result.knowledgeCategories).toEqual([]);
      expect(result.tarotReadings).toBe(0);
      expect(result.notifications).toBe(0);
    });
  });
});
