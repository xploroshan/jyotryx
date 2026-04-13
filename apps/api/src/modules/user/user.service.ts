import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface UserProfile {
  id: string;
  name: string;
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

const VALID_TRADITIONS = new Set(['VEDIC', 'WESTERN', 'CHINESE']);

export interface UpdateProfileDto {
  name?: string;
  phone?: string;
  dateOfBirth?: string;
  timeOfBirth?: string;
  placeOfBirth?: string;
  gender?: string;
  profession?: string;
  profilePhoto?: string;
  preferredLanguage?: string;
  astrologyTraditions?: string[];
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

  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return {
      id: user.id,
      name: user.name,
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

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.phone && { phone: dto.phone }),
        ...(dto.dateOfBirth && { dateOfBirth: new Date(dto.dateOfBirth) }),
        ...(dto.timeOfBirth && { timeOfBirth: dto.timeOfBirth }),
        ...(dto.placeOfBirth && { placeOfBirth: { name: dto.placeOfBirth } }),
        ...(dto.gender && { gender: dto.gender }),
        ...(dto.profession && { profession: dto.profession as any }),
        ...(dto.profilePhoto && { profilePhoto: dto.profilePhoto }),
        ...(dto.preferredLanguage && { preferredLanguage: dto.preferredLanguage }),
        ...traditionsUpdate,
      },
    });

    return {
      id: user.id,
      name: user.name,
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
    return Number(result[0]?.affected ?? 0) > 0;
  }

  async addCredits(userId: string, amount: number, type: string, description: string): Promise<boolean> {
    await this.prisma.$transaction(async (tx: any) => {
      await tx.user.update({
        where: { id: userId },
        data: { credits: { increment: amount } },
      });

      await tx.creditTransaction.create({
        data: {
          userId,
          amount,
          type: type as any,
          description,
        },
      });
    });

    return true;
  }

  async findById(userId: string): Promise<UserProfile | null> {
    try {
      return await this.getProfile(userId);
    } catch {
      return null;
    }
  }
}
