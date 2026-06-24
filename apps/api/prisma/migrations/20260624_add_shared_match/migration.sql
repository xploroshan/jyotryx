-- Synastry / Kundli-match share: public, shareable snapshots of a match result.
--
-- Stores only the rendered outcome (display names, scores, guna breakdown) keyed
-- by a URL-safe token — never the partners' raw birth details — so a link can be
-- opened by anyone without leaking date/time/place of birth. Purely additive
-- (one new table) and non-blocking on existing rows. All DDL guarded for safe
-- re-runs on a partially-migrated database.

-- ─── shared_matches table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "shared_matches" (
  "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
  "token"          TEXT NOT NULL,
  "createdById"    UUID,
  "personAName"    TEXT NOT NULL,
  "personBName"    TEXT NOT NULL,
  "totalScore"     INTEGER NOT NULL,
  "maxScore"       INTEGER NOT NULL DEFAULT 36,
  "compatibility"  TEXT NOT NULL,
  "recommendation" TEXT NOT NULL,
  "manglikA"       BOOLEAN NOT NULL DEFAULT false,
  "manglikB"       BOOLEAN NOT NULL DEFAULT false,
  "gunaDetails"    JSONB NOT NULL,
  "locale"         VARCHAR(10),
  "viewCount"      INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shared_matches_pkey" PRIMARY KEY ("id")
);

-- Public lookups happen by token; it must be unique.
CREATE UNIQUE INDEX IF NOT EXISTS "shared_matches_token_key"
  ON "shared_matches" ("token");

CREATE INDEX IF NOT EXISTS "shared_matches_createdById_idx"
  ON "shared_matches" ("createdById");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shared_matches_createdById_fkey'
  ) THEN
    ALTER TABLE "shared_matches"
      ADD CONSTRAINT "shared_matches_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
