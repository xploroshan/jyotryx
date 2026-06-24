import { Controller, Get, Inject } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckError,
  HealthCheckService,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { Public } from '../common/decorators/current-user.decorator';

// Liveness/readiness probes must stay reachable without a JWT — `@Public()`
// opts the whole controller out of the global auth guard.
@Controller('health')
@Public()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      async (): Promise<HealthIndicatorResult> => {
        // `$queryRawUnsafe` with a literal — no parameters, no prepared
        // statement. On PgBouncer (transaction or session mode under
        // load) `$queryRaw\`SELECT 1\`` can still trip
        // `42P05 prepared statement "sN" already exists` when the
        // pooler reuses a backend connection across checkouts.
        try {
          await this.prisma.$queryRawUnsafe('SELECT 1');
          return { database: { status: 'up' } };
        } catch (err: any) {
          // Terminus only reports `down` (→ HTTP 503) when the
          // indicator throws a HealthCheckError. Any other thrown
          // exception would bubble out as a 500 and make Kubernetes
          // readiness probes ambiguous.
          throw new HealthCheckError('Database check failed', {
            database: { status: 'down', message: err?.message || String(err) },
          });
        }
      },
      async (): Promise<HealthIndicatorResult> => {
        // When Redis is rate-limited or unreachable (e.g. Upstash daily
        // quota exhausted) the API can still serve auth, profile, and
        // most read paths — the queue workers are the only callers that
        // hard-depend on Redis. Setting `REDIS_HEALTH_REQUIRED=false`
        // (the default) makes the indicator soft: it logs the failure
        // and reports degraded, but readiness stays green so Railway
        // doesn't kill the replica while we fix the upstream provider.
        const required =
          (process.env.REDIS_HEALTH_REQUIRED ?? 'false').toLowerCase() === 'true';
        try {
          const pong = await Promise.race<string>([
            this.redis.ping(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Redis ping timeout')), 2000),
            ),
          ]);
          if (pong !== 'PONG') {
            throw new Error(`unexpected response: ${pong}`);
          }
          return { redis: { status: 'up' } };
        } catch (err: any) {
          const message = err?.message || String(err);
          if (required) {
            throw new HealthCheckError('Redis check failed', {
              redis: { status: 'down', message },
            });
          }
          // Soft mode: report degraded but keep readiness green.
          return { redis: { status: 'up', degraded: true, message } };
        }
      },
    ]);
  }
}
