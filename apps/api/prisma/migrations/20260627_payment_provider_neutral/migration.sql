-- Provider-neutral gateway columns: replacing the single-gateway Razorpay
-- integration with Cashfree. Renames the `razorpay*` id columns to gateway-
-- neutral names and adds a `provider` discriminator so historical Razorpay
-- rows (if any) coexist cleanly with new Cashfree rows. Cashfree ids are
-- prefixed `cf_…`, Razorpay ids were `order_…/pay_…/sub_…`, so the unique
-- indexes never collide across providers.
--
-- All statements are guarded so the migration is safe to re-run. Column
-- renames are metadata-only (no data rewrite); index renames preserve the
-- existing index data (no reindex).

-- ── payments: rename id columns ──────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'payments' AND column_name = 'razorpayOrderId') THEN
    ALTER TABLE "payments" RENAME COLUMN "razorpayOrderId" TO "gatewayOrderId";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'payments' AND column_name = 'razorpayPaymentId') THEN
    ALTER TABLE "payments" RENAME COLUMN "razorpayPaymentId" TO "gatewayPaymentId";
  END IF;
END $$;

-- ── payments: rename indexes/constraints to the Prisma-expected names ─────────
ALTER INDEX IF EXISTS "payments_razorpayOrderId_key"   RENAME TO "payments_gatewayOrderId_key";
ALTER INDEX IF EXISTS "payments_razorpayPaymentId_key" RENAME TO "payments_gatewayPaymentId_key";
ALTER INDEX IF EXISTS "payments_razorpayOrderId_idx"   RENAME TO "payments_gatewayOrderId_idx";
ALTER INDEX IF EXISTS "payments_razorpayPaymentId_idx" RENAME TO "payments_gatewayPaymentId_idx";

-- ── payments: provider discriminator ─────────────────────────────────────────
-- Add nullable, backfill every pre-existing row to 'razorpay' (those rows
-- predate Cashfree), then make it NOT NULL DEFAULT 'cashfree' so all new rows
-- are Cashfree.
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "provider" TEXT;
UPDATE "payments" SET "provider" = 'razorpay' WHERE "provider" IS NULL;
ALTER TABLE "payments" ALTER COLUMN "provider" SET DEFAULT 'cashfree';
ALTER TABLE "payments" ALTER COLUMN "provider" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "payments_provider_idx" ON "payments" ("provider");

-- ── subscriptions: rename id column + indexes ────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'subscriptions' AND column_name = 'razorpaySubscriptionId') THEN
    ALTER TABLE "subscriptions" RENAME COLUMN "razorpaySubscriptionId" TO "gatewaySubscriptionId";
  END IF;
END $$;

ALTER INDEX IF EXISTS "subscriptions_razorpaySubscriptionId_key" RENAME TO "subscriptions_gatewaySubscriptionId_key";
ALTER INDEX IF EXISTS "subscriptions_razorpaySubscriptionId_idx" RENAME TO "subscriptions_gatewaySubscriptionId_idx";

-- ── subscriptions: provider discriminator (nullable — referral grants have none) ─
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "provider" TEXT;
UPDATE "subscriptions" SET "provider" = 'razorpay'
  WHERE "gatewaySubscriptionId" IS NOT NULL AND "provider" IS NULL;
