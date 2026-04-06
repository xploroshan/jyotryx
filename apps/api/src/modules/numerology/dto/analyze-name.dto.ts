import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AnalyzeNameDto {
  @ApiProperty({ example: 'Rahul Sharma' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;
}

export class AnalyzeBrandDto {
  @ApiProperty({ example: 'Jyotryx' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  brandName: string;

  @ApiProperty({ example: 'Technology', required: false })
  @IsString()
  @MaxLength(100)
  industry?: string;
}
