import Redis from 'ioredis';
import { MemoryCacheService } from '../../src/common/cache.service';

/**
 * Integration test: MemoryCacheService backed by a real Redis instance.
 *
 * Before Phase 0 this service was an in-process LRU Map and would lose
 * all state on pod restart and never share state across replicas. These
 * tests exercise the new ioredis-backed implementation against a real
 * `redis-server` spawned by the global setup hook.
 */
describe('MemoryCacheService (Redis-backed)', () => {
  let redis: Redis;
  let cache: MemoryCacheService;

  beforeAll(() => {
    redis = new Redis({
      host: process.env.TEST_REDIS_HOST!,
      port: Number(process.env.TEST_REDIS_PORT),
      lazyConnect: false,
    });
    cache = new MemoryCacheService(redis);
  });

  afterAll(async () => {
    await redis.quit();
  });

  beforeEach(async () => {
    await redis.flushall();
  });

  it('round-trips JSON-serializable values', async () => {
    const payload = { user: 'alice', planets: ['Sun', 'Moon'], nested: { ok: true } };
    await cache.set('chart:1', payload, 10_000);
    const got = await cache.get<typeof payload>('chart:1');
    expect(got).toEqual(payload);
  });

  it('returns null for missing keys', async () => {
    const got = await cache.get('nope');
    expect(got).toBeNull();
  });

  it('returns null for expired keys (TTL honored by Redis)', async () => {
    await cache.set('short', { hit: 1 }, 100);
    // Verify it's there immediately.
    expect(await cache.get('short')).toEqual({ hit: 1 });
    await new Promise((r) => setTimeout(r, 200));
    expect(await cache.get('short')).toBeNull();
  });

  it('delete() removes the key', async () => {
    await cache.set('gone', { v: 1 }, 10_000);
    await cache.delete('gone');
    expect(await cache.get('gone')).toBeNull();
  });

  it('survives a simulated pod restart (new service instance, same Redis)', async () => {
    await cache.set('persist', { ok: true, n: 42 }, 30_000);

    // Construct a brand-new MemoryCacheService as if a fresh pod booted.
    const freshRedis = new Redis({
      host: process.env.TEST_REDIS_HOST!,
      port: Number(process.env.TEST_REDIS_PORT),
    });
    const freshCache = new MemoryCacheService(freshRedis);
    try {
      const got = await freshCache.get<{ ok: boolean; n: number }>('persist');
      expect(got).toEqual({ ok: true, n: 42 });
    } finally {
      await freshRedis.quit();
    }
  });

  it('handles concurrent writes from multiple clients without corruption', async () => {
    const writers = Array.from({ length: 50 }, (_, i) =>
      cache.set(`key:${i}`, { idx: i }, 10_000),
    );
    await Promise.all(writers);

    const reads = await Promise.all(
      Array.from({ length: 50 }, (_, i) => cache.get<{ idx: number }>(`key:${i}`)),
    );
    reads.forEach((val, i) => expect(val).toEqual({ idx: i }));
  });

  it('gracefully returns null on corrupted JSON (guard against prod poisoning)', async () => {
    // Simulate a value written by something other than MemoryCacheService.
    await redis.set('bad-json', '{ not valid json');
    const got = await cache.get('bad-json');
    expect(got).toBeNull();
  });
});
