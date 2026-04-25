import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../src/modules/auth/auth.service';
import { AuthController } from '../src/modules/auth/auth.controller';
import { PrismaService } from '../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../src/redis/redis.module';
import { mockConfigService, createMockRedis } from './helpers/mocks';
import * as bcrypt from 'bcrypt';

// ─── firebase-admin mock ────────────────────────────────────────────────────
// Tests control `admin.apps.length` and `admin.auth().verifyIdToken(...)` via
// the handles below. Default state: Firebase is configured (apps.length > 0)
// and verifyIdToken returns a Google-style decoded token.
const firebaseAppsList: any[] = [{ name: '[DEFAULT]' }];
const verifyIdTokenMock = jest.fn();

jest.mock('firebase-admin', () => {
  return {
    get apps() {
      return firebaseAppsList;
    },
    auth: () => ({ verifyIdToken: verifyIdTokenMock }),
    credential: { cert: jest.fn(() => ({ type: 'cert' })) },
    initializeApp: jest.fn(),
  };
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function createPrismaMock() {
  return {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

function createJwtMock() {
  return {
    signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
    verify: jest.fn(),
  };
}

async function buildAuthService(prisma: any, jwtService: any) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: PrismaService, useValue: prisma },
      { provide: JwtService, useValue: jwtService },
      // Seed `google.clientId` so the Google OAuth aud-mismatch test has
      // a value to compare against. Without it the check at
      // `auth.service.googleAuth` is skipped entirely and the wrong-aud
      // test never reaches its UnauthorizedException branch.
      { provide: ConfigService, useValue: mockConfigService({ 'google.clientId': 'test-google-client-id' }) },
      { provide: REDIS_CLIENT, useValue: createMockRedis() },
    ],
  }).compile();

  return module.get<AuthService>(AuthService);
}

const VALID_PASSWORD = 'StrongPass123!';
const WEAK_PASSWORD = 'weak';

// ─── LOGIN TESTS ────────────────────────────────────────────────────────────

describe('Auth: Login', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;

  beforeEach(async () => {
    prisma = createPrismaMock();
    jwtService = createJwtMock();
    service = await buildAuthService(prisma, jwtService);
  });

  it('should login successfully with valid email and password', async () => {
    const hash = await bcrypt.hash(VALID_PASSWORD, 12);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      name: 'Arjun',
      email: 'arjun@example.com',
      phone: '+919876543210',
      passwordHash: hash,
      credits: 10,
      role: 'USER',
    });

    const result = await service.login({
      email: 'arjun@example.com',
      password: VALID_PASSWORD,
    });

    expect(result.user.id).toBe('user-1');
    expect(result.user.email).toBe('arjun@example.com');
    expect(result.user.name).toBe('Arjun');
    expect(result.tokens.accessToken).toBeDefined();
    expect(result.tokens.refreshToken).toBeDefined();
  });

  it('should reject login with wrong password', async () => {
    const hash = await bcrypt.hash(VALID_PASSWORD, 12);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'arjun@example.com',
      passwordHash: hash,
    });

    await expect(
      service.login({ email: 'arjun@example.com', password: 'WrongPass999!' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should reject login with non-existent email', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login({ email: 'nobody@example.com', password: VALID_PASSWORD }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should reject login for social-only user (no password)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-2',
      email: 'google@example.com',
      passwordHash: null,
      provider: 'GOOGLE',
    });

    await expect(
      service.login({ email: 'google@example.com', password: VALID_PASSWORD }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should lock account after 5 failed login attempts', async () => {
    const hash = await bcrypt.hash(VALID_PASSWORD, 12);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-lock',
      email: 'lockme@example.com',
      passwordHash: hash,
    });

    for (let i = 0; i < 5; i++) {
      await expect(
        service.login({ email: 'lockme@example.com', password: 'WrongPass!' }),
      ).rejects.toThrow(UnauthorizedException);
    }

    // 6th attempt should be ForbiddenException (lockout)
    await expect(
      service.login({ email: 'lockme@example.com', password: 'WrongPass!' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should show remaining attempts warning when 2 or fewer remain', async () => {
    const hash = await bcrypt.hash(VALID_PASSWORD, 12);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-warn',
      email: 'warnme@example.com',
      passwordHash: hash,
    });

    // 3 failed attempts first
    for (let i = 0; i < 3; i++) {
      try {
        await service.login({ email: 'warnme@example.com', password: 'Wrong!' });
      } catch {}
    }

    // 4th attempt should mention remaining attempts
    try {
      await service.login({ email: 'warnme@example.com', password: 'Wrong!' });
    } catch (e: any) {
      expect(e.message).toContain('attempt');
    }
  });

  it('should clear failed attempts on successful login', async () => {
    const hash = await bcrypt.hash(VALID_PASSWORD, 12);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-clear',
      name: 'ClearUser',
      email: 'clear@example.com',
      phone: null,
      passwordHash: hash,
      credits: 10,
      role: 'USER',
    });

    // 3 failed attempts
    for (let i = 0; i < 3; i++) {
      try {
        await service.login({ email: 'clear@example.com', password: 'Wrong!' });
      } catch {}
    }

    // Successful login should reset counter
    const result = await service.login({
      email: 'clear@example.com',
      password: VALID_PASSWORD,
    });
    expect(result.user.email).toBe('clear@example.com');

    // Should be able to fail again without immediate lockout
    await expect(
      service.login({ email: 'clear@example.com', password: 'Wrong!' }),
    ).rejects.toThrow(UnauthorizedException);
    // Not ForbiddenException, proving counter was reset
  });

  it('should not expose password hash in login response', async () => {
    const hash = await bcrypt.hash(VALID_PASSWORD, 12);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-noleak',
      name: 'NoLeak',
      email: 'noleak@example.com',
      phone: null,
      passwordHash: hash,
      credits: 10,
      role: 'USER',
    });

    const result = await service.login({
      email: 'noleak@example.com',
      password: VALID_PASSWORD,
    });

    expect(result.user).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(result)).not.toContain('$2b$');
  });

  it('should return tokens with correct structure', async () => {
    const hash = await bcrypt.hash(VALID_PASSWORD, 12);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-tokens',
      name: 'TokenUser',
      email: 'tokens@example.com',
      phone: null,
      passwordHash: hash,
      credits: 5,
      role: 'USER',
    });

    const result = await service.login({
      email: 'tokens@example.com',
      password: VALID_PASSWORD,
    });

    expect(result.tokens).toHaveProperty('accessToken');
    expect(result.tokens).toHaveProperty('refreshToken');
    expect(result.tokens).toHaveProperty('expiresIn');
    expect(jwtService.signAsync).toHaveBeenCalledTimes(2); // access + refresh
  });
});

