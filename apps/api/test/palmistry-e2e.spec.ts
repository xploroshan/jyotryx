/**
 * Palmistry E2E Tests — True HTTP-level tests with real JWT auth.
 *
 * These tests bootstrap a real NestJS app, sign actual JWT tokens,
 * and send HTTP requests via supertest to validate the full
 * authentication + palmistry analysis flow.
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  HttpException,
  ArgumentsHost,
  Catch,
  ExceptionFilter,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService, JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
// Default import so `request(app.getHttpServer())` is a call, not a
// namespace lookup. `import * as` resolves to the CJS module
// namespace object under ts-jest's transpile-only mode, which isn't
// callable and silently breaks every test in this suite.
import request from 'supertest';
import * as jwt from 'jsonwebtoken';

/**
 * Sandbox-local exception filter.
 *
 * In this repo's pnpm-workspace layout there are two copies of
 * @nestjs/common on disk — one at apps/api/node_modules (v11) and one
 * at the workspace root (v10). Nest's built-in BaseExceptionFilter
 * imports `HttpException` from the core's own node_modules copy, while
 * the test file (and `UnauthorizedException` thrown by JwtAuthGuard)
 * resolves to the other copy. The `instanceof HttpException` check in
 * the built-in filter fails, so every UnauthorizedException becomes a
 * 500.
 *
 * Registering our own filter from the spec's import path uses the
 * same `HttpException` symbol that guards/strategies threw against,
 * so `instanceof` passes and status + body serialise correctly. Prod
 * is unaffected — this is only a testing-layout workaround.
 */
@Catch()
class TestHttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      res.status(status).json(
        typeof body === 'string' ? { statusCode: status, message: body } : body,
      );
      return;
    }
    res.status(500).json({
      statusCode: 500,
      message: exception?.message ?? 'Internal server error',
    });
  }
}

import { PalmistryController } from '../src/modules/palmistry/palmistry.controller';
import { PalmistryService } from '../src/modules/palmistry/palmistry.service';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserService } from '../src/modules/user/user.service';
import { OpenAIService } from '../src/openai/openai.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { StorageService } from '../src/storage/storage.service';
import {
  mockPrismaService,
  mockUserService,
  mockOpenAIService,
  mockKnowledgeService,
  mockStorageService,
} from './helpers/mocks';

// ─── Constants ─────────────────────────────────────────────────────────────────
const JWT_SECRET = 'e2e-test-jwt-secret';
const VALID_PAYLOAD = { sub: 'test-uuid', email: 'test@example.com', name: 'Test User' };

// Minimal 1x1 JPEG (valid JPEG header)
const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP' +
    '//////////////////////////////////////////////////////////2wBDAf' +
    '//////////////////////////////////////////////////////////wAARCA' +
    'ABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAA' +
    'AAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAA' +
    'AAAAAP/aAAwDAQACEQMRAD8AKwA=',
  'base64',
);

