import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { GdprPurgeService } from './gdpr-purge.service';
import { UserModule } from '../user/user.module';
import { StatsModule } from '../../stats/stats.module';
import { AnalyticsModule } from '../../analytics/analytics.module';
// AuthModule exports AuthService — we import it here (not re-provide) so
// admin.service.ts can call AuthService.issueImpersonationToken() without
// duplicating JWT signing setup.
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [UserModule, StatsModule, AnalyticsModule, AuthModule],
  controllers: [AdminController],
  providers: [AdminService, GdprPurgeService],
  exports: [AdminService, GdprPurgeService],
})
export class AdminModule {}
