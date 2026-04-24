import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
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
// Phase 4 modules — safety (moderation queue), gdpr (export/delete
// queue + purge helper), forecast (Holt-Winters spend + TPM capacity).
import { SafetyModule } from '../../safety/safety.module';
import { GdprModule } from '../../gdpr/gdpr.module';
import { ForecastModule } from '../../forecast/forecast.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    UserModule,
    StatsModule,
    AnalyticsModule,
    AuthModule,
    OpsModule,
    SafetyModule,
    GdprModule,
    ForecastModule,
    NotificationModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService, GdprModule],
})
export class AdminModule {}
