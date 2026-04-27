import { Module } from '@nestjs/common';
import { AstrologyController } from './astrology.controller';
import { AstrologyService } from './astrology.service';
import { UserModule } from '../user/user.module';
import { KnowledgeModule } from '../../knowledge/knowledge.module';
// Phase 1 monetization — paywall A/B "first kundli is free" treatment
// reads its variant assignment + first-kundli-for-user check from the
// experiment service.
import { ExperimentModule } from '../experiment/experiment.module';

@Module({
  imports: [UserModule, KnowledgeModule, ExperimentModule],
  controllers: [AstrologyController],
  providers: [AstrologyService],
  exports: [AstrologyService],
})
export class AstrologyModule {}
