import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleAuthDto {
  @ApiProperty({ description: 'Google ID token from client-side authentication' })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
