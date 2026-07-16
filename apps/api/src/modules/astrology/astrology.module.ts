import { Module } from '@nestjs/common';
import { AstrologyController } from './astrology.controller';
import { AstrologyService } from './astrology.service';
import { UserModule } from '../user/user.module';
import { KnowledgeModule } from '../../knowledge/knowledge.module';
import { GeoModule } from '../geo/geo.module';

@Module({
  imports: [UserModule, KnowledgeModule, GeoModule],
  controllers: [AstrologyController],
  providers: [AstrologyService],
  exports: [AstrologyService],
})
export class AstrologyModule {}
