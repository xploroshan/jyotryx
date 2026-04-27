-- Phase 1 monetization: referral program.
--
-- Adds the columns + tables needed to track who referred whom, the
-- subscription rows that the bonus produced, and the `referral.*`
-- knobs the admin Settings tab exposes (enabled / bonus_days /
-- max_per_referrer). Both sides of a successful referral get the
-- configured bonus (default 30 days of Premium); admin can change
-- `referral.bonus_days` to 15 (or any positive integer) and the
-- next activation picks it up immediately because the value is
-- read from `site_settings` at activation time.
--
-- Idempotency notes:
--   • All ALTERs use IF NOT EXISTS so re-running on a partially
--     migrated DB is safe.
--   • The settings INSERT uses ON CONFLICT DO NOTHING so admins
--     who already tuned a key in production don't get clobbered
--     by the seed defaults.

-- ─── User columns ───────────────────────────────────────────────────────────
-- referralCode is the user's own shareable code. Generated lazily the
-- first time a user opens the referral surface or signs up; uniqueness
-- enforced via unique index. Nullable so the migration is non-blocking
-- on the existing user table (1M-row backfill would otherwise lock).
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "referralCode" TEXT,
  ADD COLUMN IF NOT EXISTS "referredById" UUID,
  ADD COLUMN IF NOT EXISTS "referredAt"   TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "users_referralCode_key"
  ON "users" ("referralCode");

CREATE INDEX IF NOT EXISTS "users_referredById_idx"
  ON "users" ("referredById");

-- Self-FK so deleting a referrer doesn't cascade-nuke referees; we
-- just null the link. NOT VALID skips the table-wide check on
-- existing rows (all of which have NULL referredById anyway).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_referredById_fkey'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_referredById_fkey"
      FOREIGN KEY ("referredById") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
  END IF;
END$$;

-- ─── Subscription provenance ────────────────────────────────────────────────
-- `source` lets the admin Cost / Funnel tabs separate paid revenue
-- from bonus-driven Premium. Existing rows are NULL → "PAID" by
-- omission (the LLM cost forecast already groups by status, not
-- source, so this is a pure additive column).
ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "source" TEXT;

CREATE INDEX IF NOT EXISTS "subscriptions_source_idx"
  ON "subscriptions" ("source");

-- ─── Referrals table ────────────────────────────────────────────────────────
-- One row per (referrer, referee) pair. Refereeid is unique because a
-- user can only ever be the referee once. Status starts ACTIVATED in
-- the current implementation (signup-time trigger) but we keep the
-- enum so a future "first paying action" trigger doesn't need a
-- migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'ReferralStatus'
  ) THEN
    CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'ACTIVATED', 'REJECTED');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "referrals" (
  "id"                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "referrerId"               UUID NOT NULL,
  "refereeId"                UUID NOT NULL,
  "code"                     TEXT NOT NULL,
  "bonusDays"                INTEGER NOT NULL,
  "status"                   "ReferralStatus" NOT NULL DEFAULT 'ACTIVATED',
  "referrerSubscriptionId"   UUID,
  "refereeSubscriptionId"    UUID,
  "activatedAt"              TIMESTAMP(3),
  "rejectedReason"           TEXT,
  "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT NOW(),

  CONSTRAINT "referrals_referrerId_fkey"
    FOREIGN KEY ("referrerId") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "referrals_refereeId_fkey"
    FOREIGN KEY ("refereeId")  REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "referrals_refereeId_key"
  ON "referrals" ("refereeId");

CREATE INDEX IF NOT EXISTS "referrals_referrerId_idx"
  ON "referrals" ("referrerId");

CREATE INDEX IF NOT EXISTS "referrals_status_idx"
  ON "referrals" ("status");

-- ─── Default settings ───────────────────────────────────────────────────────
-- Admin-tunable from the Settings tab via the existing `referral.*`
-- whitelist entry. Reading site_settings is one indexed lookup per
-- activation so there's no need to cache.
INSERT INTO "site_settings" ("key", "value", "updatedAt") VALUES
  ('referral.enabled',          'true', NOW()),
  ('referral.bonus_days',       '30',   NOW()),
  ('referral.max_per_referrer', '10',   NOW())
ON CONFLICT ("key") DO NOTHING;
