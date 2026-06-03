import { Module } from '@nestjs/common';
import { PalmistryController } from './palmistry.controller';
import { PalmistryService } from './palmistry.service';
import { UserModule } from '../user/user.module';
import { KnowledgeModule } from '../../knowledge/knowledge.module';
import { QueueModule } from '../../queue/queue.module';
import { FeatureAccessModule } from '../../common/feature-access/feature-access.module';

@Module({
  imports: [UserModule, KnowledgeModule, QueueModule, FeatureAccessModule],
  controllers: [PalmistryController],
  providers: [PalmistryService],
  exports: [PalmistryService],
})
export class PalmistryModule {}