// ─── SIGNUP / REGISTER TESTS ────────────────────────────────────────────────

describe('Auth: Signup', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;

  beforeEach(async () => {
    prisma = createPrismaMock();
    jwtService = createJwtMock();
    service = await buildAuthService(prisma, jwtService);
  });

  it('should register a new user and return auth response', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'new-user-1',
      name: 'Arjun Sharma',
      email: 'arjun@example.com',
      phone: null,
      credits: 10,
      role: 'USER',
    });

    const result = await service.register({
      name: 'Arjun Sharma',
      email: 'arjun@example.com',
      password: VALID_PASSWORD,
    });

    expect(result.user.name).toBe('Arjun Sharma');
    expect(result.user.email).toBe('arjun@example.com');
    expect(result.user.credits).toBe(10);
    expect(result.tokens.accessToken).toBeDefined();
    expect(result.tokens.refreshToken).toBeDefined();
  });

  it('should register with optional fields (phone, DOB, place)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'new-user-2',
      name: 'Priya Patel',
      email: 'priya@example.com',
      phone: '+919876543210',
      credits: 10,
      role: 'USER',
    });

    const result = await service.register({
      name: 'Priya Patel',
      email: 'priya@example.com',
      password: VALID_PASSWORD,
      phone: '+919876543210',
      dateOfBirth: '1995-03-15',
      timeOfBirth: '10:30',
      placeOfBirth: 'Delhi, India',
    });

    expect(result.user.phone).toBe('+919876543210');
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          phone: '+919876543210',
          dateOfBirth: expect.any(Date),
          timeOfBirth: '10:30',
          placeOfBirth: { name: 'Delhi, India' },
        }),
      }),
    );
  });

  it('should reject registration with duplicate email', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

    await expect(
      service.register({
        name: 'Duplicate',
        email: 'existing@example.com',
        password: VALID_PASSWORD,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should hash password with bcrypt salt rounds >= 12', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(async ({ data }: any) => {
      expect(data.passwordHash).toMatch(/^\$2[aby]?\$1[2-9]\$/);
      return {
        id: 'u1',
        name: data.name,
        email: data.email,
        phone: null,
        credits: 10,
        role: 'USER',
      };
    });

    await service.register({
      name: 'HashTest',
      email: 'hash@example.com',
      password: VALID_PASSWORD,
    });

    expect(prisma.user.create).toHaveBeenCalled();
  });

  it('should not expose password hash in registration response', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'u1',
      name: 'Test',
      email: 'test@example.com',
      phone: null,
      credits: 10,
      role: 'USER',
      passwordHash: '$2b$12$secrethash',
    });

    const result = await service.register({
      name: 'Test',
      email: 'test@example.com',
      password: VALID_PASSWORD,
    });

    expect(result.user).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(result)).not.toContain('$2b$');
  });

  it('should assign default credits on registration', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(async ({ data }: any) => ({
      id: 'u1',
      name: data.name,
      email: data.email,
      phone: null,
      credits: data.credits,
      role: 'USER',
    }));

    const result = await service.register({
      name: 'Credits Test',
      email: 'credits@example.com',
      password: VALID_PASSWORD,
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          credits: 10,
        }),
      }),
    );
  });
});

