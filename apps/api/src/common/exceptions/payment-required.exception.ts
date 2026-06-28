import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * HTTP 402 Payment Required. Thrown by the feature-access gate when a
 * paid feature (Reports, Palmistry) is requested by a user who is neither
 * an active subscriber nor holds an unused one-time entitlement. The web
 * client branches on the 402 status to launch the Cashfree checkout
 * instead of surfacing a generic error.
 */
export class PaymentRequiredException extends HttpException {
  constructor(
    message = 'Payment required to use this feature',
    /**
     * Optional structured hints merged into the 402 body so the web can
     * choose the right call-to-action — e.g. `{ subscribe: true }` to push
     * a free user to /pricing, or `{ feature: 'palmistry' }` to route a
     * subscriber to the matching overage top-up. Backward compatible: callers
     * that pass only a message get the original body shape plus these keys.
     */
    details: Record<string, unknown> = {},
  ) {
    super(
      { statusCode: HttpStatus.PAYMENT_REQUIRED, message, ...details },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
