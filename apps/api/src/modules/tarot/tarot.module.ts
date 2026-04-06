import { Module } from '@nestjs/common';
import { TarotController } from './tarot.controller';
import { TarotService } from './tarot.service';
import { UserModule } from '../user/user.module';
import { KnowledgeModule } from '../../knowledge/knowledge.module';

@Module({
  imports: [UserModule, KnowledgeModule],
  controllers: [TarotController],
  providers: [TarotService],
  exports: [TarotService],
})
export class TarotModule {}
