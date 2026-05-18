-- Phase 1 monetization, parts 3 + 4: daily briefings + paywall A/B test.
--
-- This migration is one file because the two features share a small
-- piece of infrastructure — `experiment_assignments` records which
-- variant a user is in, and the briefing scheduler reads
-- `briefingEmailEnabled` to decide who to enqueue. Splitting them
-- would mean two ALTER USER passes in production.
--
-- All ALTER TABLEs are non-blocking: new columns are nullable or have
-- a literal default; new tables use IF NOT EXISTS so re-running on a
-- partially-migrated DB is safe.

-- ─── User columns ───────────────────────────────────────────────────────────
-- briefingEmailEnabled is the single user-facing toggle. The send
-- time stays implicit (operator-controlled `briefing.send_hour_utc`
-- in site_settings) for the MVP — a per-user time picker is
-- straightforward to add later but bloats the first cut.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "briefingEmailEnabled" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS "users_briefingEmailEnabled_idx"
  ON "users" ("briefingEmailEnabled")
  WHERE "briefingEmailEnabled" = TRUE;

-- ─── Briefing deliveries ────────────────────────────────────────────────────
-- One row per (user, sendDate). The unique constraint is what makes
-- the daily fan-out safely idempotent: re-running the scheduler for
-- the same date never sends a second email.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'BriefingStatus'
  ) THEN
    CREATE TYPE "BriefingStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "briefing_deliveries" (
  "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"    UUID NOT NULL,
  "sendDate"  DATE NOT NULL,
  "channel"   TEXT NOT NULL DEFAULT 'email',
  "status"    "BriefingStatus" NOT NULL,
  "providerId" TEXT,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),

  CONSTRAINT "briefing_deliveries_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "briefing_deliveries_userId_sendDate_channel_key"
  ON "briefing_deliveries" ("userId", "sendDate", "channel");

CREATE INDEX IF NOT EXISTS "briefing_deliveries_sendDate_idx"
  ON "briefing_deliveries" ("sendDate");

CREATE INDEX IF NOT EXISTS "briefing_deliveries_status_idx"
  ON "briefing_deliveries" ("status");

-- ─── Experiment assignments (paywall A/B + future tests) ────────────────────
-- Generic 2- or 3-way bucket store. Keyed by (experiment, userKey)
-- where userKey is either a real user UUID or an anonymous-cookie
-- string (we cast to TEXT so both fit the same table). Variant is a
-- TEXT so a later experiment with named treatments doesn't need a
-- new column.
CREATE TABLE IF NOT EXISTS "experiment_assignments" (
  "experiment" TEXT NOT NULL,
  "userKey"    TEXT NOT NULL,
  "variant"    TEXT NOT NULL,
  "isAuthenticated" BOOLEAN NOT NULL DEFAULT FALSE,
  "userId"     UUID,
  "convertedAt" TIMESTAMP(3),
  "conversionType" TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT NOW(),

  PRIMARY KEY ("experiment", "userKey")
);

CREATE INDEX IF NOT EXISTS "experiment_assignments_experiment_variant_idx"
  ON "experiment_assignments" ("experiment", "variant");

CREATE INDEX IF NOT EXISTS "experiment_assignments_userId_idx"
  ON "experiment_assignments" ("userId");

CREATE INDEX IF NOT EXISTS "experiment_assignments_convertedAt_idx"
  ON "experiment_assignments" ("convertedAt")
  WHERE "convertedAt" IS NOT NULL;

-- ─── Default settings ───────────────────────────────────────────────────────
-- Briefing knobs (all admin-tunable from Settings tab via the
-- existing `notification.*` whitelist; we'll widen the whitelist in
-- the controller). Paywall A/B knobs follow a `paywall.*` prefix.
INSERT INTO "site_settings" ("key", "value", "updatedAt") VALUES
  -- Daily email briefings
  ('notification.briefing.enabled',       'true',  NOW()),
  ('notification.briefing.send_hour_utc', '1',     NOW()), -- 06:30 IST = 01:00 UTC
  ('notification.briefing.from_email',    'myastro360.astro@gmail.com', NOW()),
  ('notification.briefing.from_name',     'myastro360', NOW()),
  -- Paywall A/B test
  ('paywall.experiment_enabled',          'true',  NOW()),
  ('paywall.experiment_id',               'paywall_v1', NOW()),
  ('paywall.variant.control.weight',      '50',    NOW()), -- "first kundli costs credits"
  ('paywall.variant.first_free.weight',   '50',    NOW())  -- "first kundli is free"
ON CONFLICT ("key") DO NOTHING;
