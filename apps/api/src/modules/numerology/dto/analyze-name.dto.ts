import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AnalyzeNameDto {
  @ApiProperty({ example: 'Rahul Sharma' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 'hi', required: false, description: 'Language locale for the analysis output' })
  @IsString()
  @IsOptional()
  @MaxLength(8)
  locale?: string;
}

export class AnalyzeBrandDto {
  @ApiProperty({ example: 'Jyotryx' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  brandName!: string;

  @ApiProperty({ example: 'Technology', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  industry?: string;

  @ApiProperty({ example: 'hi', required: false, description: 'Language locale for the analysis output' })
  @IsString()
  @IsOptional()
  @MaxLength(8)
  locale?: string;
}
