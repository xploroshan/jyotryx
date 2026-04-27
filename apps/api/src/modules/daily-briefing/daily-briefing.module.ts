import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DailyBriefingController } from './daily-briefing.controller';
import { DailyBriefingService } from './daily-briefing.service';
import { BriefingMailerService } from './briefing-mailer.service';
import { BriefingPreferencesController } from './briefing-preferences.controller';
import { KnowledgeModule } from '../../knowledge/knowledge.module';
import { BRIEFING_QUEUE } from '../../queue/queue.constants';

@Module({
  imports: [
    KnowledgeModule,
    // Register BRIEFING_QUEUE here so BriefingMailerService can
    // `@InjectQueue` it without relying on QueueModule's import order.
    BullModule.registerQueue({ name: BRIEFING_QUEUE }),
  ],
  controllers: [DailyBriefingController, BriefingPreferencesController],
  providers: [DailyBriefingService, BriefingMailerService],
  exports: [DailyBriefingService, BriefingMailerService],
})
export class DailyBriefingModule {}
