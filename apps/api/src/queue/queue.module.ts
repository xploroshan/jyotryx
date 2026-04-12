import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { ReportProcessor } from './report.processor';
import { PalmistryProcessor } from './palmistry.processor';
import { UserModule } from '../modules/user/user.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';

export const REPORT_QUEUE = 'report-generation';
export const PALMISTRY_QUEUE = 'palmistry-analysis';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host', 'redis'),
          port: config.get<number>('redis.port', 6379),
        },
      }),
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
