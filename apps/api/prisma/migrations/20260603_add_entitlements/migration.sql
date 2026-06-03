-- Monetization pivot: one-time pay-to-unlock entitlements for Reports and
-- Palmistry, plus the persona column on chat sessions.
--
-- A successful one-time payment grants exactly one Entitlement (paymentId
-- is unique → idempotent across the verify + webhook race). `consumedAt`
-- null means the unlock is unused; it is set atomically when redeemed for
-- one generation. Re-generation requires a fresh purchase.
--
-- Purely additive (new enum, new table, one nullable column) so the
-- migration is non-blocking on existing rows. All DDL guarded for safe
-- re-runs on a partially-migrated database.

-- ─── EntitlementType enum ────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EntitlementType') THEN
    CREATE TYPE "EntitlementType" AS ENUM (
      'REPORT_LIFE',
      'REPORT_CAREER',
      'REPORT_MARRIAGE',
      'REPORT_WEALTH',
      'REPORT_ANNUAL',
      'REPORT_PALM',
      'PALMISTRY'
    );
  END IF;
END$$;

-- ─── entitlements table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "entitlements" (
  "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId"      UUID NOT NULL,
  "type"        "EntitlementType" NOT NULL,
  "paymentId"   UUID NOT NULL,
  "consumedAt"  TIMESTAMP(3),
  "consumedRef" UUID,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- One SUCCESS payment grants at most one unlock.
CREATE UNIQUE INDEX IF NOT EXISTS "entitlements_paymentId_key"
  ON "entitlements" ("paymentId");

-- Hot path: find the user's oldest unused unlock of a given type.
CREATE INDEX IF NOT EXISTS "entitlements_userId_type_consumedAt_idx"
  ON "entitlements" ("userId", "type", "consumedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entitlements_userId_fkey'
  ) THEN
    ALTER TABLE "entitlements"
      ADD CONSTRAINT "entitlements_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entitlements_paymentId_fkey'
  ) THEN
    ALTER TABLE "entitlements"
      ADD CONSTRAINT "entitlements_paymentId_fkey"
      FOREIGN KEY ("paymentId") REFERENCES "payments"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- ─── Chat persona column ─────────────────────────────────────────────────────
-- Optional "Chat with Astrologer" persona the user selected. Null for
-- legacy/topic-only sessions.
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "astrologerId" TEXT;

-- ─── Monetization default settings ───────────────────────────────────────────
-- Mode A defaults: subscriptions off, pricing page hidden, one-time prices
-- for reports (₹199) and palmistry (₹250), and the social-proof seed.
-- ON CONFLICT DO NOTHING so an operator who already tuned a key in
-- production is never clobbered.
INSERT INTO "site_settings" ("key", "value", "updatedAt") VALUES
  ('feature.subscriptions_enabled', 'false', CURRENT_TIMESTAMP),
  ('feature.pricing_page_enabled',  'false', CURRENT_TIMESTAMP),
  ('pricing.report.price',          '199',   CURRENT_TIMESTAMP),
  ('pricing.palmistry.price',       '250',   CURRENT_TIMESTAMP),
  ('social.report_count_base',      '41345', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
