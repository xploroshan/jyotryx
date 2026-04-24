import { Module } from '@nestjs/common';
import { StatsService } from './stats.service';
import { GrowthAnalyticsService } from './growth-analytics.service';

@Module({
  providers: [StatsService, GrowthAnalyticsService],
  exports: [StatsService, GrowthAnalyticsService],
})
export class StatsModule {}
