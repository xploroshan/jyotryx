-- Phase 2: Partition llm_usage, activity_logs, chat_messages, notifications by month
-- PostgreSQL range partitioning on "createdAt"
-- Prisma does not support PARTITION BY natively; this is a raw SQL migration.

-- ============================================================================
-- 1. llm_usage
-- ============================================================================

-- Drop FK constraint (partitioned tables cannot reference non-partitioned parents)
ALTER TABLE "llm_usage" DROP CONSTRAINT IF EXISTS "llm_usage_userId_fkey";

-- Drop existing indexes
DROP INDEX IF EXISTS "llm_usage_userId_idx";
DROP INDEX IF EXISTS "llm_usage_userId_createdAt_idx";
DROP INDEX IF EXISTS "llm_usage_createdAt_idx";
DROP INDEX IF EXISTS "llm_usage_provider_model_idx";

-- Rename primary-key constraint out of the way. `ALTER TABLE ... RENAME TO`
-- does NOT rename the pkey constraint/index, so without this the subsequent
-- `CREATE TABLE "llm_usage" (... CONSTRAINT "llm_usage_pkey" ...)` fails with
-- 42P07 "relation llm_usage_pkey already exists". Renaming the constraint
-- also renames its backing index in one step.
ALTER TABLE "llm_usage" RENAME CONSTRAINT "llm_usage_pkey" TO "llm_usage_old_pkey";

-- Rename old table
ALTER TABLE "llm_usage" RENAME TO "llm_usage_old";

-- Create partitioned parent (composite PK includes createdAt as required by PG)
CREATE TABLE "llm_usage" (
    "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
    "userId"           UUID,
    "provider"         TEXT         NOT NULL,
    "model"            TEXT         NOT NULL,
    "feature"          TEXT         NOT NULL,
    "promptTokens"     INTEGER      NOT NULL DEFAULT 0,
    "completionTokens" INTEGER      NOT NULL DEFAULT 0,
    "totalTokens"      INTEGER      NOT NULL DEFAULT 0,
    "costUsd"          DECIMAL(12,6) NOT NULL DEFAULT 0,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "llm_usage_pkey" PRIMARY KEY ("id", "createdAt")
) PARTITION BY RANGE ("createdAt");

-- Create monthly partitions (Jan 2026 – Jun 2026) + default
CREATE TABLE "llm_usage_y2026m01" PARTITION OF "llm_usage"
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE "llm_usage_y2026m02" PARTITION OF "llm_usage"
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE "llm_usage_y2026m03" PARTITION OF "llm_usage"
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE "llm_usage_y2026m04" PARTITION OF "llm_usage"
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE "llm_usage_y2026m05" PARTITION OF "llm_usage"
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE "llm_usage_y2026m06" PARTITION OF "llm_usage"
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE "llm_usage_default" PARTITION OF "llm_usage" DEFAULT;

-- Copy data
INSERT INTO "llm_usage" SELECT * FROM "llm_usage_old";

-- Recreate indexes on parent (auto-inherited by partitions)
CREATE INDEX "llm_usage_userId_idx" ON "llm_usage"("userId");
CREATE INDEX "llm_usage_userId_createdAt_idx" ON "llm_usage"("userId", "createdAt");
CREATE INDEX "llm_usage_createdAt_idx" ON "llm_usage"("createdAt");
CREATE INDEX "llm_usage_provider_model_idx" ON "llm_usage"("provider", "model");

-- Drop old table
DROP TABLE "llm_usage_old";

-- ============================================================================
-- 2. activity_logs (no FK to drop)
-- ============================================================================

-- Drop existing indexes
DROP INDEX IF EXISTS "activity_logs_adminId_idx";
DROP INDEX IF EXISTS "activity_logs_entityType_entityId_idx";
DROP INDEX IF EXISTS "activity_logs_createdAt_idx";

-- Rename pkey out of the way (see llm_usage note above)
ALTER TABLE "activity_logs" RENAME CONSTRAINT "activity_logs_pkey" TO "activity_logs_old_pkey";

-- Rename old table
ALTER TABLE "activity_logs" RENAME TO "activity_logs_old";

-- Create partitioned parent
CREATE TABLE "activity_logs" (
    "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
    "adminId"      UUID        NOT NULL,
    "adminEmail"   TEXT        NOT NULL,
    "action"       TEXT        NOT NULL,
    "entityType"   TEXT        NOT NULL,
    "entityId"     UUID        NOT NULL,
    "entityLabel"  TEXT,
    "previousData" JSONB,
    "newData"      JSONB,
    "undone"       BOOLEAN     NOT NULL DEFAULT false,
    "undoneAt"     TIMESTAMP(3),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id", "createdAt")
) PARTITION BY RANGE ("createdAt");

-- Create monthly partitions (Jan 2026 – Jun 2026) + default
CREATE TABLE "activity_logs_y2026m01" PARTITION OF "activity_logs"
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE "activity_logs_y2026m02" PARTITION OF "activity_logs"
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE "activity_logs_y2026m03" PARTITION OF "activity_logs"
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE "activity_logs_y2026m04" PARTITION OF "activity_logs"
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE "activity_logs_y2026m05" PARTITION OF "activity_logs"
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE "activity_logs_y2026m06" PARTITION OF "activity_logs"
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE "activity_logs_default" PARTITION OF "activity_logs" DEFAULT;

