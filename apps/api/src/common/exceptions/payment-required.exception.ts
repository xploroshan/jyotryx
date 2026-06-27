import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * HTTP 402 Payment Required. Thrown by the feature-access gate when a
 * paid feature (Reports, Palmistry) is requested by a user who is neither
 * an active subscriber nor holds an unused one-time entitlement. The web
 * client branches on the 402 status to launch the Cashfree checkout
 * instead of surfacing a generic error.
 */
export class PaymentRequiredException extends HttpException {
  constructor(message = 'Payment required to use this feature') {
    super({ statusCode: HttpStatus.PAYMENT_REQUIRED, message }, HttpStatus.PAYMENT_REQUIRED);
  }
}
