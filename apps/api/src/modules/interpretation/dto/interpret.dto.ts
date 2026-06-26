import { IsString, IsIn, IsOptional, IsObject } from 'class-validator';

/**
 * Whitelisted interpretation domains. Each maps to a tone/context in the
 * service prompt and a `interpretation:<domain>` cache feature key. Add new
 * features here (Phase 2) — no other API change needed.
 */
export const INTERPRETATION_DOMAINS = [
  'kundli',
  'dosha',
  'matching',
  'numerology',
  'palmistry',
  'panchang',
  'horoscope',
  'dasha',
  'divisional',
  'kp',
  'western-natal',
  'transits',
  'bazi',
  'vastu',
  'general',
] as const;

export type InterpretationDomain = (typeof INTERPRETATION_DOMAINS)[number];

export class InterpretDto {
  @IsString()
  @IsIn(INTERPRETATION_DOMAINS as unknown as string[])
  domain!: InterpretationDomain;

  /** The already-computed result to explain (chart facts, numbers, lines, etc.). */
  @IsObject()
  payload!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  locale?: string;
}
