import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({ description: 'One-time email-verification token from the emailed link.' })
  @IsString()
  @IsNotEmpty()
  token!: string;
}
