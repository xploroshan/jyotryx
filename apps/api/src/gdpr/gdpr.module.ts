import { Module } from '@nestjs/common';
import { GdprRequestService } from './gdpr-request.service';
import { GdprPurgeService } from '../modules/admin/gdpr-purge.service';

/**
 * Phase 4 GDPR queue + fulfillment. Owns both the request-tracking
 * service (Phase 4) and the existing partitioned-table purge helper
 * so the module graph is "Admin → Gdpr → Purge", not a cycle.
 *
 * GdprPurgeService's daily orphan sweep (@Cron('0 0 3 * * *')) keeps
 * running on the primary schedule; this move is purely organisational.
 */
@Module({
  providers: [GdprRequestService, GdprPurgeService],
  exports: [GdprRequestService, GdprPurgeService],
})
export class GdprModule {}
