-- Add ADMIN_GRANT to the CreditTransactionType enum so the new
-- POST /api/admin/users/:id/credits/grant endpoint can write a typed
-- audit row instead of overloading PURCHASE.
--
-- Postgres' ALTER TYPE … ADD VALUE is a fast catalog-only change but
-- cannot run inside a transaction with other DDL on the same type;
-- `prisma migrate deploy` runs each migration file in its own
-- transaction, so this single-statement file is safe.
ALTER TYPE "CreditTransactionType" ADD VALUE IF NOT EXISTS 'ADMIN_GRANT';
