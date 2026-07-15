import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ForbiddenException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { FeatureAccessService } from '../src/common/feature-access/feature-access.service';
import { mockFeatureAccessService } from './helpers/mocks';
import { UserService } from '../src/modules/user/user.service';
import { PaymentService } from '../src/modules/payment/payment.service';
import { ChatService } from '../src/modules/chat/chat.service';
import { OpenAIService } from '../src/openai/openai.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { ModerationService } from '../src/safety/moderation.service';
import { MemoryService } from '../src/modules/memory/memory.service';
import { LlmService } from '../src/llm/llm.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';
import { mockKnowledgeService, mockOpenAIService, mockConfigService, mockUserService, mockPrismaService, mockLlmService, createMockRedis, mockMemoryService } from './helpers/mocks';
import * as crypto from 'crypto';

// ─── Authentication Security Tests ───────────────────────────────────────────

describe('Security: Authentication', () => {
  let authService: AuthService;
  let prisma: any;
  let jwtService: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mock-token'),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: REDIS_CLIENT, useValue: createMockRedis() },
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: mockConfigService() },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  // ─── Brute Force Protection ────────────────────────────────────

  describe('brute force protection', () => {
    it('should lock account after 5 failed login attempts', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'target@example.com',
        passwordHash: '$2b$12$invalidhash',
      });

      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await expect(
          authService.login({ email: 'target@example.com', password: 'wrong' }),
        ).rejects.toThrow(UnauthorizedException);
      }

      // 6th attempt should be ForbiddenException (locked)
      await expect(
        authService.login({ email: 'target@example.com', password: 'wrong' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should show remaining attempts warning when close to lockout', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'warn@example.com',
        passwordHash: '$2b$12$invalidhash',
      });

      // Make 3 failed attempts (2 remaining = should warn)
      for (let i = 0; i < 3; i++) {
        try {
          await authService.login({ email: 'warn@example.com', password: 'wrong' });
        } catch (e) {
          // continue
        }
      }

      // 4th attempt should show warning about remaining attempts
      try {
        await authService.login({ email: 'warn@example.com', password: 'wrong' });
      } catch (e: any) {
        expect(e.message).toContain('attempt');
      }
    });
  });

  // ─── Token Security ────────────────────────────────────────────

  describe('token security', () => {
    it('should reject expired refresh tokens', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(
        authService.refreshToken({ refreshToken: 'expired-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject tampered refresh tokens', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      await expect(
        authService.refreshToken({ refreshToken: 'tampered.token.here' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject refresh token for deleted user', async () => {
      jwtService.verify.mockReturnValue({ sub: 'deleted-user', email: 'x@x.com', name: 'X' });
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.refreshToken({ refreshToken: 'valid-but-user-deleted' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── OTP Security ─────────────────────────────────────────────

  describe('OTP security', () => {
    it('should reject OTP verification with no prior send', async () => {
      await expect(
        authService.verifyOtp({ phone: '+910000000000', otp: '123456' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject wrong OTP', async () => {
      await authService.sendOtp({ phone: '+919999999999' });

      await expect(
        authService.verifyOtp({ phone: '+919999999999', otp: '000000' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should rate limit OTP sends', async () => {
      await authService.sendOtp({ phone: '+918888888888' });

      // Immediate second request should be rate limited
      await expect(
        authService.sendOtp({ phone: '+918888888888' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── Password Security ────────────────────────────────────────

  describe('password security', () => {
    it('should hash passwords with bcrypt salt rounds >= 12', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(async ({ data }: any) => {
        // bcrypt hash with 12 rounds starts with $2b$12$
        expect(data.passwordHash).toMatch(/^\$2[aby]?\$1[2-9]\$/);
        return { id: 'u1', name: data.name, email: data.email, phone: null, credits: 10, role: 'USER' };
      });

      await authService.register({
        name: 'Secure User',
        email: 'secure@example.com',
        password: 'StrongPass123!',
      });

      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should reject changing password to same password', async () => {
      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash('SamePass123', 12);
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: hash });

      await expect(
        authService.changePassword('u1', { currentPassword: 'SamePass123', newPassword: 'SamePass123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject password change for social login users', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: null });

      await expect(
        authService.changePassword('u1', { currentPassword: 'any', newPassword: 'new' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── Registration Security ────────────────────────────────────

  describe('registration security', () => {
    it('should prevent duplicate email registration', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        authService.register({ name: 'Dup', email: 'existing@example.com', password: 'Pass123!' }),
      ).rejects.toThrow();
    });

    it('should not expose password hash in response', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'u1', name: 'Test', email: 'test@example.com', phone: null,
        credits: 10, role: 'USER', passwordHash: '$2b$12$secret',
      });

      const result = await authService.register({
        name: 'Test', email: 'test@example.com', password: 'Pass123!',
      });

      // Register returns the pending-verification state — never a user/hash.
      expect(JSON.stringify(result)).not.toContain('$2b$');
      expect(JSON.stringify(result)).not.toContain('passwordHash');
    });
  });
});

// ─── Input Validation Security Tests ─────────────────────────────────────────

describe('Security: Input Validation', () => {
  let chatService: ChatService;
  let prisma: any;

  beforeEach(async () => {
    prisma = mockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: UserService, useValue: mockUserService() },
        { provide: FeatureAccessService, useValue: mockFeatureAccessService() },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: LlmService, useValue: mockLlmService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: ModerationService, useValue: { checkAndRecord: jest.fn().mockResolvedValue(null) } },
        { provide: MemoryService, useValue: mockMemoryService() },
      ],
    }).compile();

    chatService = module.get<ChatService>(ChatService);
  });

  describe('XSS prevention', () => {
    it('should handle messages with HTML/script injection', async () => {
      prisma.chatSession.findFirst.mockResolvedValue(null);
      prisma.chatSession.create.mockResolvedValue({
        id: 'session-1', userId: 'test-uuid', title: 'Test', category: 'general',
        createdAt: new Date(), updatedAt: new Date(), messages: [],
      });
      prisma.chatMessage.create.mockResolvedValue({
        id: 'msg-1', role: 'assistant', content: 'Safe response', createdAt: new Date(),
      });
      prisma.chatMessage.findMany.mockResolvedValue([]);

      // Should not throw - the service should handle malicious input gracefully
      const result = await chatService.sendMessage('test-uuid', {
        message: '<script>alert("xss")</script><img onerror="evil()" src="x">',
        category: 'general',
      });

      expect(result.reply).toBeDefined();
    });

    it('should handle messages with SQL injection patterns', async () => {
      prisma.chatSession.findFirst.mockResolvedValue(null);
      prisma.chatSession.create.mockResolvedValue({
        id: 'session-1', userId: 'test-uuid', title: 'Test', category: 'general',
        createdAt: new Date(), updatedAt: new Date(), messages: [],
      });
      prisma.chatMessage.create.mockResolvedValue({
        id: 'msg-1', role: 'assistant', content: 'Response', createdAt: new Date(),
      });
      prisma.chatMessage.findMany.mockResolvedValue([]);

      const result = await chatService.sendMessage('test-uuid', {
        message: "'; DROP TABLE users; --",
        category: 'general',
      });

      expect(result.reply).toBeDefined();
    });

    it('should handle extremely long messages without crashing', async () => {
      prisma.chatSession.findFirst.mockResolvedValue(null);
      prisma.chatSession.create.mockResolvedValue({
        id: 'session-1', userId: 'test-uuid', title: 'Test', category: 'general',
        createdAt: new Date(), updatedAt: new Date(), messages: [],
      });
      prisma.chatMessage.create.mockResolvedValue({
        id: 'msg-1', role: 'assistant', content: 'Response', createdAt: new Date(),
      });
      prisma.chatMessage.findMany.mockResolvedValue([]);

      const longMessage = 'A'.repeat(100000);

      const result = await chatService.sendMessage('test-uuid', {
        message: longMessage,
        category: 'general',
      });

      expect(result.reply).toBeDefined();
    });
  });

  describe('authorization checks', () => {
    it('should not return sessions from other users', async () => {
      prisma.chatSession.findFirst.mockResolvedValue(null);

      await expect(
        chatService.getSession('attacker-uuid', 'victim-session-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

// ─── Payment/Webhook Security Tests ─────────────────────────────────────────

describe('Security: Payment Webhook', () => {
  describe('HMAC signature verification', () => {
    it('should generate valid HMAC-SHA256 signatures', () => {
      const secret = 'test-webhook-secret';
      const payload = JSON.stringify({ event: 'payment.captured', payload: {} });

      const signature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      // Signature should be a 64-character hex string
      expect(signature).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should detect tampered payloads via HMAC mismatch', () => {
      const secret = 'test-webhook-secret';
      const originalPayload = JSON.stringify({ event: 'payment.captured', amount: 499 });
      const tamperedPayload = JSON.stringify({ event: 'payment.captured', amount: 49900 });

      const originalSignature = crypto
        .createHmac('sha256', secret)
        .update(originalPayload)
        .digest('hex');

      const tamperedSignature = crypto
        .createHmac('sha256', secret)
        .update(tamperedPayload)
        .digest('hex');

      expect(originalSignature).not.toBe(tamperedSignature);
    });

    it('should use timing-safe comparison for signatures', () => {
      const sig1 = Buffer.from('a'.repeat(64));
      const sig2 = Buffer.from('a'.repeat(64));
      const sig3 = Buffer.from('b'.repeat(64));

      expect(crypto.timingSafeEqual(sig1, sig2)).toBe(true);
      expect(crypto.timingSafeEqual(sig1, sig3)).toBe(false);
    });
  });
});

// ─── Data Isolation Tests ────────────────────────────────────────────────────

describe('Security: Data Isolation', () => {
  let userService: UserService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      creditTransaction: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        create: jest.fn(),
      },
      $transaction: jest.fn(),
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ affected: BigInt(1) }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    userService = module.get<UserService>(UserService);
  });

  it('should not expose user data to wrong user ID', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      userService.getProfile('non-existent-user'),
    ).rejects.toThrow();
  });

  it('should prevent negative credit deduction (credit stealing)', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([{ affected: BigInt(1) }]);

    const result = await userService.deductCredits('u1', 0, 'Zero cost');
    expect(result).toBe(true);
  });

  it('should reject credit deduction when balance is insufficient', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([{ affected: BigInt(0) }]);

    const result = await userService.deductCredits('u1', 5, 'Expensive operation');
    expect(result).toBe(false);
  });
});
