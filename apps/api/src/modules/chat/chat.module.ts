import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { UserModule } from '../user/user.module';
import { KnowledgeModule } from '../../knowledge/knowledge.module';
import { LlmModule } from '../../llm/llm.module';
import { SafetyModule } from '../../safety/safety.module';
import { FeatureAccessModule } from '../../common/feature-access/feature-access.module';
import { MemoryModule } from '../memory/memory.module';
import { GocharModule } from '../daily-briefing/gochar.module';

@Module({
  // GocharModule supplies the per-user transit overlay. Without it chat had no
  // access to any computed astrology at all and had to invent every chart and
  // timing claim it made.
  imports: [UserModule, KnowledgeModule, LlmModule, SafetyModule, FeatureAccessModule, MemoryModule, GocharModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
