-- Memory: persistent personalization for the AI astrologer.
--
-- Stores durable facts, stated preferences, goals and life events a user
-- shares so readings can recall "what you told me before" across sessions.
-- Purely additive (one new table) and non-blocking on existing rows. All DDL
-- guarded for safe re-runs on a partially-migrated database.

-- ─── user_memories table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "user_memories" (
  "id"        UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId"    UUID NOT NULL,
  "kind"      TEXT NOT NULL DEFAULT 'fact',
  "content"   TEXT NOT NULL,
  "source"    TEXT NOT NULL DEFAULT 'user',
  "pinned"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_memories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "user_memories_userId_idx"
  ON "user_memories" ("userId");

-- Hot path: list a user's memories newest-first.
CREATE INDEX IF NOT EXISTS "user_memories_userId_createdAt_idx"
  ON "user_memories" ("userId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_memories_userId_fkey'
  ) THEN
    ALTER TABLE "user_memories"
      ADD CONSTRAINT "user_memories_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
