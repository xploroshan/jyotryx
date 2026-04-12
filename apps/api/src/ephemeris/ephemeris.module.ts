import { Global, Module } from '@nestjs/common';
import { EphemerisService } from './ephemeris.service';

@Global()
@Module({
  providers: [EphemerisService],
  exports: [EphemerisService],
})
export class EphemerisModule {}
