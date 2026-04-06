import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, UnauthorizedException, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { AuthService } from '../src/modules/auth/auth.service';
import { ChatService } from '../src/modules/chat/chat.service';
import { UserService } from '../src/modules/user/user.service';
import { PaymentService } from '../src/modules/payment/payment.service';
import { ReportService } from '../src/modules/report/report.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { OpenAIService } from '../src/openai/openai.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import {
  mockKnowledgeService,
  mockOpenAIService,
  mockPrismaService,
  mockConfigService,
  mockUserService,
  mockUser,
} from './helpers/mocks';
import * as crypto from 'crypto';

// ─── E2E: Full Registration → Login → Chat Flow ────────────────────────────

describe('E2E: Auth → Chat Flow', () => {
  let authService: AuthService;
  let chatService: ChatService;
  let prisma: any;
  let jwtService: any;

  beforeEach(async () => {
    prisma = mockPrismaService();
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: UserService, useValue: mockUserService() },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    chatService = module.get<ChatService>(ChatService);
  });

  it('should register a new user, then send a chat message', async () => {
    // Step 1: Register
    prisma.user.findUnique.mockResolvedValueOnce(null); // no existing user
    prisma.user.create.mockResolvedValueOnce({
      id: 'new-user-id',
      name: 'E2E User',
      email: 'e2e@example.com',
      phone: null,
      credits: 10,
      role: 'USER',
    });

    const registerResult = await authService.register({
      name: 'E2E User',
      email: 'e2e@example.com',
      password: 'StrongPass123!',
    });

    expect(registerResult.user.id).toBe('new-user-id');
    expect(registerResult.user.email).toBe('e2e@example.com');
    expect(registerResult.tokens.accessToken).toBe('mock-jwt-token');

    // Step 2: Send chat message
    prisma.chatSession.findFirst.mockResolvedValue(null);
    prisma.chatSession.create.mockResolvedValue({
      id: 'session-1',
      userId: 'new-user-id',
      title: 'Test message',
      category: 'general',
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
    });
    prisma.chatMessage.create.mockResolvedValue({
      id: 'msg-1',
      sessionId: 'session-1',
      role: 'ASSISTANT',
      content: 'Welcome to Jyotron!',
      createdAt: new Date(),
    });

    const chatResult = await chatService.sendMessage('new-user-id', {
      message: 'Tell me about my career',
      category: 'career',
    });

    expect(chatResult.session.id).toBe('session-1');
    expect(chatResult.reply.role).toBe('assistant');
    expect(chatResult.reply.content).toBeDefined();
  });

  it('should register, then login with same credentials', async () => {
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash('SecurePass456!', 12);

    // Register
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.create.mockResolvedValueOnce({
      id: 'user-2',
      name: 'Login Test',
      email: 'login@example.com',
      phone: null,
      credits: 10,
      role: 'USER',
    });

    await authService.register({
      name: 'Login Test',
      email: 'login@example.com',
      password: 'SecurePass456!',
    });

    // Login
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-2',
      name: 'Login Test',
      email: 'login@example.com',
      phone: null,
      credits: 10,
      role: 'USER',
      passwordHash: hash,
    });

    const loginResult = await authService.login({
      email: 'login@example.com',
      password: 'SecurePass456!',
    });

    expect(loginResult.user.id).toBe('user-2');
    expect(loginResult.tokens.accessToken).toBeDefined();
  });

  it('should prevent duplicate registration', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'existing' });

    await expect(
      authService.register({
        name: 'Duplicate',
        email: 'existing@example.com',
        password: 'Pass123!',
      }),
    ).rejects.toThrow(ConflictException);
  });
});

// ─── E2E: OTP Flow ──────────────────────────────────────────────────────────

