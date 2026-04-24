import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../modules/notification/notification.service';
import { BROADCAST_QUEUE } from './queue.constants';

/**
 * Admin-initiated broadcast fan-out.
 *
 * Audience resolution happens at *job execution time*, not at enqueue,
 * so a broadcast picked up 30 seconds after `POST /admin/broadcast`
 * reflects the user set as it exists when the job runs. That's the
 * right default for targeting — the admin rarely wants a stale
 * snapshot — and it keeps the job payload small.
 *
 * Channel support today is the in-app notification table
 * (`NotificationService.sendBulkNotification`). Email / push are TODO;
 * the `channel` field on the payload is plumbed through so adding a
 * transport later is a processor-local change.
 */
export type BroadcastAudience =
  | { type: 'all' }
  | { type: 'premium' }
  | { type: 'locale'; locale: string };

export interface BroadcastJobData {
  /** Admin who initiated the broadcast — logged for audit correlation. */
  adminEmail: string;
  audience: BroadcastAudience;
  subject: string;
  body: string;
  /** Only 'inapp' is wired today; 'email' / 'push' reserved for later. */
  channel: 'inapp' | 'email' | 'push';
  notificationType?: 'horoscope' | 'panchang' | 'reminder' | 'promotion' | 'system';
}

@Processor(BROADCAST_QUEUE)
export class BroadcastProcessor extends WorkerHost {
  private readonly logger = new Logger(BroadcastProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {
    super();
  }

  async process(job: Job<BroadcastJobData>): Promise<{ sent: number; failed: number }> {
    const { adminEmail, audience, subject, body, channel, notificationType } = job.data;
    this.logger.log(
      `Broadcast job ${job.id}: admin=${adminEmail} audience=${audience.type} channel=${channel}`,
    );

    const userIds = await this.resolveAudience(audience);
    if (userIds.length === 0) {
      this.logger.warn(`Broadcast job ${job.id}: audience resolved to 0 users — skipping send`);
      return { sent: 0, failed: 0 };
    }

    // Only 'inapp' is implemented. Email / push land here later as
    // additional transports; for now we log + skip gracefully so an
    // admin picking the wrong channel doesn't 500 the queue.
    if (channel !== 'inapp') {
      this.logger.warn(
        `Broadcast job ${job.id}: channel="${channel}" not yet supported — treating as in-app`,
      );
    }

    const result = await this.notificationService.sendBulkNotification(userIds, {
      title: subject,
      body,
      type: notificationType ?? 'system',
    });
    this.logger.log(
      `Broadcast job ${job.id}: audience=${userIds.length} sent=${result.sent} failed=${result.failed}`,
    );
    return result;
  }

  private async resolveAudience(audience: BroadcastAudience): Promise<string[]> {
    const where: any = {};
    if (audience.type === 'premium') {
      where.role = { in: ['PREMIUM', 'ADMIN'] };
    } else if (audience.type === 'locale') {
      where.locale = audience.locale;
    }
    // Cap at 100k to protect the DB from a runaway fan-out — a realistic
    // broadcast audience is far smaller, and if it isn't, the admin
    // should segment it.
    const users = await this.prisma.user.findMany({
      where,
      select: { id: true },
      take: 100_000,
    });
    return users.map((u: { id: string }) => u.id);
  }
}
