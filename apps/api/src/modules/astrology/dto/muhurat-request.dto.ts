import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Validated body for POST /astrology/muhurat. `purpose` and `location` are
 * free text that gets interpolated into an LLM prompt, so they are length-
 * bounded and trimmed here (the service additionally fences them as data) to
 * limit prompt-injection / oversized-input surface. Structurally compatible
 * with the `MuhuratRequest` interface the service consumes.
 */
export class MuhuratRequestDto {
  @IsString()
  @Transform(trim)
  @MaxLength(200)
  purpose!: string;

  @IsString()
  @MaxLength(40)
  fromDate!: string;

  @IsString()
  @MaxLength(40)
  toDate!: string;

  @IsString()
  @Transform(trim)
  @MaxLength(120)
  location!: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  locale?: string;
}