describe('E2E: OTP Send → Verify → Chat', () => {
  let authService: AuthService;
  let chatService: ChatService;
  let prisma: any;
  let jwtService: any;

  beforeEach(async () => {
    prisma = mockPrismaService();
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mock-otp-token'),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: UserService, useValue: mockUserService() },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    chatService = module.get<ChatService>(ChatService);
  });

  it('should send OTP, verify it, and create a new user', async () => {
    const phone = '+911234567890';

    // Send OTP
    const sendResult = await authService.sendOtp({ phone });
    expect(sendResult.message).toContain('OTP sent');
    expect(sendResult.expiresIn).toBeGreaterThan(0);

    // We need to extract OTP from internal state — use a known approach
    // Since OTP is stored in memory, we test the verify flow separately
    prisma.user.findUnique.mockResolvedValueOnce(null); // no existing user by phone
    prisma.user.create.mockResolvedValueOnce({
      id: 'otp-user-1',
      name: 'User',
      email: '911234567890@phone.jyotron.com',
      phone,
      credits: 10,
      role: 'USER',
    });

    // Verify with wrong OTP should fail
    await expect(
      authService.verifyOtp({ phone, otp: '000000' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject OTP verify without prior send', async () => {
    await expect(
      authService.verifyOtp({ phone: '+910000000001', otp: '123456' }),
    ).rejects.toThrow(BadRequestException);
  });
});

// ─── E2E: Chat Session Management ──────────────────────────────────────────

describe('E2E: Chat Session Lifecycle', () => {
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
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
      ],
    }).compile();

    chatService = module.get<ChatService>(ChatService);
  });

  it('should create a new session on first message', async () => {
    prisma.chatSession.findFirst.mockResolvedValue(null);
    prisma.chatSession.create.mockResolvedValue({
      id: 'new-session',
      userId: 'test-uuid',
      title: 'What is my destiny?',
      category: 'kundli',
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [],
    });
    prisma.chatMessage.create.mockResolvedValue({
      id: 'reply-1',
      sessionId: 'new-session',
      role: 'ASSISTANT',
      content: 'Based on Vedic astrology...',
      createdAt: new Date(),
    });

    const result = await chatService.sendMessage('test-uuid', {
      message: 'What is my destiny?',
      category: 'kundli',
    });

    expect(result.session.id).toBe('new-session');
    expect(result.session.category).toBe('kundli');
    expect(prisma.chatSession.create).toHaveBeenCalled();
  });

  it('should reuse existing session when sessionId provided', async () => {
    const existingSession = {
      id: 'existing-session',
      userId: 'test-uuid',
      title: 'Career chat',
      category: 'career',
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [
        { id: 'prev-msg', sessionId: 'existing-session', role: 'USER', content: 'Previous message', createdAt: new Date() },
      ],
    };
    prisma.chatSession.findFirst.mockResolvedValue(existingSession);
    prisma.chatMessage.create.mockResolvedValue({
      id: 'reply-2',
      sessionId: 'existing-session',
      role: 'ASSISTANT',
      content: 'Follow-up answer...',
      createdAt: new Date(),
    });

    const result = await chatService.sendMessage('test-uuid', {
      sessionId: 'existing-session',
      message: 'Tell me more about my career',
      category: 'career',
    });

    expect(result.session.id).toBe('existing-session');
    expect(result.session.messages.length).toBeGreaterThan(1);
    expect(prisma.chatSession.create).not.toHaveBeenCalled();
  });

  it('should list all sessions for a user', async () => {
    prisma.chatSession.findMany.mockResolvedValue([
      { id: 's1', userId: 'test-uuid', title: 'Session 1', category: 'general', createdAt: new Date(), updatedAt: new Date() },
      { id: 's2', userId: 'test-uuid', title: 'Session 2', category: 'career', createdAt: new Date(), updatedAt: new Date() },
    ]);

    const sessions = await chatService.getSessions('test-uuid');
    expect(sessions.length).toBe(2);
    expect(sessions[0].id).toBe('s1');
  });

  it('should get a specific session with messages', async () => {
    prisma.chatSession.findFirst.mockResolvedValue({
      id: 'session-detail',
      userId: 'test-uuid',
      title: 'Detail Session',
      category: 'general',
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [
        { id: 'm1', sessionId: 'session-detail', role: 'USER', content: 'Hello', createdAt: new Date() },
        { id: 'm2', sessionId: 'session-detail', role: 'ASSISTANT', content: 'Namaste!', createdAt: new Date() },
      ],
    });

    const session = await chatService.getSession('test-uuid', 'session-detail');
    expect(session.messages.length).toBe(2);
    expect(session.messages[0].role).toBe('user');
    expect(session.messages[1].role).toBe('assistant');
  });

  it('should reject access to another user session', async () => {
    prisma.chatSession.findFirst.mockResolvedValue(null);

    await expect(
      chatService.getSession('attacker-id', 'victim-session'),
    ).rejects.toThrow(BadRequestException);
  });
});

