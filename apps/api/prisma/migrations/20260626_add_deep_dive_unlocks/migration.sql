-- Deep-dive interpretation unlocks.
--
-- One row per (user, feature-result) the user has paid to unlock the long-form
-- "deep dive" interpretation for. `inputHash` is a stable hash of the domain +
-- result payload, so re-opening the SAME chart's deep dive is free (no
-- re-charge) while a different result is a fresh unlock. Purely additive and
-- guarded for safe re-runs.

CREATE TABLE IF NOT EXISTS "deep_dive_unlocks" (
  "id"        UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId"    UUID NOT NULL,
  "domain"    TEXT NOT NULL,
  "inputHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "deep_dive_unlocks_pkey" PRIMARY KEY ("id")
);

-- One unlock per (user, domain, result) — also the idempotency key for create.
CREATE UNIQUE INDEX IF NOT EXISTS "deep_dive_unlocks_userId_domain_inputHash_key"
  ON "deep_dive_unlocks" ("userId", "domain", "inputHash");

CREATE INDEX IF NOT EXISTS "deep_dive_unlocks_userId_idx"
  ON "deep_dive_unlocks" ("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deep_dive_unlocks_userId_fkey'
  ) THEN
    ALTER TABLE "deep_dive_unlocks"
      ADD CONSTRAINT "deep_dive_unlocks_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
