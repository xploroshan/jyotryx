import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { MetricsService } from '../../metrics/metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = req.method;
    const route = req.route?.path || req.url;
    const startTime = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse();
          const duration = Number(process.hrtime.bigint() - startTime) / 1e9;
          this.metricsService.httpRequestsTotal.inc({
            method,
            route,
            status_code: String(res.statusCode),
          });
          this.metricsService.httpRequestDuration.observe({ method, route }, duration);
        },
        error: (err: any) => {
          const statusCode = err?.status || err?.statusCode || 500;
          const duration = Number(process.hrtime.bigint() - startTime) / 1e9;
          this.metricsService.httpRequestsTotal.inc({
            method,
            route,
            status_code: String(statusCode),
          });
          this.metricsService.httpRequestDuration.observe({ method, route }, duration);
        },
      }),
    );
  }
}
