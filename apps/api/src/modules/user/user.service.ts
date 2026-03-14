import { Injectable, NotFoundException, Logger } from '@nestjs/common';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  timeOfBirth?: string;
  placeOfBirth?: string;
  avatarUrl?: string;
  credits: number;
  subscriptionTier: 'free' | 'basic' | 'premium';
  createdAt: string;
}

export interface UpdateProfileDto {
  name?: string;
  phone?: string;
  dateOfBirth?: string;
  timeOfBirth?: string;
  placeOfBirth?: string;
  avatarUrl?: string;
}

export interface UserCredits {
  available: number;
  used: number;
  total: number;
  subscriptionTier: 'free' | 'basic' | 'premium';
  resetsAt: string;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  async getProfile(userId: string): Promise<UserProfile> {
    // TODO: Replace with Prisma query
    this.logger.log(`Fetching profile for user: ${userId}`);

    return {
      id: userId,
      name: 'Arjun Sharma',
      email: 'arjun@example.com',
      phone: '+919876543210',
      dateOfBirth: '1990-05-15',
      timeOfBirth: '14:30',
      placeOfBirth: 'Mumbai, India',
      credits: 10,
      subscriptionTier: 'free',
      createdAt: new Date().toISOString(),
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfile> {
    // TODO: Replace with Prisma update
    this.logger.log(`Updating profile for user: ${userId}`);

    const currentProfile = await this.getProfile(userId);
    return {
      ...currentProfile,
      ...dto,
    };
  }

  async getCredits(userId: string): Promise<UserCredits> {
    // TODO: Replace with Prisma query
    this.logger.log(`Fetching credits for user: ${userId}`);

    return {
      available: 10,
      used: 0,
      total: 10,
      subscriptionTier: 'free',
      resetsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  async deductCredits(userId: string, amount: number): Promise<boolean> {
    // TODO: Replace with Prisma transaction
    this.logger.log(`Deducting ${amount} credits from user: ${userId}`);
    return true;
  }

  async addCredits(userId: string, amount: number): Promise<boolean> {
    // TODO: Replace with Prisma transaction
    this.logger.log(`Adding ${amount} credits to user: ${userId}`);
    return true;
  }

  async findById(userId: string): Promise<UserProfile | null> {
    // TODO: Replace with Prisma query
    try {
      return await this.getProfile(userId);
    } catch {
      return null;
    }
  }
}
