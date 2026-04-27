import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class FirebaseAuthDto {
  @ApiProperty({ description: 'Firebase ID token from client-side authentication' })
  @IsString()
  @IsNotEmpty()
  idToken!: string;

  /**
   * Optional referral code captured from the `?ref=…` link. Only honoured
   * the first time this Firebase account signs up; subsequent logins ignore it.
   */
  @ApiProperty({ example: 'ANJALI23', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  ref?: string;
}
