import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FeatureAccessService } from '../../common/feature-access/feature-access.service';
import { normalizePhone } from '../../common/phone.util';

export interface UserProfile {
  id: string;
  name: string;
  /** Optional informal name. See schema.prisma User.nickname. */
  nickname?: string | null;
  email: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  timeOfBirth?: string | null;
  placeOfBirth?: any;
  gender?: string | null;
  profession?: string | null;
  profilePhoto?: string | null;
  preferredLanguage: string;
  astrologyTraditions: string[];
  primaryTradition: string | null;
  credits: number;
  role: string;
  createdAt: string;
  profileComplete: boolean;
}

const SUPPORTED_LANGUAGES = new Set([
  'en', 'hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa', 'or', 'as',
]);

/**
 * A profile is considered "complete" once the user has supplied the minimum
 * birth details required by the astrology features: date of birth, time of
 * birth, place of birth (with a name), and gender.
 */
export function isProfileComplete(user: {
  dateOfBirth: Date | null;
  timeOfBirth: string | null;
  placeOfBirth: any;
  gender: string | null;
}): boolean {
  if (!user.dateOfBirth) return false;
  if (!user.timeOfBirth) return false;
  if (!user.gender) return false;
  const place = user.placeOfBirth;
  if (!place) return false;
  if (typeof place === 'string') return place.trim().length > 0;
  if (typeof place === 'object' && typeof place.name === 'string') {
    return place.name.trim().length > 0;
  }
  return false;
}

const VALID_TRADITIONS = new Set(['VEDIC', 'WESTERN', 'CHINESE', 'HELLENISTIC', 'HORARY', 'MEDICAL']);
// Mirrors the Prisma `Profession` enum. The profile body is an interface, so
// the global ValidationPipe can't enforce it — we validate here before the
// raw value hits the typed enum column (which would otherwise 500).
const VALID_PROFESSIONS = new Set([
  'SOFTWARE', 'SALES', 'MARKETING', 'FINANCE', 'STUDENT',
  'BUSINESS', 'HEALTHCARE', 'CREATIVE', 'GOVERNMENT', 'OTHER',
]);

export interface UpdateProfileDto {
  name?: string;
  /** Informal name. Empty string clears the nickname. */
  nickname?: string | null;
  phone?: string;
  dateOfBirth?: string;
  timeOfBirth?: string;
  placeOfBirth?: string | { name: string; lat?: number; lng?: number };
  gender?: string;
  profession?: string;
  profilePhoto?: string;
  preferredLanguage?: string;
  astrologyTraditions?: string[];
  primaryTradition?: string | null;
}

