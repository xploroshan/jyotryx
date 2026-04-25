import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, Matches } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPass123!' })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({ example: 'NewStrongPass456!' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/(?=.*[a-z])/, { message: 'Password must contain at least one lowercase letter' })
  @Matches(/(?=.*[A-Z])/, { message: 'Password must contain at least one uppercase letter' })
  @Matches(/(?=.*\d)/, { message: 'Password must contain at least one number' })
  newPassword!: string;
}
