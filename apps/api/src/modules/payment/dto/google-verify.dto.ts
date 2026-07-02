import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Google Play purchase verification is server-authoritative, like Cashfree's:
 * the client sends the SKU + the opaque purchase token Play issued; the server
 * validates the token with the Play Developer API (purchases.products /
 * purchases.subscriptionsv2) and grants through the same idempotent
 * settle/activate paths. Nothing client-supplied is trusted for the grant.
 */
export class GoogleVerifyDto {
  @ApiProperty({ description: 'Play product/subscription SKU (same ids as web productIds)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  productId!: string;

  @ApiProperty({ description: 'Opaque purchase token from Play Billing' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  purchaseToken!: string;

  @ApiProperty({ enum: ['product', 'subscription'] })
  @IsIn(['product', 'subscription'])
  kind!: 'product' | 'subscription';

  @ApiProperty({ required: false, description: 'Play order id (GPA.…) when the client has it' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  orderId?: string;
}
