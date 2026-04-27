import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class PreviewReferralDto {
  @ApiProperty({ example: 'ANJALI23', description: 'Referral code from the share URL' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  code!: string;
}