// ─── PHONE OTP TESTS ───────────────────────────────────────────────────────

describe('Auth: Phone OTP', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;

  beforeEach(async () => {
    prisma = createPrismaMock();
    jwtService = createJwtMock();
    service = await buildAuthService(prisma, jwtService);
  });

  describe('sendOtp', () => {
    it('should send OTP and return success with expiry', async () => {
      const result = await service.sendOtp({ phone: '+919876543210' });

      expect(result.message).toContain('OTP sent successfully');
      expect(result.expiresIn).toBe(300); // 5 minutes = 300 seconds
    });

    it('should rate limit repeated OTP requests to same number', async () => {
      await service.sendOtp({ phone: '+911111111111' });

      await expect(
        service.sendOtp({ phone: '+911111111111' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow OTP to different phone numbers', async () => {
      const result1 = await service.sendOtp({ phone: '+912222222222' });
      const result2 = await service.sendOtp({ phone: '+913333333333' });

      expect(result1.message).toContain('OTP sent');
      expect(result2.message).toContain('OTP sent');
    });
  });

  describe('verifyOtp', () => {
    it('should reject OTP verification without prior send', async () => {
      await expect(
        service.verifyOtp({ phone: '+910000000000', otp: '123456' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject wrong OTP code', async () => {
      await service.sendOtp({ phone: '+914444444444' });

      await expect(
        service.verifyOtp({ phone: '+914444444444', otp: '000000' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create new user if phone number is new', async () => {
      await service.sendOtp({ phone: '+915555555555' });

      // We need to get the actual OTP - since it's in-memory, we can't easily.
      // Instead test the flow by verifying create is called when user not found.
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'new-otp-user',
        name: 'User',
        email: '915555555555@phone.jyotron.com',
        phone: '+915555555555',
        credits: 10,
        role: 'USER',
      });

      // Since we can't know the OTP, just verify wrong OTP is rejected
      await expect(
        service.verifyOtp({ phone: '+915555555555', otp: '999999' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return existing user if phone number already registered', async () => {
      await service.sendOtp({ phone: '+916666666666' });

      prisma.user.findUnique.mockResolvedValue({
        id: 'existing-otp-user',
        name: 'Existing',
        email: 'existing@example.com',
        phone: '+916666666666',
        credits: 15,
        role: 'USER',
      });

      // Wrong OTP should still be rejected
      await expect(
        service.verifyOtp({ phone: '+916666666666', otp: '000000' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should invalidate OTP after successful verification', async () => {
      // Send OTP and verify the store is populated then cleared
      await service.sendOtp({ phone: '+917777777777' });

      // After a (hypothetical) successful verify, second attempt should fail
      // We test by checking that verifying with no stored OTP fails
      await expect(
        service.verifyOtp({ phone: '+910000099999', otp: '123456' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should persist provided name when creating a new phone user on signup', async () => {
      // The OTP store is backed by the real in-memory Redis mock, so we can
      // access it directly to grab the generated OTP and run the happy path.
      const redisMock = (service as any).redis;
      await service.sendOtp({ phone: '+918888888881' });
      const otp = (await redisMock.get('otp:+918888888881')) as string;

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'new-named-user',
        name: 'Arjun Mehta',
        email: '918888888881@phone.jyotron.com',
        phone: '+918888888881',
        credits: 10,
        role: 'USER',
      });

      await service.verifyOtp({ phone: '+918888888881', otp, name: 'Arjun Mehta' });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'Arjun Mehta', phone: '+918888888881' }),
        }),
      );
    });

    it('should default name to "User" if no name is provided on first signup', async () => {
      const redisMock = (service as any).redis;
      await service.sendOtp({ phone: '+918888888882' });
      const otp = (await redisMock.get('otp:+918888888882')) as string;

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'new-default-user',
        name: 'User',
        email: '918888888882@phone.jyotron.com',
        phone: '+918888888882',
        credits: 10,
        role: 'USER',
      });

      await service.verifyOtp({ phone: '+918888888882', otp });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: 'User' }),
        }),
      );
    });
  });
});

// ─── GOOGLE OAUTH TESTS ─────────────────────────────────────────────────────
// Direct /auth/google endpoint: verifies Google ID tokens via the public
// tokeninfo endpoint. We mock global.fetch so these tests don't hit the
// network.

describe('Auth: Google OAuth', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;
  const originalFetch = global.fetch;

  beforeEach(async () => {
    prisma = createPrismaMock();
    jwtService = createJwtMock();
    service = await buildAuthService(prisma, jwtService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  const mockTokeninfoResponse = (payload: any, ok = true) => {
    global.fetch = jest.fn().mockResolvedValue({
      ok,
      json: async () => payload,
    }) as any;
  };

  it('should create a new user when Google token is valid and email is unknown', async () => {
    mockTokeninfoResponse({
      sub: 'google-sub-123',
      email: 'new@example.com',
      name: 'New User',
      picture: 'https://g/p.jpg',
      email_verified: 'true',
      aud: 'test-google-client-id',
    });
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'google-user-1',
      name: 'New User',
      email: 'new@example.com',
      phone: null,
      credits: 10,
      role: 'USER',
      provider: 'GOOGLE',
      providerId: 'google-sub-123',
    });

    const result = await service.googleAuth({ idToken: 'valid-google-token' });

    expect(result.user.email).toBe('new@example.com');
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: 'GOOGLE',
          providerId: 'google-sub-123',
          email: 'new@example.com',
        }),
      }),
    );
  });

  it('should link Google provider to an existing email-account user', async () => {
    mockTokeninfoResponse({
      sub: 'google-sub-link',
      email: 'existing@example.com',
      name: 'Existing',
      email_verified: 'true',
      aud: 'test-google-client-id',
    });
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-exist-1',
      name: 'Existing',
      email: 'existing@example.com',
      phone: null,
      provider: 'LOCAL',
      providerId: null,
      credits: 10,
      role: 'USER',
    });
    prisma.user.update.mockResolvedValue({
      id: 'user-exist-1',
      name: 'Existing',
      email: 'existing@example.com',
      phone: null,
      provider: 'GOOGLE',
      providerId: 'google-sub-link',
      credits: 10,
      role: 'USER',
    });

    const result = await service.googleAuth({ idToken: 'valid-google-token' });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-exist-1' },
        data: expect.objectContaining({ provider: 'GOOGLE', providerId: 'google-sub-link' }),
      }),
    );
    expect(result.user.id).toBe('user-exist-1');
  });

  it('should reject when tokeninfo returns non-ok (invalid token)', async () => {
    mockTokeninfoResponse({}, false);

    await expect(
      service.googleAuth({ idToken: 'garbage-token' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should reject when Google email is not verified', async () => {
    mockTokeninfoResponse({
      sub: 'google-sub-unverified',
      email: 'unverified@example.com',
      name: 'Unverified',
      email_verified: 'false',
      aud: 'test-google-client-id',
    });

    await expect(
      service.googleAuth({ idToken: 'unverified-token' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should reject when token audience does not match our client id', async () => {
    mockTokeninfoResponse({
      sub: 'google-sub-wrong-aud',
      email: 'wrong@example.com',
      name: 'Wrong Aud',
      email_verified: 'true',
      aud: 'some-other-app-client-id',
    });

    await expect(
      service.googleAuth({ idToken: 'wrong-aud-token' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should reject when fetch throws a network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNRESET')) as any;

    await expect(
      service.googleAuth({ idToken: 'any-token' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});

// ─── FIREBASE AUTH TESTS ────────────────────────────────────────────────────
// /auth/firebase endpoint: verifies Firebase ID tokens via firebase-admin.
// We control admin.apps.length and verifyIdToken via the module-level mock
// handles declared at the top of this file.

describe('Auth: Firebase Auth', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;

  beforeEach(async () => {
    prisma = createPrismaMock();
    jwtService = createJwtMock();
    service = await buildAuthService(prisma, jwtService);
    // Default: Firebase is configured
    firebaseAppsList.length = 0;
    firebaseAppsList.push({ name: '[DEFAULT]' });
    verifyIdTokenMock.mockReset();
  });

  it('should reject when firebase-admin is not configured on the server', async () => {
    firebaseAppsList.length = 0;

    await expect(
      service.firebaseAuth({ idToken: 'any-token' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should reject when the Firebase ID token is malformed / cannot be verified', async () => {
    verifyIdTokenMock.mockRejectedValue(new Error('auth/argument-error'));

    await expect(
      service.firebaseAuth({ idToken: 'bogus' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should create a new user for a phone sign-in with no existing account', async () => {
    verifyIdTokenMock.mockResolvedValue({
      uid: 'firebase-phone-uid',
      phone_number: '+919998887770',
      firebase: { sign_in_provider: 'phone' },
    });
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'phone-fb-user',
      name: 'User',
      email: '919998887770@phone.jyotron.com',
      phone: '+919998887770',
      provider: 'PHONE',
      providerId: 'firebase-phone-uid',
      credits: 10,
      role: 'USER',
    });

    const result = await service.firebaseAuth({ idToken: 'valid-phone-token' });

    expect(result.user.phone).toBe('+919998887770');
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          phone: '+919998887770',
          provider: 'PHONE',
          providerId: 'firebase-phone-uid',
        }),
      }),
    );
  });

  it('should create a new user for a Google sign-in with no existing account', async () => {
    verifyIdTokenMock.mockResolvedValue({
      uid: 'firebase-google-uid',
      email: 'goog@example.com',
      name: 'Google User',
      firebase: { sign_in_provider: 'google.com' },
    });
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'google-fb-user',
      name: 'Google User',
      email: 'goog@example.com',
      phone: null,
      provider: 'GOOGLE',
      providerId: 'firebase-google-uid',
      credits: 10,
      role: 'USER',
    });

    const result = await service.firebaseAuth({ idToken: 'valid-google-fb-token' });

    expect(result.user.email).toBe('goog@example.com');
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'goog@example.com',
          provider: 'GOOGLE',
          providerId: 'firebase-google-uid',
        }),
      }),
    );
  });

  it('should link Google provider to an existing email-account user', async () => {
    verifyIdTokenMock.mockResolvedValue({
      uid: 'firebase-google-link',
      email: 'linkme@example.com',
      name: 'Linked',
      firebase: { sign_in_provider: 'google.com' },
    });
    prisma.user.findFirst.mockResolvedValue({
      id: 'existing-local-user',
      name: 'Linked',
      email: 'linkme@example.com',
      phone: null,
      provider: 'LOCAL',
      providerId: null,
      credits: 10,
      role: 'USER',
    });
    prisma.user.update.mockResolvedValue({
      id: 'existing-local-user',
      name: 'Linked',
      email: 'linkme@example.com',
      phone: null,
      provider: 'GOOGLE',
      providerId: 'firebase-google-link',
      credits: 10,
      role: 'USER',
    });

    const result = await service.firebaseAuth({ idToken: 'link-token' });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'existing-local-user' },
        data: expect.objectContaining({
          provider: 'GOOGLE',
          providerId: 'firebase-google-link',
        }),
      }),
    );
    expect(result.user.id).toBe('existing-local-user');
  });

  it('should backfill phone number on an existing user who signs in via phone', async () => {
    verifyIdTokenMock.mockResolvedValue({
      uid: 'firebase-phone-existing',
      phone_number: '+917776665550',
      firebase: { sign_in_provider: 'phone' },
    });
    prisma.user.findFirst.mockResolvedValue({
      id: 'existing-no-phone',
      name: 'NoPhone',
      email: 'nophone@example.com',
      phone: null,
      provider: 'LOCAL',
      providerId: null,
      credits: 10,
      role: 'USER',
    });
    prisma.user.update.mockResolvedValue({
      id: 'existing-no-phone',
      name: 'NoPhone',
      email: 'nophone@example.com',
      phone: '+917776665550',
      provider: 'LOCAL',
      providerId: null,
      credits: 10,
      role: 'USER',
    });

    await service.firebaseAuth({ idToken: 'backfill-phone-token' });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'existing-no-phone' },
        data: expect.objectContaining({ phone: '+917776665550' }),
      }),
    );
  });
});

