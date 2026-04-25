-- Ops telemetry columns on llm_usage.
--
-- Postgres native partitioned tables propagate ALTER TABLE to every
-- partition atomically, so we only need to touch the parent. All four
-- columns are nullable or defaulted so historical rows stay valid and
-- the migration can be replayed without blocking writes.
--
-- Fields:
--   duration_ms  — wall-clock ms of the LLM provider call (null for
--                  cache-hit rows and pre-instrumentation rows).
--   cache_hit    — TRUE when served from the LlmCacheService Redis
--                  short-circuit; tokens and cost are zero for these.
--   error_code   — null on success; populated when the provider call
--                  itself failed (TIMEOUT, RATE_LIMIT, PROVIDER_ERROR,
--                  BAD_REQUEST, …). Index below targets error-rate
--                  dashboards in the upcoming Ops tab.
--   retry_count  — failover depth at the moment of the recorded call:
--                  0 = primary provider, 1 = second, 2 = third.

ALTER TABLE "llm_usage"
  ADD COLUMN "duration_ms"  INTEGER,
  ADD COLUMN "cache_hit"    BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN "error_code"   VARCHAR(64),
  ADD COLUMN "retry_count"  SMALLINT     NOT NULL DEFAULT 0;

-- Composite index on (error_code, created_at) for the admin error-rate
-- dashboard. Partial so the index stays tiny — successful rows have
-- error_code = NULL and aren't indexed.
CREATE INDEX "llm_usage_errorCode_createdAt_idx"
  ON "llm_usage" ("error_code", "created_at")
  WHERE "error_code" IS NOT NULL;