export interface UserCredits {
  available: number;
  used: number;
  total: number;
  role: string;
  resetsAt: string;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private prisma: PrismaService,
    private featureAccess: FeatureAccessService,
  ) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return {
      id: user.id,
      name: user.name,
      nickname: (user as any).nickname ?? null,
      email: user.email,
      phone: user.phone,
      dateOfBirth: user.dateOfBirth?.toISOString() ?? null,
      timeOfBirth: user.timeOfBirth,
      placeOfBirth: user.placeOfBirth,
      gender: user.gender,
      profession: user.profession,
      profilePhoto: user.profilePhoto,
      preferredLanguage: user.preferredLanguage,
      astrologyTraditions: (user as any).astrologyTraditions ?? ['VEDIC'],
      primaryTradition: (user as any).primaryTradition ?? null,
      credits: user.credits,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      profileComplete: isProfileComplete(user),
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfile> {
    if (dto.preferredLanguage && !SUPPORTED_LANGUAGES.has(dto.preferredLanguage)) {
      throw new NotFoundException(`Unsupported language: ${dto.preferredLanguage}`);
    }

    // Validate astrology traditions if provided
    let traditionsUpdate: Record<string, any> = {};
    if (dto.astrologyTraditions) {
      const filtered = dto.astrologyTraditions.filter(t => VALID_TRADITIONS.has(t));
      if (filtered.length === 0) {
        throw new NotFoundException('At least one valid astrology tradition must be selected');
      }
      traditionsUpdate = { astrologyTraditions: filtered };
    }

    // Validate primaryTradition if provided. `null` clears the preference.
    let primaryTraditionUpdate: Record<string, any> = {};
    if (dto.primaryTradition !== undefined) {
      if (dto.primaryTradition === null) {
        primaryTraditionUpdate = { primaryTradition: null };
      } else if (VALID_TRADITIONS.has(dto.primaryTradition)) {
        primaryTraditionUpdate = { primaryTradition: dto.primaryTradition as any };
      } else {
        throw new NotFoundException(`Unsupported primary tradition: ${dto.primaryTradition}`);
      }
    }

    // placeOfBirth: accept a structured { name, lat, lng } object and store
    // it as-is; for a bare string, MERGE into the existing JSON so we don't
    // wipe the lat/lng the ephemeris engine needs (the old code replaced the
    // whole object with { name }, silently breaking chart generation).
    let placeOfBirthUpdate: Record<string, any> = {};
    if (dto.placeOfBirth !== undefined && dto.placeOfBirth !== null) {
      if (typeof dto.placeOfBirth === 'object') {
        placeOfBirthUpdate = { placeOfBirth: dto.placeOfBirth };
      } else {
        const current = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { placeOfBirth: true },
        });
        const prev = (current?.placeOfBirth ?? {}) as Record<string, any>;
        placeOfBirthUpdate = { placeOfBirth: { ...prev, name: dto.placeOfBirth } };
      }
    }

    // profession: validate against the Prisma enum before writing.
    let professionUpdate: Record<string, any> = {};
    if (dto.profession !== undefined && dto.profession !== null) {
      if (!VALID_PROFESSIONS.has(dto.profession)) {
        throw new BadRequestException(`Unsupported profession: ${dto.profession}`);
      }
      professionUpdate = { profession: dto.profession as any };
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name && { name: dto.name }),
        // Nickname is intentionally nullable — an empty string from
        // the client clears it (so the UI can drop the informal
        // greeting and fall back to the formal name).
        ...(dto.nickname !== undefined && { nickname: dto.nickname?.trim() || null }),
        // Normalize to the canonical E.164 form so phone login (which sees
        // Firebase's E.164 number) always matches what's saved here.
        ...(dto.phone && { phone: normalizePhone(dto.phone) }),
        ...(dto.dateOfBirth && { dateOfBirth: new Date(dto.dateOfBirth) }),
        ...(dto.timeOfBirth && { timeOfBirth: dto.timeOfBirth }),
        ...placeOfBirthUpdate,
        ...(dto.gender && { gender: dto.gender }),
        ...professionUpdate,
        ...(dto.profilePhoto && { profilePhoto: dto.profilePhoto }),
        ...(dto.preferredLanguage && { preferredLanguage: dto.preferredLanguage }),
        ...traditionsUpdate,
        ...primaryTraditionUpdate,
      },
    });

    return {
      id: user.id,
      name: user.name,
      nickname: (user as any).nickname ?? null,
      email: user.email,
      phone: user.phone,
      dateOfBirth: user.dateOfBirth?.toISOString() ?? null,
      timeOfBirth: user.timeOfBirth,
      placeOfBirth: user.placeOfBirth,
      gender: user.gender,
      profession: user.profession,
      profilePhoto: user.profilePhoto,
      preferredLanguage: user.preferredLanguage,
      astrologyTraditions: (user as any).astrologyTraditions ?? ['VEDIC'],
      primaryTradition: (user as any).primaryTradition ?? null,
      credits: user.credits,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      profileComplete: isProfileComplete(user),
    };
  }

  async getCredits(userId: string): Promise<UserCredits> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const totalDeducted = await this.prisma.creditTransaction.aggregate({
      where: { userId, amount: { lt: 0 } },
      _sum: { amount: true },
    });

    const used = Math.abs(totalDeducted._sum.amount ?? 0);

    // Compute resetsAt as first-of-next-month based on lastCreditReset
    const resetBase = (user as any).lastCreditReset ? new Date((user as any).lastCreditReset) : user.createdAt;
    const resetsAt = new Date(resetBase);
    resetsAt.setMonth(resetsAt.getMonth() + 1);
    resetsAt.setDate(1);
    resetsAt.setHours(0, 0, 0, 0);
    // If resetsAt is in the past, advance to next month from now
    if (resetsAt.getTime() < Date.now()) {
      const now = new Date();
      resetsAt.setFullYear(now.getFullYear(), now.getMonth() + 1, 1);
    }

    return {
      available: user.credits,
      used,
      total: user.credits + used,
      role: user.role,
      resetsAt: resetsAt.toISOString(),
    };
  }

  async deductCredits(userId: string, amount: number, description: string): Promise<boolean> {
    // Single-SQL CTE: atomically decrements credits (with WHERE guard) and
    // inserts the credit_transaction record only if the decrement succeeded.
    // One round-trip instead of two, PgBouncer-compatible.
    const negAmount = -amount;
    const result: { affected: bigint }[] = await this.prisma.$queryRawUnsafe(
      `WITH deducted AS (
        UPDATE users
        SET credits = credits - $1, "updatedAt" = NOW()
        WHERE id = $2::uuid AND credits >= $1
        RETURNING id
      )
      INSERT INTO credit_transactions (id, "userId", amount, type, description, "createdAt")
      SELECT gen_random_uuid(), $2::uuid, $3, 'CHAT_DEDUCTION'::"CreditTransactionType", $4, NOW()
      FROM deducted
      RETURNING (SELECT count(*) FROM deducted)::int AS affected`,
      amount,
      userId,
      negAmount,
      description,
    );
    const ok = Number(result[0]?.affected ?? 0) > 0;
    if (!ok) {
      // Diagnostic follow-up so the API log explains *why* the
      // deduction failed: stale JWT pointing to a missing user, an
      // unexpectedly large `amount` (e.g. an env-var override of
      // KUNDLI_CREDIT_COST), or a real "balance < cost" case. Cheap —
      // one indexed lookup, only on the failure path.
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { credits: true, email: true },
      });
      if (!user) {
        this.logger.warn(
          `deductCredits: no user with id=${userId} (stale JWT? deleted account?). ` +
          `Caller asked for amount=${amount} (description="${description}").`,
        );
      } else if (!Number.isFinite(amount) || amount < 0) {
        this.logger.warn(
          `deductCredits: invalid amount=${amount} for user=${user.email} ` +
          `(balance=${user.credits}, description="${description}"). ` +
          `Check the *_CREDIT_COST env var that produced this value.`,
        );
      } else {
        this.logger.warn(
          `deductCredits: insufficient — user=${user.email} balance=${user.credits} ` +
          `wanted=${amount} (description="${description}").`,
        );
      }
    }
    return ok;
  }

  async addCredits(userId: string, amount: number, type: string, description: string): Promise<boolean> {
    // Single-SQL CTE: atomically increments credits (only when the user
    // exists) and inserts the matching credit_transactions row. Mirrors
    // deductCredits above — one round-trip, PgBouncer-compatible, and
    // the audit-log insert is linked to the increment by construction
    // rather than relying on Prisma transaction isolation.
    const result: { affected: bigint }[] = await this.prisma.$queryRawUnsafe(
      `WITH credited AS (
        UPDATE users
        SET credits = credits + $1, "updatedAt" = NOW()
        WHERE id = $2::uuid
        RETURNING id
      )
      INSERT INTO credit_transactions (id, "userId", amount, type, description, "createdAt")
      SELECT gen_random_uuid(), $2::uuid, $1, $3::"CreditTransactionType", $4, NOW()
      FROM credited
      RETURNING (SELECT count(*) FROM credited)::int AS affected`,
      amount,
      userId,
      type,
      description,
    );
    return Number(result[0]?.affected ?? 0) > 0;
  }

  /**
   * Deduct `cost` credits up-front, run `work`, refund the credits if
   * `work` throws. Without this, an upstream failure (swisseph workers
   * dying, LLM rate-limited, DB hiccup, …) leaves the user out-of-pocket
   * with nothing to show for it.
   *
   * Throws `BadRequestException('Insufficient credits …')` if the
   * deduction itself fails (matching the original per-feature error
   * shape so existing 4xx clients don't break). Re-throws whatever
   * `work` threw so the client still sees the real failure rather
   * than a misleading success.
   *
   * The refund is best-effort: if even `addCredits` throws after a
   * failure, we log at error so an operator can correct the balance
   * manually, and still re-throw the original work error.
   */
  async deductWithRefund<T>(
    userId: string,
    cost: number,
    description: string,
    work: () => Promise<T>,
  ): Promise<T> {
    // New subscription model: when the credit currency is switched off, the
    // deterministic features that fund themselves through credits become free.
    // Short-circuit here so every `deductWithRefund` caller (kundli, matching,
    // divisional/KP charts, tarot, vastu) is freed in one place — no per-call
    // changes, and the refund dance is skipped entirely.
    if (!(await this.featureAccess.creditsEnabled())) {
      return work();
    }
    const deducted = await this.deductCredits(userId, cost, description);
    if (!deducted) {
      throw new BadRequestException('Insufficient credits. Please purchase more credits to continue.');
    }
    try {
      return await work();
    } catch (err) {
      try {
        await this.addCredits(userId, cost, 'ADMIN_GRANT', `Refund: ${description}`);
        this.logger.warn(
          `Refunded ${cost} credits to ${userId} after "${description}" failed: ${(err as Error)?.message ?? err}`,
        );
      } catch (refundErr) {
        this.logger.error(
          `REFUND FAILED for user=${userId} cost=${cost} desc="${description}". Manual balance correction needed.`,
          refundErr as Error,
        );
      }
      throw err;
    }
  }

  async findById(userId: string): Promise<UserProfile | null> {
    try {
      return await this.getProfile(userId);
    } catch {
      return null;
    }
  }
}
