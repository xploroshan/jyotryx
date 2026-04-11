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

@Controller('health')
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
        try {
          await this.prisma.$queryRaw`SELECT 1`;
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
        try {
          const pong = await Promise.race<string>([
            this.redis.ping(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Redis ping timeout')), 2000),
            ),
          ]);
          if (pong !== 'PONG') {
            throw new HealthCheckError('Redis check failed', {
              redis: { status: 'down', message: `unexpected response: ${pong}` },
            });
          }
          return { redis: { status: 'up' } };
        } catch (err: any) {
          if (err instanceof HealthCheckError) throw err;
          throw new HealthCheckError('Redis check failed', {
            redis: { status: 'down', message: err?.message || String(err) },
          });
        }
      },
    ]);
  }
}