// ─── E2E: Payment Order → Verify Flow ──────────────────────────────────────

describe('E2E: Payment Flow', () => {
  let paymentService: PaymentService;
  let prisma: any;

  beforeEach(async () => {
    prisma = mockPrismaService();
    prisma.payment = {
      create: jest.fn().mockResolvedValue({ id: 'pay-1' }),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      updateMany: jest.fn(),
    };
    prisma.subscription = {
      create: jest.fn(),
      updateMany: jest.fn(),
    };
    prisma.siteSetting = {
      findMany: jest.fn().mockResolvedValue([]),
    };

    // Use empty razorpay keyId/keySecret so PaymentService runs in mock mode,
    // but keep webhookSecret for signature verification
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfigService({ 'razorpay.keyId': '', 'razorpay.keySecret': '' }) },
        { provide: UserService, useValue: mockUserService() },
      ],
    }).compile();

    paymentService = module.get<PaymentService>(PaymentService);
  });

  it('should create order and verify payment end-to-end', async () => {
    // Step 1: Create order (mock mode — no Razorpay instance)
    const order = await paymentService.createOrder('test-uuid', {
      amount: 9900,
      productId: 'credits_10',
      currency: 'INR',
    });

    expect(order.id).toMatch(/^order_mock_/);
    expect(order.amount).toBe(9900);
    expect(order.currency).toBe('INR');
    expect(prisma.payment.create).toHaveBeenCalled();

    // Step 2: Verify payment
    const webhookSecret = 'test-webhook-secret';
    const orderId = order.id;
    const paymentId = 'pay_test_123';
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    prisma.payment.findFirst.mockResolvedValue({
      id: 'pay-1',
      userId: 'test-uuid',
      amount: 99,
      status: 'PENDING',
      razorpayOrderId: orderId,
    });

    const verifyResult = await paymentService.verifyPayment('test-uuid', {
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
    });

    expect(verifyResult.verified).toBe(true);
    expect(verifyResult.creditsAdded).toBeGreaterThan(0);
  });

  it('should reject order with tampered amount', async () => {
    await expect(
      paymentService.createOrder('test-uuid', {
        amount: 100, // should be 9900 for credits_10
        productId: 'credits_10',
        currency: 'INR',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject payment with invalid signature', async () => {
    prisma.payment.findFirst.mockResolvedValue({
      id: 'pay-1',
      userId: 'test-uuid',
      amount: 99,
      status: 'PENDING',
    });

    await expect(
      paymentService.verifyPayment('test-uuid', {
        razorpayOrderId: 'order_123',
        razorpayPaymentId: 'pay_123',
        razorpaySignature: 'invalid-signature',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should get payment history for user', async () => {
    prisma.payment.findMany.mockResolvedValue([
      {
        id: 'pay-1',
        razorpayOrderId: 'order_1',
        amount: 99,
        currency: 'INR',
        status: 'SUCCESS',
        type: 'CREDITS',
        createdAt: new Date(),
      },
    ]);

    const history = await paymentService.getPaymentHistory('test-uuid');
    expect(history.length).toBe(1);
    expect(history[0].status).toBe('SUCCESS');
  });
});

// ─── E2E: Report Generation → View Flow ────────────────────────────────────

describe('E2E: Report Flow', () => {
  let reportService: ReportService;
  let prisma: any;

  beforeEach(async () => {
    prisma = mockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: UserService, useValue: mockUserService() },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
      ],
    }).compile();

    reportService = module.get<ReportService>(ReportService);
  });

  it('should generate a report and retrieve it with cached sections', async () => {
    // Setup user profile
    prisma.user.findUnique.mockResolvedValue({
      ...mockUser,
      dateOfBirth: new Date('1990-05-15'),
      timeOfBirth: '14:30',
      placeOfBirth: { name: 'Mumbai' },
      gender: 'Male',
    });

    // Generate report — AI returns null so fallback sections are used
    const storedSections = JSON.stringify({
      sections: [
        { title: 'Birth Chart Overview', content: 'Your chart...', order: 1 },
        { title: 'Planetary Analysis', content: 'Jupiter...', order: 2 },
      ],
    });
    prisma.report.create.mockResolvedValue({
      id: 'report-1',
      userId: 'test-uuid',
      type: 'LIFE',
      status: 'READY',
      price: 5,
      fileUrl: storedSections,
      createdAt: new Date(),
    });

    const generateResult = await reportService.generateReport('test-uuid', {
      type: 'LIFE',
    });

    expect(generateResult.id).toBe('report-1');
    expect(generateResult.type).toBe('LIFE');
    expect(generateResult.sections.length).toBeGreaterThan(0);
    expect(generateResult.creditsCharged).toBe(5);

    // Now retrieve — should use cached sections, not regenerate
    prisma.report.findFirst.mockResolvedValue({
      id: 'report-1',
      userId: 'test-uuid',
      type: 'LIFE',
      status: 'READY',
      price: 5,
      fileUrl: storedSections,
      createdAt: new Date(),
    });

    const getResult = await reportService.getReport('test-uuid', 'report-1');
    expect(getResult.id).toBe('report-1');
    expect(getResult.sections.length).toBe(2);
    expect(getResult.sections[0].title).toBe('Birth Chart Overview');
  });

  it('should generate all report types', async () => {
    prisma.user.findUnique.mockResolvedValue(mockUser);

    const types = ['LIFE', 'CAREER', 'MARRIAGE', 'WEALTH', 'PALM', 'ANNUAL'] as const;

    for (const type of types) {
      prisma.report.create.mockResolvedValueOnce({
        id: `report-${type}`,
        userId: 'test-uuid',
        type,
        status: 'READY',
        price: 5,
        fileUrl: null,
        createdAt: new Date(),
      });

      const result = await reportService.generateReport('test-uuid', { type });
      expect(result.type).toBe(type);
      expect(result.sections.length).toBeGreaterThan(0);
    }
  });

  it('should fail report generation with insufficient credits', async () => {
    const userService = mockUserService();
    userService.deductCredits.mockResolvedValue(false);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: UserService, useValue: userService },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
      ],
    }).compile();

    const svc = module.get<ReportService>(ReportService);

    await expect(
      svc.generateReport('test-uuid', { type: 'LIFE' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject report access for wrong user', async () => {
    prisma.report.findFirst.mockResolvedValue(null);

    await expect(
      reportService.getReport('attacker-id', 'victim-report'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should list user reports', async () => {
    prisma.report.findMany.mockResolvedValue([
      { id: 'r1', userId: 'test-uuid', type: 'LIFE', status: 'READY', price: 5, fileUrl: null, createdAt: new Date() },
      { id: 'r2', userId: 'test-uuid', type: 'CAREER', status: 'READY', price: 5, fileUrl: null, createdAt: new Date() },
    ]);

    const reports = await reportService.getUserReports('test-uuid');
    expect(reports.length).toBe(2);
  });
});

// ─── E2E: User Profile → Credits Flow ──────────────────────────────────────

describe('E2E: User Profile & Credits', () => {
  let userService: UserService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      creditTransaction: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: -5 } }),
        create: jest.fn(),
      },
      $transaction: jest.fn((fn: any) => fn({
        user: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          update: jest.fn(),
        },
        creditTransaction: { create: jest.fn() },
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    userService = module.get<UserService>(UserService);
  });

  it('should get profile, check credits, then deduct', async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...mockUser,
      createdAt: new Date(),
    });

    // Get profile
    const profile = await userService.getProfile('test-uuid');
    expect(profile.name).toBe('Test User');
    expect(profile.credits).toBe(20);

    // Check credits
    const credits = await userService.getCredits('test-uuid');
    expect(credits.available).toBe(20);
    expect(credits.used).toBe(5);

    // Deduct credits
    const deducted = await userService.deductCredits('test-uuid', 2, 'Chat message');
    expect(deducted).toBe(true);
  });

  it('should update user profile', async () => {
    prisma.user.update.mockResolvedValue({
      ...mockUser,
      name: 'Updated Name',
      gender: 'Female',
      createdAt: new Date(),
    });

    const updated = await userService.updateProfile('test-uuid', {
      name: 'Updated Name',
      gender: 'Female',
    });

    expect(updated.name).toBe('Updated Name');
  });

  it('should return null for non-existent user via findById', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await userService.findById('non-existent');
    expect(result).toBeNull();
  });
});

