import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Arjun Sharma' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'arjun@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/(?=.*[a-z])/, { message: 'Password must contain at least one lowercase letter' })
  @Matches(/(?=.*[A-Z])/, { message: 'Password must contain at least one uppercase letter' })
  @Matches(/(?=.*\d)/, { message: 'Password must contain at least one number' })
  password!: string;

  @ApiProperty({ example: '+919876543210', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Invalid phone number format' })
  phone?: string;

  @ApiProperty({ example: '1990-05-15', required: false })
  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @ApiProperty({ example: '14:30', required: false })
  @IsOptional()
  @IsString()
  timeOfBirth?: string;

  @ApiProperty({ example: 'Mumbai, India', required: false })
  @IsOptional()
  @IsString()
  placeOfBirth?: string;

  // ─── Phase 2 growth-analytics context ───────────────────────────────
  // Clients that know their own locale/source (the web app already
  // persists its locale in localStorage) can override the
  // Accept-Language-derived values. Server clamps length + case in
  // buildSignupContext() before writing to Prisma.

  @ApiProperty({ example: 'hi', required: false, description: 'Primary locale (2-letter)' })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiProperty({ example: 'IN', required: false, description: 'ISO 3166-1 alpha-2 country code' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ example: 'organic', required: false, description: 'UTM/source tag captured at signup' })
  @IsOptional()
  @IsString()
  signupSource?: string;

  @ApiProperty({
    example: 'ANJALI23',
    required: false,
    description:
      'Referral code from a `?ref=…` share link. Both sides receive `referral.bonus_days` (default 30) of free Premium when the program is enabled.',
  })
  @IsOptional()
  @IsString()
  ref?: string;
}
