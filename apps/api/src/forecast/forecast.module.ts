import { Module } from '@nestjs/common';
import { ForecastService } from './forecast.service';

/**
 * Phase 4 forecast module. Pure-read service (Holt smoothing + linear
 * regression) — no cron, no side effects, no new DB writes. AdminModule
 * imports this so the Cost / Ops tabs can fan out to it.
 */
@Module({
  providers: [ForecastService],
  exports: [ForecastService],
})
export class ForecastModule {}
