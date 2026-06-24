import { IsString, IsOptional, IsBoolean, IsInt, IsArray, MaxLength, Min, Max } from 'class-validator';

export class CreateShareDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  partner1Name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  partner2Name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  totalScore?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxScore?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  compatibility?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  recommendation?: string;

  @IsOptional()
  @IsBoolean()
  manglikA?: boolean;

  @IsOptional()
  @IsBoolean()
  manglikB?: boolean;

  // Item shapes are sanitized/clamped server-side in MatchShareService.
  @IsOptional()
  @IsArray()
  gunaDetails?: unknown[];

  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string;
}