-- Copy data (cast action text to match — Prisma stores enum values as text)
INSERT INTO "activity_logs" SELECT * FROM "activity_logs_old";

-- Recreate indexes
CREATE INDEX "activity_logs_adminId_idx" ON "activity_logs"("adminId");
CREATE INDEX "activity_logs_entityType_entityId_idx" ON "activity_logs"("entityType", "entityId");
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");

-- Drop old table
DROP TABLE "activity_logs_old";

-- ============================================================================
-- 3. chat_messages
-- ============================================================================

-- Drop FK constraint
ALTER TABLE "chat_messages" DROP CONSTRAINT IF EXISTS "chat_messages_sessionId_fkey";

-- Drop existing indexes
DROP INDEX IF EXISTS "chat_messages_sessionId_idx";
DROP INDEX IF EXISTS "chat_messages_sessionId_createdAt_idx";

-- Rename pkey out of the way (see llm_usage note above)
ALTER TABLE "chat_messages" RENAME CONSTRAINT "chat_messages_pkey" TO "chat_messages_old_pkey";

-- Rename old table
ALTER TABLE "chat_messages" RENAME TO "chat_messages_old";

-- Create partitioned parent
CREATE TABLE "chat_messages" (
    "id"        UUID         NOT NULL DEFAULT gen_random_uuid(),
    "sessionId" UUID         NOT NULL,
    "role"      TEXT         NOT NULL,
    "content"   TEXT         NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id", "createdAt")
) PARTITION BY RANGE ("createdAt");

-- Create monthly partitions (Jan 2026 – Jun 2026) + default
CREATE TABLE "chat_messages_y2026m01" PARTITION OF "chat_messages"
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE "chat_messages_y2026m02" PARTITION OF "chat_messages"
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE "chat_messages_y2026m03" PARTITION OF "chat_messages"
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE "chat_messages_y2026m04" PARTITION OF "chat_messages"
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE "chat_messages_y2026m05" PARTITION OF "chat_messages"
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE "chat_messages_y2026m06" PARTITION OF "chat_messages"
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE "chat_messages_default" PARTITION OF "chat_messages" DEFAULT;

-- Copy data
INSERT INTO "chat_messages" SELECT * FROM "chat_messages_old";

-- Recreate indexes
CREATE INDEX "chat_messages_sessionId_idx" ON "chat_messages"("sessionId");
CREATE INDEX "chat_messages_sessionId_createdAt_idx" ON "chat_messages"("sessionId", "createdAt");

-- Drop old table
DROP TABLE "chat_messages_old";

-- ============================================================================
-- 4. notifications
-- ============================================================================

-- Drop FK constraint
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_userId_fkey";

-- Drop existing indexes
DROP INDEX IF EXISTS "notifications_userId_idx";
DROP INDEX IF EXISTS "notifications_userId_read_idx";

-- Rename pkey out of the way (see llm_usage note above)
ALTER TABLE "notifications" RENAME CONSTRAINT "notifications_pkey" TO "notifications_old_pkey";

-- Rename old table
ALTER TABLE "notifications" RENAME TO "notifications_old";

-- Create partitioned parent
CREATE TABLE "notifications" (
    "id"        UUID         NOT NULL DEFAULT gen_random_uuid(),
    "userId"    UUID         NOT NULL,
    "title"     TEXT         NOT NULL,
    "body"      TEXT         NOT NULL,
    "type"      TEXT         NOT NULL DEFAULT 'general',
    "read"      BOOLEAN      NOT NULL DEFAULT false,
    "data"      JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id", "createdAt")
) PARTITION BY RANGE ("createdAt");

-- Create monthly partitions (Jan 2026 – Jun 2026) + default
CREATE TABLE "notifications_y2026m01" PARTITION OF "notifications"
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE "notifications_y2026m02" PARTITION OF "notifications"
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE "notifications_y2026m03" PARTITION OF "notifications"
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE "notifications_y2026m04" PARTITION OF "notifications"
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE "notifications_y2026m05" PARTITION OF "notifications"
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE "notifications_y2026m06" PARTITION OF "notifications"
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE "notifications_default" PARTITION OF "notifications" DEFAULT;

-- Copy data
INSERT INTO "notifications" SELECT * FROM "notifications_old";

-- Recreate indexes
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");
CREATE INDEX "notifications_userId_read_idx" ON "notifications"("userId", "read");

-- Drop old table
DROP TABLE "notifications_old";

-- ============================================================================
-- Drop the enum types that were used by the old non-partitioned tables
-- (Prisma creates PostgreSQL enums; the partitioned tables store as TEXT)
-- These DROPs are safe because no table references them after partitioning.
-- ============================================================================
DROP TYPE IF EXISTS "AdminAction" CASCADE;
DROP TYPE IF EXISTS "MessageRole" CASCADE;
