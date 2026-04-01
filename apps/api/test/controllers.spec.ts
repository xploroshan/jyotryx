import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { DailyBriefingController } from '../src/modules/daily-briefing/daily-briefing.controller';
import { DailyBriefingService } from '../src/modules/daily-briefing/daily-briefing.service';
import { NumerologyController } from '../src/modules/numerology/numerology.controller';
import { NumerologyService } from '../src/modules/numerology/numerology.service';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { OpenAIService } from '../src/openai/openai.service';
import { KnowledgeService } from '../src/knowledge/knowledge.service';
import { MemoryCacheService } from '../src/common/cache.service';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import {
  mockPrismaService,
  mockOpenAIService,
  mockKnowledgeService,
  mockCacheService,
  mockConfigService,
} from './helpers/mocks';

describe('Controllers', () => {
  describe('DailyBriefingController', () => {
    let controller: DailyBriefingController;
    let dailyBriefingService: any;

    beforeEach(async () => {
      dailyBriefingService = {
        getDailyBriefing: jest.fn().mockResolvedValue({
          greeting: 'Good morning',
          date: '2026-04-01',
          dayQuality: 'good',
          summary: 'A great day ahead',
        }),
        getPlanetaryHoursOnly: jest.fn().mockResolvedValue([]),
      };

      const module: TestingModule = await Test.createTestingModule({
        controllers: [DailyBriefingController],
        providers: [
          { provide: DailyBriefingService, useValue: dailyBriefingService },
          { provide: Reflector, useValue: new Reflector() },
        ],
      }).compile();

      controller = module.get<DailyBriefingController>(DailyBriefingController);
    });

    it('should exist as a class', () => {
      expect(controller).toBeDefined();
      expect(controller).toBeInstanceOf(DailyBriefingController);
    });

    it('should have getDailyBriefing method', () => {
      expect(typeof controller.getDailyBriefing).toBe('function');
    });

    it('should have getPlanetaryHours method', () => {
      expect(typeof controller.getPlanetaryHours).toBe('function');
    });
  });

  describe('NumerologyController', () => {
    let controller: NumerologyController;
    let numerologyService: any;

    beforeEach(async () => {
      numerologyService = {
        analyzeName: jest.fn().mockResolvedValue({ name: 'Test', destinyNumber: 5 }),
        analyzeBrand: jest.fn().mockResolvedValue({ brandName: 'TestCo' }),
        getPersonalYear: jest.fn().mockResolvedValue({ year: 2026, number: 3 }),
      };

      const module: TestingModule = await Test.createTestingModule({
        controllers: [NumerologyController],
        providers: [
          { provide: NumerologyService, useValue: numerologyService },
          { provide: Reflector, useValue: new Reflector() },
        ],
      }).compile();

      controller = module.get<NumerologyController>(NumerologyController);
    });

    it('should exist as a class', () => {
      expect(controller).toBeDefined();
      expect(controller).toBeInstanceOf(NumerologyController);
    });

    it('should have analyzeName method', () => {
      expect(typeof controller.analyzeName).toBe('function');
    });

    it('should have analyzeBrand method', () => {
      expect(typeof controller.analyzeBrand).toBe('function');
    });

    it('should have getPersonalYear method', () => {
      expect(typeof controller.getPersonalYear).toBe('function');
    });
  });

  describe('AuthController', () => {
    let controller: AuthController;
    let authService: any;

    beforeEach(async () => {
      authService = {
        register: jest.fn().mockResolvedValue({ user: {}, tokens: {} }),
        login: jest.fn().mockResolvedValue({ user: {}, tokens: {} }),
        sendOtp: jest.fn().mockResolvedValue({ message: 'OTP sent', expiresIn: 300 }),
        verifyOtp: jest.fn().mockResolvedValue({ user: {}, tokens: {} }),
        googleAuth: jest.fn().mockResolvedValue({ user: {}, tokens: {} }),
        firebaseAuth: jest.fn().mockResolvedValue({ user: {}, tokens: {} }),
        refreshToken: jest.fn().mockResolvedValue({ accessToken: 'token', refreshToken: 'refresh' }),
        changePassword: jest.fn().mockResolvedValue({ message: 'Password changed' }),
        setPassword: jest.fn().mockResolvedValue({ message: 'Password set' }),
        getAuthStatus: jest.fn().mockResolvedValue({ hasPassword: true }),
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

    it('should exist as a class', () => {
      expect(controller).toBeDefined();
      expect(controller).toBeInstanceOf(AuthController);
    });
  });
});
