import { Module } from '@nestjs/common';
import { GocharService } from './gochar.service';
import { GeoModule } from '../geo/geo.module';

/**
 * GocharService on its own, so consumers that only want per-user transit
 * personalization (chat) can import it without dragging in DailyBriefingModule's
 * BullMQ queue registration, mailer and controllers.
 *
 * EphemerisService comes from the @Global EphemerisModule.
 */
@Module({
  imports: [GeoModule],
  providers: [GocharService],
  exports: [GocharService],
})
export class GocharModule {}
