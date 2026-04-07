import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VastuAnalysisDto {
  @ApiProperty({ enum: ['house', 'apartment', 'office', 'shop', 'factory', 'plot'], description: 'Property type' })
  @IsString()
  @IsIn(['house', 'apartment', 'office', 'shop', 'factory', 'plot'])
  propertyType: string;

  @ApiProperty({ enum: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'], description: 'Main entrance direction' })
  @IsString()
  @IsIn(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'])
  entranceDirection: string;

  @ApiProperty({ required: false, description: 'Specific concern or question' })
  @IsOptional()
  @IsString()
  concern?: string;

  @ApiProperty({ required: false, description: 'Language locale for AI response (e.g. hi, ta, bn)' })
  @IsOptional()
  @IsString()
  locale?: string;
}
