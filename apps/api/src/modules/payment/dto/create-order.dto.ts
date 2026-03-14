import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({ example: 499, description: 'Amount in INR (smallest currency unit - paise)' })
  @IsNumber()
  @Min(100)
  amount: number;

  @ApiProperty({ example: 'INR', required: false })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: 'credit_pack_50', description: 'Product/plan identifier' })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ example: 'Purchase 50 credits', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
