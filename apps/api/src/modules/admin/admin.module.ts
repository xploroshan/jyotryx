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
// OpsModule (Phase 3) exports OpsHealthService + BroadcastService — the
// admin console fans out to them for the Ops tab, provider kill-switch,
// and broadcast queue.
import { OpsModule } from '../../ops/ops.module';

@Module({
  imports: [UserModule, StatsModule, AnalyticsModule, AuthModule, OpsModule],
  controllers: [AdminController],
  providers: [AdminService, GdprPurgeService],
  exports: [AdminService, GdprPurgeService],
})
export class AdminModule {}