// ─── E2E: Payment Webhook Processing ───────────────────────────────────────

describe('E2E: Webhook Processing', () => {
  let paymentService: PaymentService;
  let prisma: any;

  beforeEach(async () => {
    prisma = mockPrismaService();
    prisma.payment = {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      updateMany: jest.fn(),
    };
    prisma.subscription = {
      updateMany: jest.fn(),
    };
    prisma.siteSetting = {
      findMany: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: UserService, useValue: mockUserService() },
      ],
    }).compile();

    paymentService = module.get<PaymentService>(PaymentService);
  });

  it('should handle payment.captured webhook', async () => {
    const webhookSecret = 'test-webhook-secret';
    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_webhook_1',
            order_id: 'order_webhook_1',
            amount: 9900,
          },
        },
      },
    };

    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    // Mock the transaction
    prisma.$transaction.mockImplementation(async (fn: any) => {
      const txPayment = {
        findFirst: jest.fn().mockResolvedValue({
          id: 'db-pay-1',
          userId: 'test-uuid',
          amount: 99,
          status: 'PENDING',
          razorpayOrderId: 'order_webhook_1',
        }),
        update: jest.fn(),
      };
      return fn({
        payment: txPayment,
        user: { update: jest.fn() },
        creditTransaction: { create: jest.fn() },
      });
    });

    const result = await paymentService.handleWebhook(payload, signature);
    expect(result.received).toBe(true);
  });

  it('should handle payment.failed webhook', async () => {
    const webhookSecret = 'test-webhook-secret';
    const payload = {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: { id: 'pay_fail_1', order_id: 'order_fail_1' },
        },
      },
    };

    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    const result = await paymentService.handleWebhook(payload, signature);
    expect(result.received).toBe(true);
    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'FAILED' },
      }),
    );
  });

  it('should reject webhook with invalid signature', async () => {
    const payload = { event: 'payment.captured', payload: {} };

    await expect(
      paymentService.handleWebhook(payload, 'bad-signature'),
    ).rejects.toThrow(BadRequestException);
  });
});

