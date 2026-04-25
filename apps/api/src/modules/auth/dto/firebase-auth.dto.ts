import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class FirebaseAuthDto {
  @ApiProperty({ description: 'Firebase ID token from client-side authentication' })
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}
