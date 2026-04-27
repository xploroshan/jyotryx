import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { BriefingMailerService } from '../modules/daily-briefing/briefing-mailer.service';
import { BRIEFING_QUEUE } from './queue.constants';

interface BriefingJobData {
  kind: 'fanout';
}

/**
 * BullMQ worker for the daily briefing fan-out.
 *
 * One job per cron tick (registered in BriefingMailerService.onModuleInit).
 * The work itself fans out per-user inside the mailer service so the
 * job can keep its `attempts: 1` — retrying the entire fan-out would
 * re-send to every successfully-mailed user.
 */
@Processor(BRIEFING_QUEUE)
export class BriefingProcessor extends WorkerHost {
  private readonly logger = new Logger(BriefingProcessor.name);

  constructor(private readonly mailer: BriefingMailerService) {
    super();
  }

  async process(job: Job<BriefingJobData>): Promise<{
    selected: number;
    sent: number;
    failed: number;
    skipped: number;
  }> {
    if (job.data?.kind === 'fanout') {
      this.logger.log('Daily briefing fan-out tick');
      return this.mailer.runDailyFanout();
    }
    this.logger.warn(`Unknown briefing job kind: ${JSON.stringify(job.data)}`);
    return { selected: 0, sent: 0, failed: 0, skipped: 0 };
  }
}
