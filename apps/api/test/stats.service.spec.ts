/**
 * StatsService Tests
 *
 * Verifies daily stats aggregation, cron scheduling, and query helpers.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { StatsService } from '../src/stats/stats.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaReadReplicaService } from '../src/prisma/prisma-read-replica.service';
import { mockPrismaService } from './helpers/mocks';

describe('StatsService', () => {
  let service: StatsService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    prisma = mockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PrismaReadReplicaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<StatsService>(StatsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('computeAndStoreDailyStats', () => {
    const testDate = new Date('2026-04-10T00:00:00.000Z');

    beforeEach(() => {
      // Set up return values for all aggregation queries
      prisma.user.count.mockResolvedValue(100);
      prisma.subscription.count.mockResolvedValue(15);
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 50000 }, _count: 10 });
      prisma.chatSession.count.mockResolvedValue(200);
      prisma.creditTransaction.aggregate.mockResolvedValue({ _sum: { amount: -350 } });
      prisma.kundliChart.count.mockResolvedValue(50);
      prisma.matchingResult.count.mockResolvedValue(20);
      prisma.palmistryReading.count.mockResolvedValue(10);
      prisma.report.count.mockResolvedValue(30);
      prisma.tarotReading.count.mockResolvedValue(25);
      prisma.llmUsage.aggregate.mockResolvedValue({
        _sum: { costUsd: 12.5, totalTokens: 50000 },
        _count: 100,
      });
      // Phase 2 MRR rollup inputs: 10 MONTHLY + 2 ANNUAL @ ₹499 / ₹4999,
      // INR→USD 0.012 → (10 × 499 + 2 × 4999/12) × 0.012 = $69.88
      prisma.subscription.groupBy.mockResolvedValue([
        { plan: 'MONTHLY', _count: { _all: 10 } },
        { plan: 'ANNUAL', _count: { _all: 2 } },
      ]);
      prisma.payment.count.mockResolvedValue(3);
      prisma.siteSetting.findMany.mockResolvedValue([
        { key: 'pricing.monthly.price', value: '499' },
        { key: 'pricing.annual.price',  value: '4999' },
        { key: 'pricing.fx.inr_to_usd', value: '0.012' },
      ]);
    });

    it('should run all Prisma aggregation queries', async () => {
      await service.computeAndStoreDailyStats(testDate);

      // user.count called multiple times (totalUsers, newUsers, premiumUsers)
      expect(prisma.user.count).toHaveBeenCalledTimes(3);
      // subscription.count called twice (activeSubs + churn), plus groupBy for MRR
      expect(prisma.subscription.count).toHaveBeenCalledTimes(2);
      expect(prisma.subscription.groupBy).toHaveBeenCalledTimes(1);
      // payment.aggregate × 2 (cumulative + daily revenue) + payment.count for fails
      expect(prisma.payment.aggregate).toHaveBeenCalledTimes(2);
      expect(prisma.payment.count).toHaveBeenCalledTimes(1);
      expect(prisma.chatSession.count).toHaveBeenCalledTimes(2);
      expect(prisma.creditTransaction.aggregate).toHaveBeenCalledTimes(1);
      expect(prisma.kundliChart.count).toHaveBeenCalledTimes(1);
      expect(prisma.matchingResult.count).toHaveBeenCalledTimes(1);
      expect(prisma.palmistryReading.count).toHaveBeenCalledTimes(1);
      expect(prisma.report.count).toHaveBeenCalledTimes(1);
      expect(prisma.tarotReading.count).toHaveBeenCalledTimes(1);
      expect(prisma.llmUsage.aggregate).toHaveBeenCalledTimes(1);
      expect(prisma.siteSetting.findMany).toHaveBeenCalledTimes(1);
    });

    it('should upsert into statDaily with computed values', async () => {
      await service.computeAndStoreDailyStats(testDate);

      expect(prisma.statDaily.upsert).toHaveBeenCalledTimes(1);
      const call = prisma.statDaily.upsert.mock.calls[0][0];
      expect(call.where.date).toEqual(testDate);
      expect(call.create.totalUsers).toBe(100);
      expect(call.create.creditsConsumed).toBe(350); // Math.abs(-350)
      expect(call.create.llmCalls).toBe(100);
      expect(call.create.llmCostUsd).toBe(12.5);
      // Phase 2 rollups
      expect(call.create.mrrUsd).toBeCloseTo(69.88, 2);
      expect(call.create.churnedCount).toBe(15); // from subscription.count mock
      expect(call.create.paymentFails).toBe(3);
    });

    it('should handle zero/null data gracefully', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: null }, _count: 0 });
      prisma.payment.count.mockResolvedValue(0);
      prisma.creditTransaction.aggregate.mockResolvedValue({ _sum: { amount: null } });
      prisma.llmUsage.aggregate.mockResolvedValue({
        _sum: { costUsd: null, totalTokens: null },
        _count: 0,
      });
      prisma.subscription.groupBy.mockResolvedValue([]);
      prisma.siteSetting.findMany.mockResolvedValue([]);

      await service.computeAndStoreDailyStats(testDate);

      const call = prisma.statDaily.upsert.mock.calls[0][0];
      expect(call.create.totalUsers).toBe(0);
      expect(call.create.totalRevenue).toBe(0);
      expect(call.create.creditsConsumed).toBe(0);
      expect(call.create.llmCostUsd).toBe(0);
      expect(call.create.mrrUsd).toBe(0);
      expect(call.create.paymentFails).toBe(0);
    });

    it('should catch and log errors without throwing', async () => {
      prisma.user.count.mockRejectedValue(new Error('DB down'));

      // Should NOT throw
      await expect(service.computeAndStoreDailyStats(testDate)).resolves.toBeUndefined();
    });
  });

  describe('getLatestStats', () => {
    it('should query statDaily with descending date order', async () => {
      const mockStat = { date: new Date(), totalUsers: 100, newUsers: 5 };
      prisma.statDaily.findFirst.mockResolvedValue(mockStat);

      const result = await service.getLatestStats();

      expect(result).toEqual(mockStat);
      expect(prisma.statDaily.findFirst).toHaveBeenCalledWith({
        orderBy: { date: 'desc' },
      });
    });

    it('should return null when no stats exist', async () => {
      prisma.statDaily.findFirst.mockResolvedValue(null);
      const result = await service.getLatestStats();
      expect(result).toBeNull();
    });
  });

  describe('getStatsRange', () => {
    it('should filter by date range and order ascending', async () => {
      const from = new Date('2026-04-01');
      const to = new Date('2026-04-10');
      prisma.statDaily.findMany.mockResolvedValue([
        { date: new Date('2026-04-01'), totalUsers: 90 },
        { date: new Date('2026-04-10'), totalUsers: 100 },
      ]);

      const results = await service.getStatsRange(from, to);

      expect(results).toHaveLength(2);
      expect(prisma.statDaily.findMany).toHaveBeenCalledWith({
        where: { date: { gte: from, lte: to } },
        orderBy: { date: 'asc' },
      });
    });
  });
});
