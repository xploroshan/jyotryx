import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import Redis from 'ioredis';
import request from 'supertest';
import { HealthController } from '../../src/health/health.controller';
import { PrismaService } from '../../src/prisma/prisma.service';
import { REDIS_CLIENT } from '../../src/redis/redis.module';

/**
 * Integration test for /health/live and /health/ready.
 *
 * Before Phase 0 the health endpoint was a static `{status:'ok'}` that
 * returned green even if Postgres and Redis were unreachable — load
 * balancers happily kept routing traffic to a broken pod. The new
 * /health/ready actually pings both, so Kubernetes readiness probes
 * can pull a dying pod out of rotation.
 *
 * This test wires a minimal Nest app with the real HealthController +
 * real PrismaService + real ioredis client against the ephemeral
 * containers spun up by globalSetup.
 */
describe('HealthController', () => {
  let app: INestApplication;
  let redis: Redis;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.TEST_POSTGRES_URL!;

    redis = new Redis({
      host: process.env.TEST_REDIS_HOST!,
      port: Number(process.env.TEST_REDIS_PORT),
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [
        PrismaService,
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await redis.quit();
  });

  it('GET /health/live returns {status:ok} without touching any dep', async () => {
    const res = await request(app.getHttpServer()).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /health/ready reports both database and redis as up', async () => {
    const res = await request(app.getHttpServer()).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.info).toEqual(
      expect.objectContaining({
        database: { status: 'up' },
        redis: { status: 'up' },
      }),
    );
  });

  // Build a Nest app whose Redis client is disconnected, so the readiness
  // ping fails. The caller controls REDIS_HEALTH_REQUIRED to choose between
  // the hard (down/503) and soft (degraded/200) behaviours.
  async function buildAppWithBrokenRedis() {
    const brokenRedis = new Redis({
      host: process.env.TEST_REDIS_HOST!,
      port: Number(process.env.TEST_REDIS_PORT),
      lazyConnect: true,
    });
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [PrismaService, { provide: REDIS_CLIENT, useValue: brokenRedis }],
    }).compile();
    const app = moduleFixture.createNestApplication();
    await app.init();
    brokenRedis.disconnect(); // subsequent ping() rejects → indicator sees it as down
    return app;
  }

  it('GET /health/ready returns 503 when Redis is unreachable AND required', async () => {
    // Redis is a SOFT dependency by default; declaring it required
    // (REDIS_HEALTH_REQUIRED=true) makes an outage surface as 503/down.
    const prev = process.env.REDIS_HEALTH_REQUIRED;
    process.env.REDIS_HEALTH_REQUIRED = 'true';
    const brokenApp = await buildAppWithBrokenRedis();
    try {
      const res = await request(brokenApp.getHttpServer()).get('/health/ready');
      expect(res.status).toBe(503);
      // Terminus packs the failing indicator into `error`.
      expect(res.body.status).toBe('error');
      expect(res.body.error).toEqual(
        expect.objectContaining({ redis: expect.objectContaining({ status: 'down' }) }),
      );
    } finally {
      process.env.REDIS_HEALTH_REQUIRED = prev;
      await brokenApp.close();
    }
  });

  it('GET /health/ready stays 200 (degraded) when Redis is down but NOT required (default)', async () => {
    // Production default: a Redis blip must not evict the replica — the API
    // still serves auth/profile/read paths, so readiness reports degraded
    // but stays green.
    const prev = process.env.REDIS_HEALTH_REQUIRED;
    delete process.env.REDIS_HEALTH_REQUIRED; // default = soft
    const brokenApp = await buildAppWithBrokenRedis();
    try {
      const res = await request(brokenApp.getHttpServer()).get('/health/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.info).toEqual(
        expect.objectContaining({ redis: expect.objectContaining({ status: 'up', degraded: true }) }),
      );
    } finally {
      process.env.REDIS_HEALTH_REQUIRED = prev;
      await brokenApp.close();
    }
  });
});
