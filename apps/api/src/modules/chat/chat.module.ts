import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { UserModule } from '../user/user.module';
import { KnowledgeModule } from '../../knowledge/knowledge.module';
import { LlmModule } from '../../llm/llm.module';
import { SafetyModule } from '../../safety/safety.module';

@Module({
  imports: [UserModule, KnowledgeModule, LlmModule, SafetyModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
