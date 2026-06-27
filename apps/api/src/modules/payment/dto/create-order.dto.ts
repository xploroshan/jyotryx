import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({
    example: 99,
    description:
      'Amount in INR rupees (Cashfree uses rupees, not paise). Validated server-side against the authoritative product price.',
  })
  @IsNumber()
  @Min(1)
  amount!: number;

  @ApiProperty({ example: 'INR', required: false })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: 'credits_starter', description: 'Product/plan identifier' })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ example: 'Purchase 50 credits', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
