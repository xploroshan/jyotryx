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

  it('GET /health/ready returns 503 when Redis is unreachable', async () => {
    // Kill the connection to simulate Redis outage. `quit()` issues a
    // QUIT to the server and closes the socket — subsequent commands
    // reject with ClientClosedError, which the 2s Promise.race in the
    // health indicator turns into a `down` status.
    const brokenRedis = new Redis({
      host: process.env.TEST_REDIS_HOST!,
      port: Number(process.env.TEST_REDIS_PORT),
      lazyConnect: true,
    });

    // Build a second Nest app that points at the broken client.
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [
        PrismaService,
        { provide: REDIS_CLIENT, useValue: brokenRedis },
      ],
    }).compile();

    const brokenApp = moduleFixture.createNestApplication();
    await brokenApp.init();

    // Disconnect so ping() can't complete.
    brokenRedis.disconnect();

    const res = await request(brokenApp.getHttpServer()).get('/health/ready');
    expect(res.status).toBe(503);
    // Terminus packs the failing indicator into `error`.
    expect(res.body.status).toBe('error');
    expect(res.body.error).toEqual(
      expect.objectContaining({ redis: expect.objectContaining({ status: 'down' }) }),
    );

    await brokenApp.close();
  });
});
