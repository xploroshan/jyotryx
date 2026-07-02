import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterPushTokenDto {
  @ApiProperty({ description: 'Native FCM device registration token' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token!: string;

  @ApiProperty({ required: false, enum: ['android', 'ios'] })
  @IsOptional()
  @IsIn(['android', 'ios'])
  platform?: 'android' | 'ios';
}

export class UnregisterPushTokenDto {
  @ApiProperty({ description: 'The previously registered FCM token to remove' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  token!: string;
}