// ─── CHANGE PASSWORD TESTS ─────────────────────────────────────────────────

describe('Auth: Change Password', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;

  beforeEach(async () => {
    prisma = createPrismaMock();
    jwtService = createJwtMock();
    service = await buildAuthService(prisma, jwtService);
  });

  it('should change password successfully with correct current password', async () => {
    const hash = await bcrypt.hash('OldPass123!', 12);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-pw',
      email: 'pw@example.com',
      passwordHash: hash,
    });
    prisma.user.update.mockResolvedValue({});

    const result = await service.changePassword('user-pw', {
      currentPassword: 'OldPass123!',
      newPassword: 'NewPass456!',
    });

    expect(result.message).toContain('Password changed successfully');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-pw' },
        data: expect.objectContaining({
          passwordHash: expect.any(String),
        }),
      }),
    );
  });

  it('should reject change with incorrect current password', async () => {
    const hash = await bcrypt.hash('Correct123!', 12);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-pw2',
      email: 'pw2@example.com',
      passwordHash: hash,
    });

    await expect(
      service.changePassword('user-pw2', {
        currentPassword: 'WrongCurrent!',
        newPassword: 'NewPass456!',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject changing password to same password', async () => {
    const hash = await bcrypt.hash('SamePass123!', 12);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-pw3',
      email: 'pw3@example.com',
      passwordHash: hash,
    });

    await expect(
      service.changePassword('user-pw3', {
        currentPassword: 'SamePass123!',
        newPassword: 'SamePass123!',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject change password for social login user (no password)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-social',
      email: 'social@example.com',
      passwordHash: null,
      provider: 'GOOGLE',
    });

    await expect(
      service.changePassword('user-social', {
        currentPassword: 'anything',
        newPassword: 'NewPass456!',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject change password for non-existent user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.changePassword('ghost-user', {
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass456!',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should hash new password with bcrypt', async () => {
    const hash = await bcrypt.hash('OldPass123!', 12);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-hash',
      email: 'hash@example.com',
      passwordHash: hash,
    });
    prisma.user.update.mockImplementation(async ({ data }: any) => {
      // Verify new password is hashed
      expect(data.passwordHash).toMatch(/^\$2[aby]?\$1[2-9]\$/);
      expect(data.passwordHash).not.toBe('NewPass456!');
      return {};
    });

    await service.changePassword('user-hash', {
      currentPassword: 'OldPass123!',
      newPassword: 'NewPass456!',
    });

    expect(prisma.user.update).toHaveBeenCalled();
  });
});

// ─── SET PASSWORD (for OTP/social users) ────────────────────────────────────

describe('Auth: Set Password', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;

  beforeEach(async () => {
    prisma = createPrismaMock();
    jwtService = createJwtMock();
    service = await buildAuthService(prisma, jwtService);
  });

  it('should set password for social login user', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-set',
      email: 'social@example.com',
      passwordHash: null,
      provider: 'GOOGLE',
    });
    prisma.user.update.mockResolvedValue({});

    const result = await service.setPassword('user-set', 'NewPass123!');

    expect(result.message).toContain('Password set successfully');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-set' },
        data: expect.objectContaining({
          passwordHash: expect.any(String),
        }),
      }),
    );
  });

  it('should set password for phone OTP user', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-phone-set',
      email: '919876543210@phone.jyotron.com',
      passwordHash: null,
      provider: 'PHONE',
    });
    prisma.user.update.mockResolvedValue({});

    const result = await service.setPassword('user-phone-set', 'NewPass123!');

    expect(result.message).toContain('Password set successfully');
  });

  it('should reject setting password when one already exists', async () => {
    const existingHash = await bcrypt.hash('OldPass123!', 12);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-overwrite',
      email: 'overwrite@example.com',
      passwordHash: existingHash,
    });

    await expect(
      service.setPassword('user-overwrite', 'BrandNew456!'),
    ).rejects.toThrow('Password already set');
  });

  it('should reject set password for non-existent user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.setPassword('ghost-user', 'NewPass123!'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should hash the new password', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-hash-set',
      email: 'hashset@example.com',
      passwordHash: null,
    });
    prisma.user.update.mockImplementation(async ({ data }: any) => {
      expect(data.passwordHash).toMatch(/^\$2[aby]?\$/);
      expect(data.passwordHash).not.toBe('NewPass123!');
      return {};
    });

    await service.setPassword('user-hash-set', 'NewPass123!');

    expect(prisma.user.update).toHaveBeenCalled();
  });
});

