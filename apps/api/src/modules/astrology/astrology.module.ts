import { Module } from '@nestjs/common';
import { AstrologyController } from './astrology.controller';
import { AstrologyService } from './astrology.service';
import { UserModule } from '../user/user.module';
import { KnowledgeModule } from '../../knowledge/knowledge.module';

@Module({
  imports: [UserModule, KnowledgeModule],
  controllers: [AstrologyController],
  providers: [AstrologyService],
  exports: [AstrologyService],
})
export class AstrologyModule {}