// ─── Test Suite ────────────────────────────────────────────────────────────────
describe('Palmistry E2E (HTTP)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let userService: ReturnType<typeof mockUserService>;
  let prisma: ReturnType<typeof mockPrismaService>;

  beforeAll(async () => {
    prisma = mockPrismaService();
    userService = mockUserService();

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              jwt: {
                secret: JWT_SECRET,
                expiresIn: '1d',
              },
              credits: {
                palmistryCost: 3,
              },
            }),
          ],
        }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({
          secret: JWT_SECRET,
          signOptions: { expiresIn: '1d' },
        }),
      ],
      controllers: [PalmistryController],
      providers: [
        PalmistryService,
        JwtStrategy,
        // Reflector is what `JwtAuthGuard.canActivate` uses to look up
        // the `@Public()` metadata; without it the guard throws
        // "Cannot read properties of undefined (reading 'getAllAndOverride')"
        // and every palmistry request 500s before the auth check runs.
        // It's normally provided by the full app bootstrap.
        Reflector,
        { provide: PrismaService, useValue: prisma },
        { provide: UserService, useValue: userService },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
        { provide: StorageService, useValue: mockStorageService() },
      ],
    }).compile();

    app = module.createNestApplication();
    // See TestHttpExceptionFilter comment: without this, every
    // UnauthorizedException turns into a 500 because the built-in
    // filter's `instanceof HttpException` check fails across the
    // duplicate @nestjs/common copies in this workspace.
    app.useGlobalFilters(new TestHttpExceptionFilter());
    await app.init();

    jwtService = module.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    // Reset mocks before each test
    userService.deductCredits.mockResolvedValue(true);
    prisma.palmistryReading.create.mockResolvedValue({
      id: 'palm-e2e-1',
      createdAt: new Date(),
    });
  });

  // ─── Helper ────────────────────────────────────────────────────────────────
  function signToken(
    payload: Record<string, any> = VALID_PAYLOAD,
    options: jwt.SignOptions = {},
  ): string {
    return jwtService.sign(payload, options);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Authentication', () => {
    it('should return 202 with a valid JWT token', async () => {
      const token = signToken();

      const res = await request(app.getHttpServer())
        .post('/palmistry/analyze')
        .set('Authorization', `Bearer ${token}`)
        .expect(202);

      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('userId', 'test-uuid');
    });

    it('should return 401 when no Authorization header is provided', async () => {
      const res = await request(app.getHttpServer())
        .post('/palmistry/analyze')
        .expect(401);

      expect(res.body.message).toMatch(/Invalid or expired token|Unauthorized/);
    });

    it('should return 401 with an expired token', async () => {
      // Sign a token that expires immediately
      const token = signToken(VALID_PAYLOAD, { expiresIn: '0s' });

      // Small delay to ensure expiry
      await new Promise((r) => setTimeout(r, 50));

      const res = await request(app.getHttpServer())
        .post('/palmistry/analyze')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      expect(res.body.message).toMatch(/Invalid or expired token|Unauthorized/);
    });

    it('should return 401 with a malformed token', async () => {
      const res = await request(app.getHttpServer())
        .post('/palmistry/analyze')
        .set('Authorization', 'Bearer this-is-not-a-valid-jwt')
        .expect(401);

      expect(res.body.message).toMatch(/Invalid or expired token|Unauthorized/);
    });

    it('should return 401 with a token signed using the wrong secret', async () => {
      // Sign with a completely different secret
      const wrongToken = require('jsonwebtoken').sign(
        VALID_PAYLOAD,
        'completely-wrong-secret',
        { expiresIn: '1d' },
      );

      const res = await request(app.getHttpServer())
        .post('/palmistry/analyze')
        .set('Authorization', `Bearer ${wrongToken}`)
        .expect(401);

      expect(res.body.message).toMatch(/Invalid or expired token|Unauthorized/);
    });

    it('should return 401 when token payload is missing required fields', async () => {
      // JwtStrategy.validate() requires sub and email
      const incompleteToken = jwtService.sign({ foo: 'bar' });

      const res = await request(app.getHttpServer())
        .post('/palmistry/analyze')
        .set('Authorization', `Bearer ${incompleteToken}`)
        .expect(401);

      expect(res.body.message).toMatch(/Invalid|Unauthorized/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MULTIPART FILE UPLOAD TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('File Upload', () => {
    it('should accept a valid JPEG image upload', async () => {
      const token = signToken();

      const res = await request(app.getHttpServer())
        .post('/palmistry/analyze')
        .set('Authorization', `Bearer ${token}`)
        .attach('image', TINY_JPEG, { filename: 'palm.jpg', contentType: 'image/jpeg' })
        .expect(202);

      expect(res.body.lines).toBeDefined();
      expect(res.body.mounts).toBeDefined();
      expect(res.body.fingerAnalysis).toBeDefined();
    });

    it('should work without an image file (uses fallback)', async () => {
      const token = signToken();

      const res = await request(app.getHttpServer())
        .post('/palmistry/analyze')
        .set('Authorization', `Bearer ${token}`)
        .expect(202);

      expect(res.body.lines.length).toBeGreaterThan(0);
      expect(res.body.overallReading).toBeTruthy();
    });

    it('should reject non-image file types', async () => {
      const token = signToken();
      const textFile = Buffer.from('This is not an image');

      const res = await request(app.getHttpServer())
        .post('/palmistry/analyze')
        .set('Authorization', `Bearer ${token}`)
        .attach('image', textFile, { filename: 'test.txt', contentType: 'text/plain' })
        .expect(400);

      expect(res.body.message).toMatch(/image/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CREDITS TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Credits', () => {
    it('should return 400 when user has insufficient credits', async () => {
      userService.deductCredits.mockResolvedValue(false);
      const token = signToken();

      const res = await request(app.getHttpServer())
        .post('/palmistry/analyze')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(res.body.message).toMatch(/Insufficient credits/i);
    });

    it('should deduct credits on successful analysis', async () => {
      const token = signToken();

      await request(app.getHttpServer())
        .post('/palmistry/analyze')
        .set('Authorization', `Bearer ${token}`)
        .expect(202);

      expect(userService.deductCredits).toHaveBeenCalledWith(
        'test-uuid',
        3,
        'Palmistry reading',
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RESPONSE SHAPE VALIDATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Response Shape', () => {
    it('should return a complete PalmistryAnalysis object', async () => {
      const token = signToken();

      const res = await request(app.getHttpServer())
        .post('/palmistry/analyze')
        .set('Authorization', `Bearer ${token}`)
        .expect(202);

      const body = res.body;

      // Top-level fields
      expect(body.id).toBe('palm-e2e-1');
      expect(body.userId).toBe('test-uuid');
      expect(body.createdAt).toBeTruthy();

      // Lines
      expect(Array.isArray(body.lines)).toBe(true);
      expect(body.lines.length).toBeGreaterThanOrEqual(3);
      body.lines.forEach((line: any) => {
        expect(line).toHaveProperty('name');
        expect(line).toHaveProperty('description');
        expect(line).toHaveProperty('strength');
        expect(line).toHaveProperty('interpretation');
        expect(['strong', 'moderate', 'weak']).toContain(line.strength);
      });

      // Mounts
      expect(Array.isArray(body.mounts)).toBe(true);
      body.mounts.forEach((mount: any) => {
        expect(mount).toHaveProperty('name');
        expect(mount).toHaveProperty('prominence');
        expect(mount).toHaveProperty('interpretation');
        expect(['elevated', 'normal', 'flat']).toContain(mount.prominence);
      });

      // Finger analysis
      expect(Array.isArray(body.fingerAnalysis)).toBe(true);
      body.fingerAnalysis.forEach((f: any) => {
        expect(f).toHaveProperty('finger');
        expect(f).toHaveProperty('length');
        expect(f).toHaveProperty('interpretation');
        expect(['long', 'average', 'short']).toContain(f.length);
      });

      // Insight strings
      expect(typeof body.overallReading).toBe('string');
      expect(body.overallReading.length).toBeGreaterThan(10);
      expect(typeof body.healthInsights).toBe('string');
      expect(typeof body.careerInsights).toBe('string');
      expect(typeof body.relationshipInsights).toBe('string');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TOKEN EXPIRY SCENARIO (Documents the root cause of the user's bug)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Token Expiry Scenario (Root Cause)', () => {
    it('should reject expired access token — client must refresh before retrying', async () => {
      // This test documents the exact scenario the user encounters:
      // 1. User logs in, gets accessToken (expiresIn: '1d')
      // 2. Token expires after 1 day
      // 3. Palmistry upload sends expired token
      // 4. Server returns 401 "Invalid or expired token"
      // 5. Client MUST call /auth/refresh to get a new accessToken, then retry
      //
      // The bug was: api.upload() did NOT auto-refresh on 401, unlike api.get/post.
      // This has been fixed in apps/web/src/lib/api.ts.

      const expiredToken = signToken(VALID_PAYLOAD, { expiresIn: '0s' });
      await new Promise((r) => setTimeout(r, 50));

      // Step 1: Expired token is rejected
      const failRes = await request(app.getHttpServer())
        .post('/palmistry/analyze')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
      expect(failRes.body.message).toMatch(/Invalid or expired token/);

      // Step 2: Fresh token works
      const freshToken = signToken();
      const successRes = await request(app.getHttpServer())
        .post('/palmistry/analyze')
        .set('Authorization', `Bearer ${freshToken}`)
        .expect(202);
      expect(successRes.body.id).toBeTruthy();
    });

    it('should accept a token signed with the correct secret even near expiry', async () => {
      // Token that expires in 5 seconds — still valid right now
      const token = signToken(VALID_PAYLOAD, { expiresIn: '5s' });

      const res = await request(app.getHttpServer())
        .post('/palmistry/analyze')
        .set('Authorization', `Bearer ${token}`)
        .expect(202);

      expect(res.body.userId).toBe('test-uuid');
    });
  });
});
