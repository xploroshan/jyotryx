import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ANALYTICS_SERVICE } from './analytics.interface';
import { PostgresAnalyticsService } from './postgres-analytics.service';
import { ClickHouseAnalyticsStub } from './clickhouse-analytics.stub';
import { AnalyticsSyncService } from './analytics-sync.service';
import { PrismaReadReplicaService } from '../prisma/prisma-read-replica.service';

@Module({
  providers: [
    {
      provide: ANALYTICS_SERVICE,
      useFactory: (config: ConfigService, readPrisma: PrismaReadReplicaService) => {
        const clickhouseUrl = config.get<string>('analytics.clickhouseUrl');
        if (clickhouseUrl) {
          return new ClickHouseAnalyticsStub();
        }
        return new PostgresAnalyticsService(readPrisma);
      },
      inject: [ConfigService, PrismaReadReplicaService],
    },
    AnalyticsSyncService,
  ],
  exports: [ANALYTICS_SERVICE],
})
export class AnalyticsModule {}
