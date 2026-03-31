import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { UserModule } from '../user/user.module';
import { KnowledgeModule } from '../../knowledge/knowledge.module';

@Module({
  imports: [UserModule, KnowledgeModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
