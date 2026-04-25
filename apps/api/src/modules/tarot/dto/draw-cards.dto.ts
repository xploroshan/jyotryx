import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DrawCardsDto {
  @ApiProperty({ enum: ['single', 'three-card', 'celtic-cross'], description: 'Tarot spread type' })
  @IsString()
  @IsIn(['single', 'three-card', 'celtic-cross'])
  spread!: string;

  @ApiProperty({ required: false, description: 'Optional question or intention' })
  @IsOptional()
  @IsString()
  question?: string;

  @ApiProperty({ required: false, description: 'Language locale for AI response (e.g. hi, ta, bn)' })
  @IsOptional()
  @IsString()
  locale?: string;
}
