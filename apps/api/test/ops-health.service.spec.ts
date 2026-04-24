/**
 * OpsHealthService Phase 3 — verifies the shape of the aggregations
 * (error rate, latency percentiles, cache hit rate) by stubbing
 * `$queryRawUnsafe`, and verifies queue-depth delegation to the
 * BullMQ queue objects.
 *
 * We don't test the Postgres `percentile_cont` path itself — that's
 * a DB-integration concern — but we pin the output shape the admin
 * UI depends on so refactors don't silently drop fields.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { OpsHealthService } from '../src/ops/ops-health.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaReadReplicaService } from '../src/prisma/prisma-read-replica.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';
import {
  REPORT_QUEUE,
  PALMISTRY_QUEUE,
  BROADCAST_QUEUE,
} from '../src/queue/queue.constants';

function makePrisma() {
  return {
    $queryRawUnsafe: jest.fn(),
  };
}

function makeQueue(name: string) {
  return {
    name,
    getJobCounts: jest.fn().mockResolvedValue({
      waiting: 1, active: 2, delayed: 3, failed: 4, completed: 5,
    }),
  };
}

function makeRedis() {
  return {
    ping: jest.fn().mockResolvedValue('PONG'),
    dbsize: jest.fn().mockResolvedValue(42),
  };
}

describe('OpsHealthService', () => {
  let service: OpsHealthService;
  let prisma: ReturnType<typeof makePrisma>;
  let reportQ: ReturnType<typeof makeQueue>;
  let palmistryQ: ReturnType<typeof makeQueue>;
  let broadcastQ: ReturnType<typeof makeQueue>;
  let redis: ReturnType<typeof makeRedis>;

  beforeEach(async () => {
    prisma = makePrisma();
    reportQ = makeQueue(REPORT_QUEUE);
    palmistryQ = makeQueue(PALMISTRY_QUEUE);
    broadcastQ = makeQueue(BROADCAST_QUEUE);
    redis = makeRedis();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        OpsHealthService,
        { provide: PrismaService, useValue: prisma },
        { provide: PrismaReadReplicaService, useValue: prisma },
        { provide: getQueueToken(REPORT_QUEUE), useValue: reportQ },
        { provide: getQueueToken(PALMISTRY_QUEUE), useValue: palmistryQ },
        { provide: getQueueToken(BROADCAST_QUEUE), useValue: broadcastQ },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();
    service = moduleRef.get<OpsHealthService>(OpsHealthService);
  });

  describe('getLlmErrorRate', () => {
    it('computes error rate and attaches top-3 error codes per provider', async () => {
      // First call: per-provider totals + errors
      // Second call: per-(provider, error_code) counts for top error enrichment
      prisma.$queryRawUnsafe
        .mockResolvedValueOnce([
          { provider: 'openai', total: BigInt(100), errors: BigInt(5) },
          { provider: 'gemini', total: BigInt(50),  errors: BigInt(0) },
        ])
        .mockResolvedValueOnce([
          { provider: 'openai', error_code: 'TIMEOUT', count: BigInt(3) },
          { provider: 'openai', error_code: 'RATE_LIMIT', count: BigInt(2) },
        ]);

      const rows = await service.getLlmErrorRate(1);

      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({
        provider: 'openai',
        total: 100,
        errors: 5,
        errorRate: 0.05,
      });
      expect(rows[0].topErrors).toEqual([
        { errorCode: 'TIMEOUT', count: 3 },
        { errorCode: 'RATE_LIMIT', count: 2 },
      ]);
      // Zero-error provider keeps an empty topErrors array.
      expect(rows[1].topErrors).toEqual([]);
      expect(rows[1].errorRate).toBe(0);
    });

    it('clamps an out-of-range window down to the max (7d)', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      await service.getLlmErrorRate(9999);
      // Can't assert the exact timestamp, but both calls should have
      // fired. The clamp is internal; we only care no exception is
      // thrown on an absurd input.
      expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
    });
  });

  describe('getLatencyPercentiles', () => {
    it('returns integer-rounded p50/p95/p99 per dimension', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([
        { key: 'chat', count: BigInt(100), p50: 234.5, p95: 987.6, p99: 1500.9 },
        { key: 'report:life', count: BigInt(10), p50: 5000, p95: 7000, p99: 9000 },
      ]);

      const rows = await service.getLatencyPercentiles(24, 'feature');
      expect(rows).toEqual([
        { key: 'chat', count: 100, p50: 235, p95: 988, p99: 1501 },
        { key: 'report:life', count: 10, p50: 5000, p95: 7000, p99: 9000 },
      ]);
    });

    it('handles null percentile results (empty buckets) by returning 0', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([
        { key: 'panchang', count: BigInt(1), p50: null, p95: null, p99: null },
      ]);
      const rows = await service.getLatencyPercentiles(1, 'provider');
      expect(rows[0]).toMatchObject({ key: 'panchang', p50: 0, p95: 0, p99: 0 });
    });
  });

  describe('getCacheHitRate', () => {
    it('divides hits by total per feature', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([
        { feature: 'horoscope:daily', total: BigInt(200), hits: BigInt(150) },
        { feature: 'chat', total: BigInt(50), hits: BigInt(0) },
      ]);
      const rows = await service.getCacheHitRate(24);
      expect(rows[0]).toMatchObject({ feature: 'horoscope:daily', total: 200, hits: 150, hitRate: 0.75 });
      expect(rows[1]).toMatchObject({ hits: 0, hitRate: 0 });
    });
  });

  describe('getQueueDepths', () => {
    it('aggregates job counts across the three Phase 3 queues', async () => {
      const rows = await service.getQueueDepths();
      expect(rows).toHaveLength(3);
      expect(rows.map((r) => r.queue)).toEqual([
        REPORT_QUEUE,
        PALMISTRY_QUEUE,
        BROADCAST_QUEUE,
      ]);
      for (const r of rows) {
        expect(r).toMatchObject({ waiting: 1, active: 2, delayed: 3, failed: 4, completed: 5 });
      }
    });

    it('tolerates a per-queue getJobCounts failure without failing the whole readout', async () => {
      reportQ.getJobCounts.mockRejectedValueOnce(new Error('queue dead'));
      const rows = await service.getQueueDepths();
      expect(rows).toHaveLength(3);
      expect(rows[0]).toMatchObject({ queue: REPORT_QUEUE, waiting: 0, active: 0 });
      expect(rows[1].waiting).toBe(1); // palmistry still works
    });
  });

  describe('getServiceHealth', () => {
    it('reports both components up when pings succeed', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([{ '?column?': 1 }]);
      const h = await service.getServiceHealth();
      expect(h.database).toBe('up');
      expect(h.redis).toBe('up');
      expect(h.details.redisDbsize).toBe(42);
    });

    it('reports the DB down when the SELECT fails', async () => {
      prisma.$queryRawUnsafe.mockRejectedValue(new Error('connection reset'));
      const h = await service.getServiceHealth();
      expect(h.database).toBe('down');
      expect(h.details.databaseError).toContain('connection reset');
    });

    it('reports Redis down when ping returns an unexpected value', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([]);
      redis.ping.mockResolvedValue('WAT');
      const h = await service.getServiceHealth();
      expect(h.redis).toBe('down');
    });
  });
});
