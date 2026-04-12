import { Module } from '@nestjs/common';
import { PalmistryController } from './palmistry.controller';
import { PalmistryService } from './palmistry.service';
import { UserModule } from '../user/user.module';
import { KnowledgeModule } from '../../knowledge/knowledge.module';
import { QueueModule } from '../../queue/queue.module';

@Module({
  imports: [UserModule, KnowledgeModule, QueueModule],
  controllers: [PalmistryController],
  providers: [PalmistryService],
  exports: [PalmistryService],
})
export class PalmistryModule {}
