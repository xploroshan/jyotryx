import { Controller, Get, Inject } from '@nestjs/common';
import {
  HealthCheck,
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
        await this.prisma.$queryRaw`SELECT 1`;
        return { database: { status: 'up' } };
      },
      async (): Promise<HealthIndicatorResult> => {
        const pong = await Promise.race<string>([
          this.redis.ping(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Redis ping timeout')), 2000),
          ),
        ]);
        return { redis: { status: pong === 'PONG' ? 'up' : 'down' } };
      },
    ]);
  }
}
