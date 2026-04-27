import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { ReportProcessor } from './report.processor';
import { PalmistryProcessor } from './palmistry.processor';
import { BroadcastProcessor } from './broadcast.processor';
import { BriefingProcessor } from './briefing.processor';
import { UserModule } from '../modules/user/user.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { NotificationModule } from '../modules/notification/notification.module';
import { DailyBriefingModule } from '../modules/daily-briefing/daily-briefing.module';
import {
  REPORT_QUEUE,
  PALMISTRY_QUEUE,
  BROADCAST_QUEUE,
  BRIEFING_QUEUE,
} from './queue.constants';

export { REPORT_QUEUE, PALMISTRY_QUEUE, BROADCAST_QUEUE, BRIEFING_QUEUE };

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      // Railway / Upstash provide a single `REDIS_URL`; parse it once so
      // BullMQ and ioredis share the exact same connection parameters. If
      // the env var is missing, malformed, or still an unresolved Railway
      // template literal (`${{Redis.REDIS_URL}}`), fall back to the
      // per-field `REDIS_HOST` / `REDIS_PORT` config instead of crashing
      // with `TypeError: Invalid URL` at module init.
      useFactory: (config: ConfigService) => {
        const url = process.env.REDIS_URL;
        if (url && /^rediss?:\/\//i.test(url)) {
          try {
            const parsed = new URL(url);
            return {
              connection: {
                host: parsed.hostname,
                port: Number(parsed.port) || 6379,
                username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
                password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
                tls: parsed.protocol === 'rediss:' ? {} : undefined,
              },
            };
          } catch {
            // fall through to host/port
          }
        }
        const host = config.get<string>('redis.host', 'redis');
        const port = config.get<number>('redis.port', 6379);
        const useTls =
          process.env.REDIS_TLS === 'true' ||
          port === 6380 ||
          /\.upstash\.io$/i.test(host);
        return {
          connection: {
            host,
            port,
            password: process.env.REDIS_PASSWORD || undefined,
            username: process.env.REDIS_USERNAME || undefined,
            tls: useTls ? {} : undefined,
          },
        };
      },
    }),
    BullModule.registerQueue(
      {
        name: REPORT_QUEUE,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      },
      {
        name: PALMISTRY_QUEUE,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      },
      {
        name: BROADCAST_QUEUE,
        // Broadcasts are idempotent fan-outs — a single retry is plenty.
        // Heavier backlog retention than the other queues so the admin
        // can see the last few campaigns without paging BullMQ UI.
        defaultJobOptions: {
          attempts: 2,
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnComplete: 50,
          removeOnFail: 100,
        },
      },
      {
        name: BRIEFING_QUEUE,
        // Daily fan-out — exactly one attempt per cron tick. A retry
        // would re-send to every user already mailed in the previous
        // attempt, so the per-user idempotency guard inside
        // BriefingMailerService is the only safety net we want.
        defaultJobOptions: {
          attempts: 1,
          removeOnComplete: 30,
          removeOnFail: 60,
        },
      },
    ),
    UserModule,
    KnowledgeModule,
    NotificationModule,
    DailyBriefingModule,
  ],
  providers: [ReportProcessor, PalmistryProcessor, BroadcastProcessor, BriefingProcessor],
  exports: [BullModule],
})
export class QueueModule {}
