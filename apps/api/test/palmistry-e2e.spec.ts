/**
 * Palmistry E2E Tests — True HTTP-level tests with real JWT auth.
 *
 * These tests bootstrap a real NestJS app, sign actual JWT tokens,
 * and send HTTP requests via supertest to validate the full
 * authentication + palmistry analysis flow.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService, JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as request from 'supertest';
import * as jwt from 'jsonwebtoken';

import { PalmistryController } from '../src/modules/palmistry/palmistry.controller';
import { PalmistryService } from '../src/modules/palmistry/palmistry.service';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy';
import { PrismaService } from '../src/prisma/prisma.service';
import { UserService } from '../src/modules/user/user.service';
import { OpenAIService } from '../src/openai/openai.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import {
  mockPrismaService,
  mockUserService,
  mockOpenAIService,
  mockKnowledgeService,
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
        { provide: PrismaService, useValue: prisma },
        { provide: UserService, useValue: userService },
        { provide: OpenAIService, useValue: mockOpenAIService() },
        { provide: KnowledgeService, useValue: mockKnowledgeService() },
      ],
    }).compile();

    app = module.createNestApplication();
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
    it('should return 201 with a valid JWT token', async () => {
      const token = signToken();

      const res = await request(app.getHttpServer())
        .post('/palmistry/analyze')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

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
        .expect(201);

      expect(res.body.lines).toBeDefined();
      expect(res.body.mounts).toBeDefined();
      expect(res.body.fingerAnalysis).toBeDefined();
    });

    it('should work without an image file (uses fallback)', async () => {
      const token = signToken();

      const res = await request(app.getHttpServer())
        .post('/palmistry/analyze')
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

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
        .expect(201);

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
        .expect(201);

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
});
