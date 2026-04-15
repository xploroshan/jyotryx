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
      // (`redis://user:pass@host:port`). Prefer that when present AND it
      // has a valid scheme; fall back to `REDIS_HOST`/`REDIS_PORT` when
      // missing, malformed, or still an unresolved Railway template
      // literal like `${{Redis.REDIS_URL}}`.
      useFactory: (config: ConfigService) => {
        const url = process.env.REDIS_URL;
        if (url && /^rediss?:\/\//i.test(url)) {
          try {
            return new Redis(url, { lazyConnect: false });
          } catch {
            // fall through to host/port
          }
        }
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
