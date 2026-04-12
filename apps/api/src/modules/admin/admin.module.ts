import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { GdprPurgeService } from './gdpr-purge.service';
import { UserModule } from '../user/user.module';
import { StatsModule } from '../../stats/stats.module';
import { AnalyticsModule } from '../../analytics/analytics.module';

@Module({
  imports: [UserModule, StatsModule, AnalyticsModule],
  controllers: [AdminController],
  providers: [AdminService, GdprPurgeService],
  exports: [AdminService, GdprPurgeService],
})
export class AdminModule {}
