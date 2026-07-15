import { Module } from '@nestjs/common';
import { GeoController } from './geo.controller';
import { GeoService } from './geo.service';

// MemoryCacheService is provided by the @Global OpenAIModule; REDIS_CLIENT by
// the @Global RedisModule — so GeoModule only needs to declare its own pieces.
@Module({
  controllers: [GeoController],
  providers: [GeoService],
  exports: [GeoService],
})
export class GeoModule {}
