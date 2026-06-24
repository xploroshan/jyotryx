import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { MetricsService } from './metrics.service';
import { Public } from '../common/decorators/current-user.decorator';
import { MetricsAuthGuard } from '../common/guards/metrics-auth.guard';

// `@Public()` opts out of the global JWT guard (Prometheus can't send a
// user token); `MetricsAuthGuard` then enforces the optional METRICS_TOKEN
// bearer so the endpoint isn't open to the internet.
@Controller('metrics')
@SkipThrottle()
@Public()
@UseGuards(MetricsAuthGuard)
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async getMetrics(@Res() res: Response): Promise<void> {
    res.set('Content-Type', this.metricsService.getContentType());
    res.end(await this.metricsService.getMetrics());
  }
}
