import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsIn, IsUUID, MaxLength } from 'class-validator';

const CATEGORIES = ['general', 'kundli', 'career', 'relationship', 'remedy', 'wealth', 'health', 'numerology'] as const;

export class SendMessageDto {
  @ApiPropertyOptional({ description: 'Existing session ID to continue a conversation' })
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @ApiProperty({ description: 'The message to send to the AI astrologer' })
  @IsString()
  @IsNotEmpty({ message: 'Message cannot be empty' })
  @MaxLength(2000, { message: 'Message cannot exceed 2000 characters' })
  message!: string;

  @ApiPropertyOptional({ description: 'Consultation category', enum: CATEGORIES })
  @IsOptional()
  @IsIn(CATEGORIES, { message: `Category must be one of: ${CATEGORIES.join(', ')}` })
  category?: typeof CATEGORIES[number];

  @ApiPropertyOptional({ description: 'Language locale for AI response (e.g. hi, ta, bn)' })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional({
    description:
      'Selected astrologer persona id from the "Chat with Astrologer" surface. Determines the named persona and specialty.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  astrologerId?: string;
}
