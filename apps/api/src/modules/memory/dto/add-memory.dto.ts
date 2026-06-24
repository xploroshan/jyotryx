import { IsString, IsNotEmpty, MaxLength, IsOptional, IsIn } from 'class-validator';
import { MEMORY_KINDS } from '../memory.service';

export class AddMemoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  content!: string;

  @IsOptional()
  @IsString()
  @IsIn(MEMORY_KINDS as unknown as string[])
  kind?: string;
}
