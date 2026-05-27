import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
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
        // When DISABLE_QUEUES=true, point BullMQ at a fail-fast dead
        // endpoint so its workers can never establish a connection in
        // the first place. The onModuleInit hook below closes workers
        // *after* they've been constructed, which races BullMQ's own
        // constructor that creates the Worker and immediately starts
        // polling — by the time the close lands, polling has already
        // fired off a few iterations against the real (rate-limited)
        // Redis. Pointing at 127.0.0.1:1 with `retryStrategy: null`
        // makes the very first connection attempt fail synchronously
        // and ioredis never reconnects, so no Redis traffic at all.
        if ((process.env.DISABLE_QUEUES ?? '').toLowerCase() === 'true') {
          return {
            connection: {
              host: '127.0.0.1',
              port: 1,
              lazyConnect: true,
              enableOfflineQueue: false,
              maxRetriesPerRequest: 0,
              retryStrategy: () => null,
              reconnectOnError: () => false,
            },
          };
        }
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
export class QueueModule implements OnModuleInit {
  private readonly logger = new Logger(QueueModule.name);

  constructor(private readonly moduleRef: ModuleRef) {}

  /**
   * When `DISABLE_QUEUES=true`, close every BullMQ Worker on boot.
   *
   * The escape hatch exists because BullMQ workers poll Redis many
   * times per second across multiple queues; on a rate-limited
   * provider (e.g. Upstash free-tier daily quota exhausted) this
   * cascades into a thrashing loop that prevents the health-ready
   * probe from succeeding and the deployment never goes live.
   *
   * Queue *clients* stay registered, so any callers that enqueue
   * jobs (`broadcastQueue.add(...)`) still compile and inject;
   * those calls will fail at runtime if Redis is still down, but
   * the API as a whole boots healthy.
   */
  async onModuleInit() {
    if ((process.env.DISABLE_QUEUES ?? '').toLowerCase() !== 'true') return;

    const processors = [ReportProcessor, PalmistryProcessor, BroadcastProcessor, BriefingProcessor];
    for (const Processor of processors) {
      try {
        const instance = this.moduleRef.get<any>(Processor, { strict: false });
        const worker = instance?.worker;
        if (worker && typeof worker.close === 'function') {
          await worker.close();
          this.logger.warn(`Disabled queue worker: ${Processor.name}`);
        }
      } catch (err) {
        this.logger.warn(
          `Failed to disable ${Processor.name}: ${(err as Error)?.message ?? err}`,
        );
      }
    }
  }
}
