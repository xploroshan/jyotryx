import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * Protects the Prometheus `/api/metrics` endpoint.
 *
 * The route is marked `@Public()` so the global JWT guard steps aside
 * (Prometheus can't present a user JWT), and this guard enforces a static
 * bearer token instead:
 *
 *   - When `METRICS_TOKEN` is set, callers MUST send
 *     `Authorization: Bearer <METRICS_TOKEN>` (constant-time compared).
 *   - When it is unset, access is allowed but a one-time warning is logged,
 *     so scraping keeps working on existing deploys while nudging operators
 *     to lock it down. Set `METRICS_TOKEN` in production — the endpoint
 *     otherwise leaks route inventory and business metrics (llm_cost_usd_*).
 */
@Injectable()
export class MetricsAuthGuard implements CanActivate {
  private readonly logger = new Logger(MetricsAuthGuard.name);
  private warnedOpen = false;

  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.METRICS_TOKEN?.trim();
    if (!expected) {
      if (!this.warnedOpen) {
        this.logger.warn(
          'METRICS_TOKEN is not set — /api/metrics is publicly reachable. ' +
            'Set METRICS_TOKEN to require a bearer token in production.',
        );
        this.warnedOpen = true;
      }
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const header: string = req.headers?.authorization ?? '';
    const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!provided) throw new UnauthorizedException('Missing metrics token');

    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid metrics token');
    }
    return true;
  }
}
