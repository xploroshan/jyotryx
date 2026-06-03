import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { UserModule } from '../user/user.module';
import { KnowledgeModule } from '../../knowledge/knowledge.module';
import { LlmModule } from '../../llm/llm.module';
import { SafetyModule } from '../../safety/safety.module';
import { FeatureAccessModule } from '../../common/feature-access/feature-access.module';

@Module({
  imports: [UserModule, KnowledgeModule, LlmModule, SafetyModule, FeatureAccessModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
