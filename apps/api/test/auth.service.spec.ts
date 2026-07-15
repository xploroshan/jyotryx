import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';
import { createMockRedis } from './helpers/mocks';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;
  let redis: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mock-token'),
      verify: jest.fn(),
    };

    redis = createMockRedis();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: REDIS_CLIENT, useValue: redis },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                'credits.freeMonthly': 10,
                'jwt.secret': 'test-secret',
                'jwt.expiresIn': '7d',
                'jwt.refreshSecret': 'test-refresh-secret',
                'jwt.refreshExpiresIn': '30d',
                'otp.length': 6,
                'otp.expiresInMinutes': 5,
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should create a new user and return auth response', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'test-uuid',
        name: 'Test User',
        email: 'test@example.com',
        phone: null,
        credits: 10,
        role: 'USER',
      });

      const result = await service.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      });

      // Blocking email verification: no tokens until the address is confirmed.
      expect(result).toEqual({ requiresEmailVerification: true, email: 'test@example.com' });
    });

    it('should throw ConflictException if user already exists', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.register({
          name: 'Test',
          email: 'existing@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException for invalid email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'wrong@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('sendOtp', () => {
    it('should return success message', async () => {
      const result = await service.sendOtp({ phone: '+919876543210' });
      expect(result.message).toContain('OTP sent successfully');
      expect(result.expiresIn).toBe(300);
    });
  });

  describe('refreshToken', () => {
    it('should throw UnauthorizedException for invalid token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid');
      });

      await expect(
        service.refreshToken({ refreshToken: 'invalid-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects legacy (jti-less) refresh tokens, forcing re-login (M10)', async () => {
      // A pre-rotation token verifies fine but carries no jti/familyId.
      jwtService.verify.mockReturnValue({ sub: 'u1', email: 'a@b.com', name: 'A' });
      await expect(
        service.refreshToken({ refreshToken: 'legacy-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verifyOtp brute-force protection (H3)', () => {
    const phone = '+919876543210';

    it('locks the phone and burns the OTP after 5 wrong attempts', async () => {
      const key = `otp:${(service as any).normalizePhone(phone)}`;
      await redis.set(key, '123456');

      for (let i = 0; i < 5; i++) {
        await expect(
          service.verifyOtp({ phone, otp: '000000' } as any),
        ).rejects.toThrow('Invalid OTP');
      }

      // 5th failure burns the stored OTP...
      expect(await redis.get(key)).toBeNull();

      // ...and further attempts are locked out even with the correct code.
      await redis.set(key, '123456');
      await expect(
        service.verifyOtp({ phone, otp: '123456' } as any),
      ).rejects.toThrow('Too many incorrect attempts');
    });

    it('rejects a wrong-length OTP without crashing (constant-time compare guard)', async () => {
      const key = `otp:${(service as any).normalizePhone(phone)}`;
      await redis.set(key, '123456');
      await expect(
        service.verifyOtp({ phone, otp: '1' } as any),
      ).rejects.toThrow('Invalid OTP');
    });
  });
});
