import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { ReportProcessor } from './report.processor';
import { PalmistryProcessor } from './palmistry.processor';
import { UserModule } from '../modules/user/user.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { REPORT_QUEUE, PALMISTRY_QUEUE } from './queue.constants';

export { REPORT_QUEUE, PALMISTRY_QUEUE };

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      // Railway / Upstash provide a single `REDIS_URL`; parse it once so
      // BullMQ and ioredis share the exact same connection parameters.
      useFactory: (config: ConfigService) => {
        const url = process.env.REDIS_URL;
        if (url) {
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
        }
        return {
          connection: {
            host: config.get<string>('redis.host', 'redis'),
            port: config.get<number>('redis.port', 6379),
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
    ),
    UserModule,
    KnowledgeModule,
  ],
  providers: [ReportProcessor, PalmistryProcessor],
  exports: [BullModule],
})
export class QueueModule {}
