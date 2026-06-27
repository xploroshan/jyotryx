import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Cashfree verification is server-authoritative: the client sends ONLY the
 * orderId, and the server confirms the payment by fetching the order status
 * from Cashfree (`GET /pg/orders/{orderId}` → `order_status === 'PAID'`). There
 * is no client-supplied signature to trust (unlike Razorpay's checkout HMAC).
 */
export class VerifyPaymentDto {
  @ApiProperty({ description: 'Cashfree order ID returned by create-order' })
  @IsString()
  @IsNotEmpty()
  orderId!: string;
}
