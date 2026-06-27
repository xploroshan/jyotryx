import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({
    example: 'MONTHLY',
    enum: ['MONTHLY', 'ANNUAL'],
    description:
      'Logical plan tier. The server maps this to the configured Cashfree plan_id (CASHFREE_PLAN_MONTHLY / CASHFREE_PLAN_ANNUAL).',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['MONTHLY', 'ANNUAL'])
  plan!: string;

  @ApiProperty({ example: '12', description: 'Total billing cycles', required: false })
  @IsOptional()
  @IsString()
  totalCount?: string;
}
