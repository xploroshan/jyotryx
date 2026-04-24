import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OpsHealthService } from './ops-health.service';
import { BroadcastService } from './broadcast.service';
import { QueueModule } from '../queue/queue.module';
import {
  REPORT_QUEUE,
  PALMISTRY_QUEUE,
  BROADCAST_QUEUE,
} from '../queue/queue.constants';

/**
 * Ops + broadcast surface for the admin console (Phase 3).
 *
 * Re-registers the three queue names so `@InjectQueue` resolves inside
 * this module. `QueueModule` is imported for the `BullModule.forRootAsync`
 * connection bootstrap and to pull in the processor bindings — the
 * `registerQueue` call below only declares the per-queue client
 * providers this module's services need; it does not create duplicate
 * processors.
 */
@Module({
  imports: [
    QueueModule,
    BullModule.registerQueue(
      { name: REPORT_QUEUE },
      { name: PALMISTRY_QUEUE },
      { name: BROADCAST_QUEUE },
    ),
  ],
  providers: [OpsHealthService, BroadcastService],
  exports: [OpsHealthService, BroadcastService],
})
export class OpsModule {}
