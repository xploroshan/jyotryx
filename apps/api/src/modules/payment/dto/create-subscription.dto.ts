import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({ example: 'plan_premium_monthly', description: 'Razorpay plan ID' })
  @IsString()
  @IsNotEmpty()
  planId: string;

  @ApiProperty({ example: '12', description: 'Total billing cycles', required: false })
  @IsString()
  totalCount?: string;
}
