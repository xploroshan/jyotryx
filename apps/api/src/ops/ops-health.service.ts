import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaReadReplicaService } from '../prisma/prisma-read-replica.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import {
  REPORT_QUEUE,
  PALMISTRY_QUEUE,
  BROADCAST_QUEUE,
} from '../queue/queue.constants';

// ─── Response shapes ──────────────────────────────────────────────────────

export interface LlmErrorRateRow {
  provider: string;
  total: number;
  errors: number;
  errorRate: number;
  /** Top-3 error codes by count so admins see whether it's TIMEOUT vs RATE_LIMIT. */
  topErrors: Array<{ errorCode: string; count: number }>;
}

export interface LatencyBucket {
  key: string;
  count: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface CacheHitRow {
  feature: string;
  total: number;
  hits: number;
  hitRate: number;
}

export interface QueueDepthRow {
  queue: string;
  waiting: number;
  active: number;
  delayed: number;
  failed: number;
  completed: number;
}

export interface ServiceHealth {
  database: 'up' | 'down';
  redis: 'up' | 'down';
  details: Record<string, string | number>;
}

// ─── Service ──────────────────────────────────────────────────────────────

/**
 * Ops dashboard backend. Keeps all reads on the replica (via
 * `PrismaReadReplicaService`) because the queries here are latency
 * percentiles and group-by counts that would steal IO from the
 * primary write path at scale.
 */
@Injectable()
export class OpsHealthService {
  private readonly logger = new Logger(OpsHealthService.name);
  private readonly readPrisma: PrismaService;

  constructor(
    private readonly prisma: PrismaService,
    readReplicaPrisma: PrismaReadReplicaService,
    @InjectQueue(REPORT_QUEUE) private readonly reportQueue: Queue,
    @InjectQueue(PALMISTRY_QUEUE) private readonly palmistryQueue: Queue,
    @InjectQueue(BROADCAST_QUEUE) private readonly broadcastQueue: Queue,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.readPrisma = readReplicaPrisma as unknown as PrismaService;
  }

  // ────────────────────────────────────────────────────────────────────
  // LLM error rate by provider
  // ────────────────────────────────────────────────────────────────────

  /**
   * Error rate + top error codes per provider in the last `windowHours`
   * hours. A row's `errorCode` is non-null whenever the call failed
   * (see `LlmService.classifyError`). Cache-hit rows are excluded —
   * they're short-circuits, not real provider calls.
   */
  async getLlmErrorRate(windowHours: number): Promise<LlmErrorRateRow[]> {
    const hours = clampHours(windowHours);
    const since = new Date(Date.now() - hours * 3600 * 1000);

    const rows = await this.readPrisma.$queryRawUnsafe<
      Array<{ provider: string; total: bigint; errors: bigint }>
    >(
      `
      SELECT
        "provider",
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE "error_code" IS NOT NULL)::bigint AS errors
      FROM "llm_usage"
      WHERE "createdAt" >= $1::timestamptz
        AND "cache_hit" = FALSE
      GROUP BY "provider"
      ORDER BY total DESC
      `,
      since,
    );

    const byProvider: Record<string, Array<{ errorCode: string; count: number }>> = {};
    const topErrorRows = await this.readPrisma.$queryRawUnsafe<
      Array<{ provider: string; error_code: string; count: bigint }>
    >(
      `
      SELECT "provider", "error_code", COUNT(*)::bigint AS count
      FROM "llm_usage"
      WHERE "createdAt" >= $1::timestamptz
        AND "error_code" IS NOT NULL
      GROUP BY "provider", "error_code"
      ORDER BY count DESC
      `,
      since,
    );
    for (const r of topErrorRows) {
      if (!byProvider[r.provider]) byProvider[r.provider] = [];
      byProvider[r.provider].push({ errorCode: r.error_code, count: Number(r.count) });
    }

    return rows.map((r) => {
      const total = Number(r.total);
      const errors = Number(r.errors);
      return {
        provider: r.provider,
        total,
        errors,
        errorRate: total > 0 ? Math.round((errors / total) * 10000) / 10000 : 0,
        topErrors: (byProvider[r.provider] ?? []).slice(0, 3),
      };
    });
  }

  // ────────────────────────────────────────────────────────────────────
  // Latency percentiles
  // ────────────────────────────────────────────────────────────────────

