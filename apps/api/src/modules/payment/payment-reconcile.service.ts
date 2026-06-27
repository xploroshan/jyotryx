import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PaymentService } from './payment.service';

/**
 * Safety net for missed or dropped Cashfree webhooks.
 *
 * The webhook is the authoritative settlement path, but webhooks can be lost
 * (gateway retries exhausted, a deploy bouncing the pod, a transient 5xx). This
 * cron periodically asks Cashfree about payments we still hold as PENDING past a
 * grace period and settles any it reports PAID — through the SAME idempotent,
 * status-guarded grant path as verify/webhook, so it can never double-grant.
 *
 * Scheduling relies on the app-wide `ScheduleModule.forRoot()` (already
 * registered, e.g. partition.module); no per-module import is needed.
 */
@Injectable()
export class PaymentReconcileService {
  private readonly logger = new Logger(PaymentReconcileService.name);

  constructor(private readonly paymentService: PaymentService) {}

  // Every 10 minutes. Grace period (15 min) lives in reconcilePendingPayments.
  @Cron('0 */10 * * * *')
  async reconcile(): Promise<void> {
    try {
      const { checked, settled } = await this.paymentService.reconcilePendingPayments();
      if (checked > 0) {
        this.logger.log(`payment reconcile: checked ${checked}, settled ${settled}`);
      }
    } catch (error) {
      this.logger.error('payment reconcile run failed', error as Error);
    }
  }
}
