import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { BROADCAST_QUEUE } from '../queue/queue.constants';
import {
  BroadcastAudience,
  BroadcastJobData,
} from '../queue/broadcast.processor';

export interface BroadcastRequest {
  audience: BroadcastAudience;
  subject: string;
  body: string;
  channel: 'inapp' | 'email' | 'push';
  notificationType?: 'horoscope' | 'panchang' | 'reminder' | 'promotion' | 'system';
}

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(BROADCAST_QUEUE) private readonly broadcastQueue: Queue,
  ) {}

  /**
   * Admin-facing audience preview so the UI can confirm "you're about
   * to notify N users" before the broadcast is committed to the queue.
   * Cheaper than the actual fan-out — single COUNT query.
   */
  async audienceCount(audience: BroadcastAudience): Promise<number> {
    const where: any = {};
    if (audience.type === 'premium') {
      where.role = { in: ['PREMIUM', 'ADMIN'] };
    } else if (audience.type === 'locale') {
      where.locale = audience.locale;
    }
    return this.prisma.user.count({ where });
  }

  /**
   * Enqueue a broadcast. We validate inputs here rather than inside
   * the processor so the admin gets a useful 400 instead of a failed
   * job buried in the queue.
   */
  async enqueue(
    req: BroadcastRequest,
    adminEmail: string,
  ): Promise<{ jobId: string; audienceSize: number }> {
    if (!req.subject || req.subject.trim().length === 0) {
      throw new BadRequestException('Broadcast subject is required');
    }
    if (!req.body || req.body.trim().length === 0) {
      throw new BadRequestException('Broadcast body is required');
    }
    if (req.subject.length > 200) {
      throw new BadRequestException('Broadcast subject must be ≤ 200 characters');
    }
    if (req.body.length > 4000) {
      throw new BadRequestException('Broadcast body must be ≤ 4000 characters');
    }
    if (req.audience?.type === 'locale' && !req.audience.locale) {
      throw new BadRequestException('locale audience requires a locale code');
    }

    const audienceSize = await this.audienceCount(req.audience);
    if (audienceSize === 0) {
      throw new BadRequestException('Broadcast audience is empty — refusing to enqueue');
    }

    const jobData: BroadcastJobData = {
      adminEmail,
      audience: req.audience,
      subject: req.subject,
      body: req.body,
      channel: req.channel,
      notificationType: req.notificationType,
    };
    const job = await this.broadcastQueue.add('broadcast', jobData);
    this.logger.log(
      `Broadcast enqueued by ${adminEmail}: jobId=${job.id} audience=${req.audience.type} size=${audienceSize}`,
    );
    return { jobId: String(job.id), audienceSize };
  }
}