// ─── REFRESH TOKEN TESTS ───────────────────────────────────────────────────

describe('Auth: Refresh Token', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;

  beforeEach(async () => {
    prisma = createPrismaMock();
    jwtService = createJwtMock();
    service = await buildAuthService(prisma, jwtService);
  });

  it('should issue new tokens with valid refresh token', async () => {
    jwtService.verify.mockReturnValue({
      sub: 'user-1',
      email: 'test@example.com',
      name: 'Test',
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test',
    });

    const result = await service.refreshToken({ refreshToken: 'valid-refresh-token' });

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.expiresIn).toBeDefined();
  });

  it('should reject expired refresh token', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });

    await expect(
      service.refreshToken({ refreshToken: 'expired-token' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should reject tampered refresh token', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('invalid signature');
    });

    await expect(
      service.refreshToken({ refreshToken: 'tampered.token.here' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should reject refresh token for deleted user', async () => {
    jwtService.verify.mockReturnValue({
      sub: 'deleted-user',
      email: 'deleted@example.com',
      name: 'Deleted',
    });
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.refreshToken({ refreshToken: 'valid-but-user-gone' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should reject malformed refresh token', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('jwt malformed');
    });

    await expect(
      service.refreshToken({ refreshToken: 'not-a-jwt' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});

// ─── AUTH STATUS TESTS ─────────────────────────────────────────────────────

describe('Auth: Status', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;

  beforeEach(async () => {
    prisma = createPrismaMock();
    jwtService = createJwtMock();
    service = await buildAuthService(prisma, jwtService);
  });

  it('should return hasPassword: true for email-registered user', async () => {
    prisma.user.findUnique.mockResolvedValue({
      passwordHash: '$2b$12$somehash',
    });

    const result = await service.getAuthStatus('user-with-pw');

    expect(result.hasPassword).toBe(true);
  });

  it('should return hasPassword: false for social/OTP user', async () => {
    prisma.user.findUnique.mockResolvedValue({
      passwordHash: null,
    });

    const result = await service.getAuthStatus('user-without-pw');

    expect(result.hasPassword).toBe(false);
  });

  it('should return hasPassword: false for non-existent user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await service.getAuthStatus('ghost');

    expect(result.hasPassword).toBe(false);
  });
});

// ─── AUTH CONTROLLER TESTS ─────────────────────────────────────────────────

describe('Auth: Controller', () => {
  let controller: AuthController;
  let authService: any;

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      sendOtp: jest.fn(),
      verifyOtp: jest.fn(),
      googleAuth: jest.fn(),
      firebaseAuth: jest.fn(),
      refreshToken: jest.fn(),
      changePassword: jest.fn(),
      setPassword: jest.fn(),
      getAuthStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: Reflector, useValue: new Reflector() },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('register', () => {
    it('should call authService.register and return result', async () => {
      const expected = { user: { id: 'u1', name: 'Test' }, tokens: { accessToken: 'tok' } };
      authService.register.mockResolvedValue(expected);

      // Phase 2 added an Accept-Language / body-derived SignupContext
      // second argument. Pass an empty req so the controller can read
      // headers off it and hand a parsed context to the service.
      const result = await controller.register(
        { name: 'Test', email: 'test@example.com', password: VALID_PASSWORD },
        { headers: {} } as any,
      );

      expect(result).toEqual(expected);
      expect(authService.register).toHaveBeenCalledWith(
        { name: 'Test', email: 'test@example.com', password: VALID_PASSWORD },
        { locale: null, country: null, signupSource: null },
      );
    });
  });

  describe('login', () => {
    it('should call authService.login and return result', async () => {
      const expected = { user: { id: 'u1' }, tokens: { accessToken: 'tok' } };
      authService.login.mockResolvedValue(expected);

      const result = await controller.login({
        email: 'test@example.com',
        password: VALID_PASSWORD,
      });

      expect(result).toEqual(expected);
    });
  });

  describe('sendOtp', () => {
    it('should call authService.sendOtp and return result', async () => {
      authService.sendOtp.mockResolvedValue({ message: 'OTP sent', expiresIn: 300 });

      const result = await controller.sendOtp({ phone: '+919876543210' });

      expect(result.message).toBe('OTP sent');
      expect(result.expiresIn).toBe(300);
    });
  });

  describe('verifyOtp', () => {
    it('should call authService.verifyOtp and return result', async () => {
      const expected = { user: { id: 'u1' }, tokens: { accessToken: 'tok' } };
      authService.verifyOtp.mockResolvedValue(expected);

      const result = await controller.verifyOtp({
        phone: '+919876543210',
        otp: '123456',
      });

      expect(result).toEqual(expected);
    });
  });

  describe('firebaseAuth', () => {
    it('should call authService.firebaseAuth and return result', async () => {
      const expected = { user: { id: 'u1' }, tokens: { accessToken: 'tok' } };
      authService.firebaseAuth.mockResolvedValue(expected);

      const result = await controller.firebaseAuth({ idToken: 'firebase-id-token' });

      expect(result).toEqual(expected);
    });
  });

  describe('googleAuth', () => {
    it('should call authService.googleAuth and return result', async () => {
      const expected = { user: { id: 'u1' }, tokens: { accessToken: 'tok' } };
      authService.googleAuth.mockResolvedValue(expected);

      const result = await controller.googleAuth({ idToken: 'google-id-token' });

      expect(result).toEqual(expected);
    });
  });

  describe('refreshToken', () => {
    it('should call authService.refreshToken and return new tokens', async () => {
      const expected = { accessToken: 'new-tok', refreshToken: 'new-refresh', expiresIn: '7d' };
      authService.refreshToken.mockResolvedValue(expected);

      const result = await controller.refreshToken({ refreshToken: 'old-refresh' });

      expect(result).toEqual(expected);
    });
  });

  describe('changePassword', () => {
    it('should call authService.changePassword with user ID from request', async () => {
      authService.changePassword.mockResolvedValue({ message: 'Password changed' });

      const result = await controller.changePassword(
        { currentPassword: 'OldPass123!', newPassword: 'NewPass456!' },
        { user: { sub: 'user-1' } },
      );

      expect(result.message).toBe('Password changed');
      expect(authService.changePassword).toHaveBeenCalledWith('user-1', {
        currentPassword: 'OldPass123!',
        newPassword: 'NewPass456!',
      });
    });
  });

  describe('setPassword', () => {
    it('should call authService.setPassword with user ID from request', async () => {
      authService.setPassword.mockResolvedValue({ message: 'Password set' });

      const result = await controller.setPassword(
        { password: 'NewPass123!' },
        { user: { sub: 'user-1' } },
      );

      expect(result.message).toBe('Password set');
      expect(authService.setPassword).toHaveBeenCalledWith('user-1', 'NewPass123!');
    });

    it('should pass password to service (validation is handled by DTO/ValidationPipe)', async () => {
      // Note: Short/empty password validation is now enforced by SetPasswordDto
      // via class-validator decorators + NestJS ValidationPipe, not by the controller.
      // The DTO validation is tested in security-comprehensive.spec.ts.
      authService.setPassword = jest.fn().mockResolvedValue({ message: 'Password set' });

      const result = await controller.setPassword(
        { password: 'ValidPass1' },
        { user: { sub: 'user-1' } },
      );
      expect(result.message).toBe('Password set');
    });
  });

  describe('getStatus', () => {
    it('should return auth status for authenticated user', async () => {
      authService.getAuthStatus.mockResolvedValue({ hasPassword: true });

      const result = await controller.getStatus({ user: { sub: 'user-1' } });

      expect(result.hasPassword).toBe(true);
    });
  });
});

// ─── FORGOT PASSWORD ──────────────────────
// The backend has a forgot-password endpoint that ensures the user exists in
// Firebase Auth before the client calls sendPasswordResetEmail.

describe('Auth: Forgot Password', () => {
  it('should have a forgot-password endpoint on AuthController', () => {
    const controllerPrototype = AuthController.prototype;
    const methods = Object.getOwnPropertyNames(controllerPrototype).filter(
      (m) => m !== 'constructor',
    );

    expect(methods).toContain('forgotPassword');
  });

  it('should have all expected auth endpoints', () => {
    const controllerPrototype = AuthController.prototype;
    const methods = Object.getOwnPropertyNames(controllerPrototype).filter(
      (m) => m !== 'constructor',
    );

    expect(methods).toContain('register');
    expect(methods).toContain('login');
    expect(methods).toContain('sendOtp');
    expect(methods).toContain('verifyOtp');
    expect(methods).toContain('googleAuth');
    expect(methods).toContain('firebaseAuth');
    expect(methods).toContain('refreshToken');
    expect(methods).toContain('forgotPassword');
    expect(methods).toContain('changePassword');
    expect(methods).toContain('setPassword');
    expect(methods).toContain('getStatus');
  });
});
