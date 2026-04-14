import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      // Railway / Upstash / Heroku expose Redis as a single `REDIS_URL`
      // (`redis://user:pass@host:port`). Prefer that when present; fall back
      // to `REDIS_HOST`/`REDIS_PORT` for local dev / self-hosted setups.
      useFactory: (config: ConfigService) => {
        const url = process.env.REDIS_URL;
        if (url) return new Redis(url, { lazyConnect: false });
        return new Redis({
          host: config.get<string>('redis.host', 'redis'),
          port: config.get<number>('redis.port', 6379),
          lazyConnect: false,
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
