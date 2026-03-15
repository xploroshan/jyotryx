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
  profilePhoto?: string | null;
  credits: number;
  role: string;
  createdAt: string;
}

export interface UpdateProfileDto {
  name?: string;
  phone?: string;
  dateOfBirth?: string;
  timeOfBirth?: string;
  placeOfBirth?: string;
  profilePhoto?: string;
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
      profilePhoto: user.profilePhoto,
      credits: user.credits,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfile> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.phone && { phone: dto.phone }),
        ...(dto.dateOfBirth && { dateOfBirth: new Date(dto.dateOfBirth) }),
        ...(dto.timeOfBirth && { timeOfBirth: dto.timeOfBirth }),
        ...(dto.placeOfBirth && { placeOfBirth: { name: dto.placeOfBirth } }),
        ...(dto.profilePhoto && { profilePhoto: dto.profilePhoto }),
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
      profilePhoto: user.profilePhoto,
      credits: user.credits,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
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

    return {
      available: user.credits,
      used,
      total: user.credits + used,
      role: user.role,
      resetsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  async deductCredits(userId: string, amount: number, description: string): Promise<boolean> {
    return await this.prisma.$transaction(async (tx: any) => {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || user.credits < amount) return false;

      await tx.user.update({
        where: { id: userId },
        data: { credits: { decrement: amount } },
      });

      await tx.creditTransaction.create({
        data: {
          userId,
          amount: -amount,
          type: 'CHAT_DEDUCTION',
          description,
        },
      });

      return true;
    });
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
