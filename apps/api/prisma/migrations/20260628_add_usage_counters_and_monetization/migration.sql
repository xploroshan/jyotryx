-- Subscription-model usage meters + monetization settings.
--
-- Adds the `usage_counters` table — a per-user, per-feature, per-period meter
-- that replaces credit deduction for chat / palmistry / report bundles when
-- the new subscription model is on (feature.credits_enabled = false) — and
-- seeds the new monetization site_settings. Purely additive and guarded for
-- safe re-runs on a partially-migrated database. The existing credit ledger
-- (users.credits, credit_transactions, entitlements) is left untouched.

-- ─── usage_counters table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "usage_counters" (
  "id"        UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId"    UUID NOT NULL,
  "feature"   TEXT NOT NULL,
  "periodKey" TEXT NOT NULL,
  "used"      INTEGER NOT NULL DEFAULT 0,
  "bonus"     INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "usage_counters_pkey" PRIMARY KEY ("id")
);

-- One counter row per (user, feature, period); also the upsert conflict target.
CREATE UNIQUE INDEX IF NOT EXISTS "usage_counters_userId_feature_periodKey_key"
  ON "usage_counters" ("userId", "feature", "periodKey");

CREATE INDEX IF NOT EXISTS "usage_counters_userId_idx"
  ON "usage_counters" ("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'usage_counters_userId_fkey'
  ) THEN
    ALTER TABLE "usage_counters"
      ADD CONSTRAINT "usage_counters_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- ─── Monetization settings (new subscription model) ──────────────────────────
-- `feature.credits_enabled` defaults to 'true' so this migration is a no-op
-- behavioural change on deploy (legacy credit gating preserved). GOING LIVE
-- with the subscription model = set BOTH:
--     feature.credits_enabled      = 'false'
--     feature.subscriptions_enabled = 'true'
-- (and configure the Cashfree plan IDs). ON CONFLICT DO NOTHING never clobbers
-- a value an operator already tuned in production.
--
-- Per-feature allowances: free is a LIFETIME quota, subscriber is per billing
-- month. Overage packs (₹100) are sold as one-time products that top up the
-- `bonus` column of the current period's counter.
INSERT INTO "site_settings" ("key", "value", "updatedAt") VALUES
  ('feature.credits_enabled',           'true',  CURRENT_TIMESTAMP),
  ('feature.overage_for_free_enabled',  'false', CURRENT_TIMESTAMP),
  ('limits.chat.free',                  '50',    CURRENT_TIMESTAMP),
  ('limits.chat.subscriber',            '1000',  CURRENT_TIMESTAMP),
  ('limits.palmistry.free',             '2',     CURRENT_TIMESTAMP),
  ('limits.palmistry.subscriber',       '4',     CURRENT_TIMESTAMP),
  ('limits.report_bundle.free',         '1',     CURRENT_TIMESTAMP),
  ('limits.report_bundle.subscriber',   '1',     CURRENT_TIMESTAMP),
  ('pricing.monthly.price',             '99',    CURRENT_TIMESTAMP),
  ('pricing.annual.price',              '2999',  CURRENT_TIMESTAMP),
  ('pricing.credits.overage_palmistry.price',   '100', CURRENT_TIMESTAMP),
  ('pricing.credits.overage_palmistry.credits', '2',   CURRENT_TIMESTAMP),
  ('pricing.credits.overage_chat.price',        '100', CURRENT_TIMESTAMP),
  ('pricing.credits.overage_chat.credits',      '350', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
