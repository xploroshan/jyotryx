import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';

export interface GunaDetailInput {
  guna: string;
  maxPoints: number;
  obtainedPoints: number;
  description: string;
}

export interface CreateShareInput {
  partner1Name?: string;
  partner2Name?: string;
  totalScore?: number;
  maxScore?: number;
  compatibility?: string;
  recommendation?: string;
  manglikA?: boolean;
  manglikB?: boolean;
  gunaDetails?: unknown;
  locale?: string;
}

/**
 * Creates and serves public, shareable snapshots of a Kundli-matching result.
 *
 * A snapshot holds only the *rendered* outcome — display names, the score, the
 * Ashtakoota breakdown — and never the partners' raw birth details, so a link
 * can be opened by anyone without leaking date/time/place of birth. The values
 * originate from the client's already-computed result; everything is clamped
 * and length-capped here so a stored snapshot is always sane and bounded.
 */
@Injectable()
export class MatchShareService {
  private readonly logger = new Logger(MatchShareService.name);

  static readonly MAX_NAME_LEN = 60;
  static readonly MAX_GUNA_NAME_LEN = 80;
  static readonly MAX_TEXT_LEN = 600;
  static readonly MAX_GUNA = 12;
  static readonly DEFAULT_MAX_SCORE = 36;
  static readonly SCORE_CEILING = 100;

  constructor(private prisma: PrismaService) {}

  /** 18 random bytes → 24 URL-safe chars; collision-resistant for share links. */
  private newToken(): string {
    return randomBytes(18).toString('base64url');
  }

  private clampName(v: unknown, fallback: string): string {
    const s = typeof v === 'string' ? v.trim() : '';
    return (s || fallback).slice(0, MatchShareService.MAX_NAME_LEN);
  }

  private clampText(v: unknown, max = MatchShareService.MAX_TEXT_LEN): string {
    return (typeof v === 'string' ? v.trim() : '').slice(0, max);
  }

  private toInt(v: unknown): number {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? n : 0;
  }

  private sanitizeGuna(list: unknown, maxScore: number): GunaDetailInput[] {
    if (!Array.isArray(list)) return [];
    return list.slice(0, MatchShareService.MAX_GUNA).map((g: any) => {
      const max = Math.max(0, Math.min(this.toInt(g?.maxPoints), maxScore));
      const obtained = Math.max(0, Math.min(this.toInt(g?.obtainedPoints), max));
      return {
        guna: this.clampText(g?.guna, MatchShareService.MAX_GUNA_NAME_LEN),
        description: this.clampText(g?.description),
        maxPoints: max,
        obtainedPoints: obtained,
      };
    });
  }

  /**
   * Persist a share snapshot and return its public token. `userId` is the
   * creator (for ownership / cascade-on-delete); it is never exposed publicly.
   */
  async create(userId: string | null | undefined, dto: CreateShareInput) {
    const maxScore = Math.max(
      1,
      Math.min(this.toInt(dto.maxScore) || MatchShareService.DEFAULT_MAX_SCORE, MatchShareService.SCORE_CEILING),
    );
    const totalScore = Math.max(0, Math.min(this.toInt(dto.totalScore), maxScore));
    const gunaDetails = this.sanitizeGuna(dto.gunaDetails, maxScore);

    // A few retries guard against the astronomically unlikely token collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      const token = this.newToken();
      try {
        const row = await this.prisma.sharedMatch.create({
          data: {
            token,
            createdById: userId ?? null,
            personAName: this.clampName(dto.partner1Name, 'Partner A'),
            personBName: this.clampName(dto.partner2Name, 'Partner B'),
            totalScore,
            maxScore,
            compatibility: this.clampText(dto.compatibility, MatchShareService.MAX_GUNA_NAME_LEN) || 'Average',
            recommendation: this.clampText(dto.recommendation),
            manglikA: Boolean(dto.manglikA),
            manglikB: Boolean(dto.manglikB),
            gunaDetails: gunaDetails as unknown as object,
            locale: typeof dto.locale === 'string' ? dto.locale.slice(0, 10) : null,
          },
          select: { token: true },
        });
        return { token: row.token };
      } catch (err: any) {
        // P2002 = unique-constraint clash on `token`; retry with a fresh one.
        if (err?.code === 'P2002' && attempt < 4) continue;
        throw err;
      }
    }
    // Unreachable in practice (5 fresh 144-bit tokens never all collide).
    throw new Error('Could not allocate a share token');
  }

  /**
   * Public read by token. Bumps the view counter best-effort — a failure there
   * must never break the read itself. Throws 404 when the token is unknown.
   */
  async getByToken(token: string) {
    const row = await this.prisma.sharedMatch.findUnique({ where: { token } });
    if (!row) {
      throw new NotFoundException('Shared match not found');
    }

    void this.prisma.sharedMatch
      .update({ where: { token }, data: { viewCount: { increment: 1 } } })
      .catch(() => undefined);

    const maxScore = row.maxScore || MatchShareService.DEFAULT_MAX_SCORE;
    return {
      token: row.token,
      personAName: row.personAName,
      personBName: row.personBName,
      totalScore: row.totalScore,
      maxScore,
      percentage: Math.round((row.totalScore / maxScore) * 100),
      compatibility: row.compatibility,
      recommendation: row.recommendation,
      manglikA: row.manglikA,
      manglikB: row.manglikB,
      gunaDetails: row.gunaDetails,
      locale: row.locale,
      createdAt: row.createdAt,
    };
  }
}
