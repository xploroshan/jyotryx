# Integration tests

These tests validate the Phase 0 scalability wiring (Redis, pgBouncer,
health checks, GIN index) end-to-end against **real** daemons, not
mocks. They complement the unit suite (`npm test`) by catching bugs
that only show up when the actual ioredis / Prisma / pgBouncer stack
is exercised.

## What's covered

| Spec | What it asserts |
|---|---|
| `smoke.int-spec.ts` | Harness boots and exports env coordinates |
| `redis-cache.int-spec.ts` | `MemoryCacheService` round-trip, TTL, cross-pod state, concurrent writes, JSON poisoning |
| `auth-redis.int-spec.ts` | OTP + lockout state in Redis survives pod restart and is visible cross-pod |
| `pgbouncer.int-spec.ts` | Prisma through pgBouncer handles concurrent queries; `SHOW LISTS` admin; GIN index on `knowledge_documents.keywords` exists and is usable |
| `health.int-spec.ts` | `/health/live` + `/health/ready` return correct 200/503 on healthy/degraded deps |

## Running

```
cd apps/api
npm run test:int
```

The harness (`test/integration/global-setup.ts`) will:

1. Spin up `redis-server` on a random port
2. Spin up PostgreSQL on a random port (via `pg_ctl`; drops to the
   `postgres` system user when invoked as root)
3. Run `prisma migrate deploy` against the fresh cluster
4. Spin up `pgbouncer` on a random port in transaction pool mode
   (default pool size 5, max client 50) pointing at Postgres
5. Export `TEST_REDIS_*`, `TEST_POSTGRES_*`, `TEST_PGBOUNCER_*` env vars
6. Run the `*.int-spec.ts` files serially (`maxWorkers: 1`) so their
   assertions about Redis keys and pool state don't interfere

Teardown stops all three daemons and removes the temp data dirs.

## Prerequisites

The integration harness shells out to system binaries — it does **not**
use Docker / Testcontainers. On Ubuntu/Debian install:

```
apt-get install -y redis-server postgresql-16 pgbouncer
```

That's the same set the Docker Compose stack installs into its images,
so the tests exercise the same software versions that ship in prod.

## Why integration tests exist

Phase 0 moved OTP state, login-lockout counters, LRU caches, and rate
limits from per-process memory into Redis so the API can scale
horizontally. The unit suite mocks Redis (`createMockRedis()` in
`test/helpers/mocks.ts`), which validates logic but not the wire
protocol. These integration tests run against real ioredis + real
Redis so regressions like "TTLs not actually set", "cross-pod visibility
broken", or "wrong key encoding" are caught before they ship.

Similarly, `pgbouncer.int-spec.ts` caught the fact that the planner
behavior of the new GIN index depends on row count + `ANALYZE` — it
wouldn't have shown up in a dev-database smoke test.

And `health.int-spec.ts` caught a real bug during its first run: when
Redis was actually unreachable, the indicator re-threw the raw error
and Nest returned 500 instead of the 503 that Kubernetes readiness
probes need. The controller now wraps failures in `HealthCheckError`
so Terminus can surface them as `down`.
