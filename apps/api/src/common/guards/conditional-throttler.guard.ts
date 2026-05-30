import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * ThrottlerGuard that can be fully disabled via THROTTLE_DISABLED=true.
 *
 * Rate limiting is correct production behaviour, but it makes automated
 * end-to-end tests flaky: a real E2E run legitimately hits /auth/otp/send
 * (limit 3/min) several times from one IP and trips a 429 that has nothing
 * to do with what's under test. The flag is OFF by default, so production
 * and normal dev keep full throttling; only the real-API E2E harness sets it.
 */
@Injectable()
export class ConditionalThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(): Promise<boolean> {
    return (process.env.THROTTLE_DISABLED ?? '').toLowerCase() === 'true';
  }
}