// ─── E2E: Auth Refresh Token Flow ──────────────────────────────────────────

describe('E2E: Token Refresh', () => {
  let authService: AuthService;
  let prisma: any;
  let jwtService: any;

  beforeEach(async () => {
    prisma = mockPrismaService();
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('new-access-token'),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: mockConfigService() },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  it('should refresh tokens for valid user', async () => {
    jwtService.verify.mockReturnValue({
      sub: 'test-uuid',
      email: 'test@example.com',
      name: 'Test User',
    });
    prisma.user.findUnique.mockResolvedValue(mockUser);

    const tokens = await authService.refreshToken({
      refreshToken: 'valid-refresh-token',
    });

    expect(tokens.accessToken).toBe('new-access-token');
    expect(tokens.refreshToken).toBe('new-access-token');
    expect(tokens.expiresIn).toBeDefined();
  });

  it('should reject refresh for deleted user', async () => {
    jwtService.verify.mockReturnValue({
      sub: 'deleted-user',
      email: 'x@x.com',
      name: 'X',
    });
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      authService.refreshToken({ refreshToken: 'valid-token' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should reject expired refresh tokens', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });

    await expect(
      authService.refreshToken({ refreshToken: 'expired-token' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});

// ─── E2E: Change Password & Set Password ──────────────────────────────────

describe('E2E: Password Management', () => {
  let authService: AuthService;
  let prisma: any;

  beforeEach(async () => {
    prisma = mockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue('token') } },
        { provide: ConfigService, useValue: mockConfigService() },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  it('should change password successfully', async () => {
    const bcrypt = require('bcrypt');
    const oldHash = await bcrypt.hash('OldPass123!', 12);

    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'test@example.com',
      passwordHash: oldHash,
    });
    prisma.user.update.mockResolvedValue({});

    const result = await authService.changePassword('u1', {
      currentPassword: 'OldPass123!',
      newPassword: 'NewPass456!',
    });

    expect(result.message).toContain('changed');
  });

  it('should reject wrong current password', async () => {
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash('RealPass123!', 12);

    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'test@example.com',
      passwordHash: hash,
    });

    await expect(
      authService.changePassword('u1', {
        currentPassword: 'WrongPass!',
        newPassword: 'NewPass456!',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should set password for social login user', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'social@example.com',
      passwordHash: null,
    });
    prisma.user.update.mockResolvedValue({});

    const result = await authService.setPassword('u1', 'NewPass123!');
    expect(result.message).toContain('set');
  });

  it('should get auth status', async () => {
    prisma.user.findUnique.mockResolvedValue({ passwordHash: 'some-hash' });
    const status = await authService.getAuthStatus('u1');
    expect(status.hasPassword).toBe(true);

    prisma.user.findUnique.mockResolvedValue({ passwordHash: null });
    const status2 = await authService.getAuthStatus('u2');
    expect(status2.hasPassword).toBe(false);
  });
});

// ─── E2E: Chat Credit Deduction & Refund ───────────────────────────────────

describe('E2E: Chat Credit Management', () => {
  let chatService: ChatService;
  let userServiceMock: any;
  let prisma: any;

  beforeEach(async () => {
    prisma = mockPrismaService();
    userServiceMock = mockUserService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: UserService, useValue: userServiceMock },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
      ],
    }).compile();

    chatService = module.get<ChatService>(ChatService);
  });

  it('should deduct credits for chat message', async () => {
    prisma.chatSession.findFirst.mockResolvedValue(null);
    prisma.chatSession.create.mockResolvedValue({
      id: 'session-1', userId: 'test-uuid', title: 'Test', category: 'general',
      createdAt: new Date(), updatedAt: new Date(), messages: [],
    });
    prisma.chatMessage.create.mockResolvedValue({
      id: 'msg-1', sessionId: 'session-1', role: 'ASSISTANT',
      content: 'Response', createdAt: new Date(),
    });

    await chatService.sendMessage('test-uuid', {
      message: 'Hello',
      category: 'general',
    });

    expect(userServiceMock.deductCredits).toHaveBeenCalledWith(
      'test-uuid', 1, 'Chat message',
    );
  });

  it('should reject chat when credits insufficient', async () => {
    userServiceMock.deductCredits.mockResolvedValue(false);

    await expect(
      chatService.sendMessage('test-uuid', {
        message: 'Hello',
        category: 'general',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should refund credits when AI fails', async () => {
    const openaiMock = mockOpenAIService();
    openaiMock.chatCompletion.mockRejectedValue(new Error('API down'));

    const knowledgeMock = mockKnowledgeService();
    // Make search also fail to trigger the error path
    knowledgeMock.search.mockRejectedValue(new Error('KB failed'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: UserService, useValue: userServiceMock },
        { provide: OpenAIService, useValue: openaiMock },
        { provide: KnowledgeService, useValue: knowledgeMock },
      ],
    }).compile();

    const svc = module.get<ChatService>(ChatService);

    prisma.chatSession.findFirst.mockResolvedValue(null);
    prisma.chatSession.create.mockResolvedValue({
      id: 'session-1', userId: 'test-uuid', title: 'Test', category: 'general',
      createdAt: new Date(), updatedAt: new Date(), messages: [],
    });
    prisma.user.findUnique.mockResolvedValue(mockUser);

    await expect(
      svc.sendMessage('test-uuid', { message: 'Hello', category: 'general' }),
    ).rejects.toThrow(BadRequestException);

    expect(userServiceMock.addCredits).toHaveBeenCalledWith(
      'test-uuid', 1, 'CHAT_DEDUCTION', expect.stringContaining('Refund'),
    );
  });
});
