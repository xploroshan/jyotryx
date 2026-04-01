import { Module } from '@nestjs/common';
import { DailyBriefingController } from './daily-briefing.controller';
import { DailyBriefingService } from './daily-briefing.service';
import { KnowledgeModule } from '../../knowledge/knowledge.module';

@Module({
  imports: [KnowledgeModule],
  controllers: [DailyBriefingController],
  providers: [DailyBriefingService],
  exports: [DailyBriefingService],
})
export class DailyBriefingModule {}
