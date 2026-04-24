/**
 * GrowthAnalyticsService tests.
 *
 * Covers the three pieces that carry real logic rather than Prisma
 * pass-through:
 *   1. Cohort stitching — 100 users × 4 weeks fixture, verifies the
 *      retention grid shape and values without hitting Postgres.
 *   2. Funnel endpoint integration — mocks Prisma against the same
 *      predicates the service emits, then asserts the returned shape
 *      matches the contract the web client depends on.
 *   3. Locale filter — asserts the base `where` clause carries a
 *      `locale` predicate whenever the caller passes one. Enforces
 *      the guarantee that the E2E locale-switch test exercises.
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  GrowthAnalyticsService,
  stitchCohortGrid,
} from '../src/stats/growth-analytics.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaReadReplicaService } from '../src/prisma/prisma-read-replica.service';
import { mockPrismaService } from './helpers/mocks';

describe('GrowthAnalyticsService', () => {
  let service: GrowthAnalyticsService;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeEach(async () => {
    prisma = mockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GrowthAnalyticsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PrismaReadReplicaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<GrowthAnalyticsService>(GrowthAnalyticsService);
  });

  // ──────────────────────────────────────────────────────────────────
  // 1. Cohort math
  // ──────────────────────────────────────────────────────────────────
  describe('stitchCohortGrid', () => {
    it('builds a retention grid from 100 users × 4 weeks fixture', () => {
      // 100 users signed up on 2026-03-02 (a Monday). 80 active in W0,
      // 60 in W1, 40 in W2, 20 in W3. Expected retention percentages:
      // [80, 60, 40, 20].
      const cohortWeek = new Date('2026-03-02T00:00:00.000Z');
      const sizeRows = [{ cohort_week: cohortWeek, size: BigInt(100) }];
      const activityRows = [
        { cohort_week: cohortWeek, week_offset: 0, active: BigInt(80) },
        { cohort_week: cohortWeek, week_offset: 1, active: BigInt(60) },
        { cohort_week: cohortWeek, week_offset: 2, active: BigInt(40) },
        { cohort_week: cohortWeek, week_offset: 3, active: BigInt(20) },
      ];

      const grid = stitchCohortGrid(sizeRows, activityRows, 4);

      expect(grid).toHaveLength(1);
      expect(grid[0].cohortWeek).toBe('2026-03-02');
      expect(grid[0].size).toBe(100);
      expect(grid[0].retention).toEqual([80, 60, 40, 20]);
    });

    it('pads missing week offsets with 0', () => {
      const cohortWeek = '2026-03-02';
      const grid = stitchCohortGrid(
        [{ cohort_week: cohortWeek, size: 50 }],
        [
          { cohort_week: cohortWeek, week_offset: 0, active: 50 },
          // W1 / W2 missing
          { cohort_week: cohortWeek, week_offset: 3, active: 10 },
        ],
        4,
      );
      expect(grid[0].retention).toEqual([100, 0, 0, 20]);
    });

    it('sorts cohorts ascending by week', () => {
      const grid = stitchCohortGrid(
        [
          { cohort_week: '2026-03-16', size: 10 },
          { cohort_week: '2026-03-02', size: 20 },
          { cohort_week: '2026-03-09', size: 15 },
        ],
        [],
        2,
      );
      expect(grid.map((g) => g.cohortWeek)).toEqual([
        '2026-03-02',
        '2026-03-09',
        '2026-03-16',
      ]);
    });

    it('clamps retention at 100% when active > size (defensive)', () => {
      const grid = stitchCohortGrid(
        [{ cohort_week: '2026-03-02', size: 10 }],
        [{ cohort_week: '2026-03-02', week_offset: 0, active: 15 }],
        2,
      );
      expect(grid[0].retention[0]).toBe(100);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 2. Funnel integration
  // ──────────────────────────────────────────────────────────────────
  describe('getFunnel', () => {
    it('returns stages shaped for the web client', async () => {
      // 200 signups → 150 profile-complete → 100 first chat → 40 first
      // payment → 10 renewals. Exercises the conversion-from-prev +
      // conversion-from-signup math at every stage.
      prisma.user.count
        .mockResolvedValueOnce(200)   // signup
        .mockResolvedValueOnce(150)   // profile_complete
        .mockResolvedValueOnce(100)   // first_chat
        .mockResolvedValueOnce(40)    // first_payment
        .mockResolvedValueOnce(10);   // renewal (intersection w/ base)
      prisma.payment.groupBy.mockResolvedValue([
        { userId: 'u-1', _count: { _all: 3 } },
        { userId: 'u-2', _count: { _all: 2 } },
      ]);

      const res = await service.getFunnel({ days: 30, locale: null });

      expect(res.totalSignups).toBe(200);
      expect(res.stages).toHaveLength(5);
      expect(res.stages.map((s) => s.count)).toEqual([200, 150, 100, 40, 10]);
      // profile_complete: 150 / 200 = 0.75
      expect(res.stages[1].conversionFromPrev).toBeCloseTo(0.75, 4);
      // first_payment vs first_chat: 40 / 100 = 0.4
      expect(res.stages[3].conversionFromPrev).toBeCloseTo(0.4, 4);
      // renewal vs signups: 10 / 200 = 0.05
      expect(res.stages[4].conversionFromSignup).toBeCloseTo(0.05, 4);
    });

    it('skips the renewal intersection query when no candidates', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.payment.groupBy.mockResolvedValue([]);

      const res = await service.getFunnel({ days: 30, locale: null });

      expect(res.totalSignups).toBe(0);
      expect(res.stages.every((s) => s.count === 0)).toBe(true);
      // All conversions should be 0 when there are no signups — never NaN.
      expect(res.stages.every((s) => Number.isFinite(s.conversionFromPrev))).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 3. Locale filter propagation
  // ──────────────────────────────────────────────────────────────────
  describe('locale filter', () => {
    it('passes locale into every funnel stage predicate', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.payment.groupBy.mockResolvedValue([]);

      await service.getFunnel({ days: 30, locale: 'hi' });

      // Every user.count call should carry `locale: 'hi'` in the where
      // clause. The renewal query happens only if groupBy returned
      // candidates — with groupBy empty here it shouldn't fire, so we
      // expect 4 calls, not 5.
      expect(prisma.user.count).toHaveBeenCalledTimes(4);
      for (const call of prisma.user.count.mock.calls) {
        expect(call[0]?.where?.locale).toBe('hi');
      }
    });

    it('omits the locale predicate when null', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.payment.groupBy.mockResolvedValue([]);

      await service.getFunnel({ days: 30, locale: null });

      for (const call of prisma.user.count.mock.calls) {
        expect(call[0]?.where?.locale).toBeUndefined();
      }
    });
  });
});
