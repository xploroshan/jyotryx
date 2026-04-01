import { Module } from '@nestjs/common';
import { NumerologyController } from './numerology.controller';
import { NumerologyService } from './numerology.service';
import { KnowledgeModule } from '../../knowledge/knowledge.module';

@Module({
  imports: [KnowledgeModule],
  controllers: [NumerologyController],
  providers: [NumerologyService],
  exports: [NumerologyService],
})
export class NumerologyModule {}