  /**
   * p50 / p95 / p99 wall-clock latency per (dimension = feature|provider)
   * using Postgres `percentile_cont`. Only successful, non-cache rows
   * feed the percentiles — cache hits have no `duration_ms` and errors
   * warp tails.
   */
  async getLatencyPercentiles(
    windowHours: number,
    by: 'feature' | 'provider',
  ): Promise<LatencyBucket[]> {
    const hours = clampHours(windowHours);
    const since = new Date(Date.now() - hours * 3600 * 1000);
    const column = by === 'feature' ? '"feature"' : '"provider"';

    // `percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms)` is the
    // standard Postgres percentile. FILTER clause drops nulls and
    // cache-hits so the tail isn't contaminated.
    const rows = await this.readPrisma.$queryRawUnsafe<
      Array<{ key: string; count: bigint; p50: number | null; p95: number | null; p99: number | null }>
    >(
      `
      SELECT
        ${column} AS key,
        COUNT(*)::bigint AS count,
        percentile_cont(0.5)  WITHIN GROUP (ORDER BY "duration_ms") AS p50,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY "duration_ms") AS p95,
        percentile_cont(0.99) WITHIN GROUP (ORDER BY "duration_ms") AS p99
      FROM "llm_usage"
      WHERE "createdAt" >= $1::timestamptz
        AND "duration_ms" IS NOT NULL
        AND "cache_hit" = FALSE
        AND "error_code" IS NULL
      GROUP BY ${column}
      HAVING COUNT(*) > 0
      ORDER BY count DESC
      `,
      since,
    );

    return rows.map((r) => ({
      key: r.key,
      count: Number(r.count),
      p50: Math.round(Number(r.p50 ?? 0)),
      p95: Math.round(Number(r.p95 ?? 0)),
      p99: Math.round(Number(r.p99 ?? 0)),
    }));
  }

  // ────────────────────────────────────────────────────────────────────
  // Cache hit rate
  // ────────────────────────────────────────────────────────────────────

  /**
   * Share of LLM calls per feature that were served by the Redis cache
   * (see `LlmCacheService`). Hit-rate is the primary "are we saving
   * money" signal for the admin cost tab.
   */
  async getCacheHitRate(windowHours: number): Promise<CacheHitRow[]> {
    const hours = clampHours(windowHours);
    const since = new Date(Date.now() - hours * 3600 * 1000);

    const rows = await this.readPrisma.$queryRawUnsafe<
      Array<{ feature: string; total: bigint; hits: bigint }>
    >(
      `
      SELECT
        "feature",
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (WHERE "cache_hit" = TRUE)::bigint AS hits
      FROM "llm_usage"
      WHERE "createdAt" >= $1::timestamptz
      GROUP BY "feature"
      ORDER BY total DESC
      LIMIT 50
      `,
      since,
    );

    return rows.map((r) => {
      const total = Number(r.total);
      const hits = Number(r.hits);
      return {
        feature: r.feature,
        total,
        hits,
        hitRate: total > 0 ? Math.round((hits / total) * 10000) / 10000 : 0,
      };
    });
  }

  // ────────────────────────────────────────────────────────────────────
  // BullMQ queue depth
  // ────────────────────────────────────────────────────────────────────

  async getQueueDepths(): Promise<QueueDepthRow[]> {
    const queues: Array<{ name: string; queue: Queue }> = [
      { name: REPORT_QUEUE, queue: this.reportQueue },
      { name: PALMISTRY_QUEUE, queue: this.palmistryQueue },
      { name: BROADCAST_QUEUE, queue: this.broadcastQueue },
    ];

    const rows = await Promise.all(
      queues.map(async ({ name, queue }) => {
        try {
          const counts = await queue.getJobCounts(
            'waiting',
            'active',
            'delayed',
            'failed',
            'completed',
          );
          return {
            queue: name,
            waiting: counts.waiting ?? 0,
            active: counts.active ?? 0,
            delayed: counts.delayed ?? 0,
            failed: counts.failed ?? 0,
            completed: counts.completed ?? 0,
          };
        } catch (err: any) {
          this.logger.warn(`getJobCounts(${name}) failed: ${err?.message ?? err}`);
          return { queue: name, waiting: 0, active: 0, delayed: 0, failed: 0, completed: 0 };
        }
      }),
    );
    return rows;
  }

  // ────────────────────────────────────────────────────────────────────
  // Service health (DB + Redis)
  // ────────────────────────────────────────────────────────────────────

  /**
   * Synchronous DB + Redis status readout for the admin tab. This is a
   * lighter cousin of `/health/ready` — it returns the current state
   * plus a couple of useful counters (prisma version, redis dbsize)
   * instead of HTTP-503-ing the whole endpoint on a failure.
   */
  async getServiceHealth(): Promise<ServiceHealth> {
    const details: Record<string, string | number> = {};
    let database: 'up' | 'down' = 'up';
    let redis: 'up' | 'down' = 'up';

    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
    } catch (err: any) {
      database = 'down';
      details.databaseError = err?.message ?? String(err);
    }

    try {
      const pong = await Promise.race<string>([
        this.redis.ping(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Redis ping timeout')), 2000),
        ),
      ]);
      if (pong !== 'PONG') {
        redis = 'down';
        details.redisError = `unexpected response: ${pong}`;
      } else {
        try {
          const dbsize = await this.redis.dbsize();
          details.redisDbsize = dbsize;
        } catch {
          // dbsize is informational — ignore
        }
      }
    } catch (err: any) {
      redis = 'down';
      details.redisError = err?.message ?? String(err);
    }

    return { database, redis, details };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function clampHours(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(24 * 7, Math.max(1, Math.floor(n)));
}
