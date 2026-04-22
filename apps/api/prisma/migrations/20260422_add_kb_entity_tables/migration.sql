-- Phase B1: structured Knowledge Base tables (Kb*).
--
-- Additive only — no changes to existing tables. Each Kb* row carries:
--   * `key`        canonical English identifier (e.g. "Sun", "Ashwini")
--   * `tradition`  nullable; null = shared across traditions
--   * `i18n`       JSONB payload, shape `{en: {...}, hi: {...}, ...}`,
--                  integrity-tested by apps/api/src/knowledge/__tests__/integrity.spec.ts
--   * timestamps
--
-- Unique index is on (key, tradition) so the same key can appear once
-- for shared (tradition IS NULL) and once per tradition-specific row.
-- Postgres treats NULLs as distinct in a UNIQUE index, so we also add a
-- partial UNIQUE index for the shared case.

-- ─── KbPlanet ───────────────────────────────────────────────────────────────
CREATE TABLE "kb_planets" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"        TEXT NOT NULL,
  "tradition"  TEXT,
  "i18n"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kb_planets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kb_planets_key_tradition_key" ON "kb_planets" ("key", "tradition");
CREATE UNIQUE INDEX "kb_planets_key_shared_key" ON "kb_planets" ("key") WHERE "tradition" IS NULL;
CREATE INDEX "kb_planets_tradition_idx" ON "kb_planets" ("tradition");

-- ─── KbNakshatra ────────────────────────────────────────────────────────────
CREATE TABLE "kb_nakshatras" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"        TEXT NOT NULL,
  "tradition"  TEXT,
  "i18n"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kb_nakshatras_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kb_nakshatras_key_tradition_key" ON "kb_nakshatras" ("key", "tradition");
CREATE UNIQUE INDEX "kb_nakshatras_key_shared_key" ON "kb_nakshatras" ("key") WHERE "tradition" IS NULL;

-- ─── KbTithi ────────────────────────────────────────────────────────────────
CREATE TABLE "kb_tithis" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"        TEXT NOT NULL,
  "tradition"  TEXT,
  "i18n"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kb_tithis_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kb_tithis_key_tradition_key" ON "kb_tithis" ("key", "tradition");
CREATE UNIQUE INDEX "kb_tithis_key_shared_key" ON "kb_tithis" ("key") WHERE "tradition" IS NULL;

-- ─── KbYoga ─────────────────────────────────────────────────────────────────
CREATE TABLE "kb_yogas" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"        TEXT NOT NULL,
  "tradition"  TEXT,
  "i18n"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kb_yogas_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kb_yogas_key_tradition_key" ON "kb_yogas" ("key", "tradition");
CREATE UNIQUE INDEX "kb_yogas_key_shared_key" ON "kb_yogas" ("key") WHERE "tradition" IS NULL;

-- ─── KbVara ─────────────────────────────────────────────────────────────────
CREATE TABLE "kb_varas" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"        TEXT NOT NULL,
  "tradition"  TEXT,
  "i18n"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kb_varas_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kb_varas_key_tradition_key" ON "kb_varas" ("key", "tradition");
CREATE UNIQUE INDEX "kb_varas_key_shared_key" ON "kb_varas" ("key") WHERE "tradition" IS NULL;

-- ─── KbPaksha ───────────────────────────────────────────────────────────────
CREATE TABLE "kb_pakshas" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"        TEXT NOT NULL,
  "tradition"  TEXT,
  "i18n"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kb_pakshas_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kb_pakshas_key_tradition_key" ON "kb_pakshas" ("key", "tradition");
CREATE UNIQUE INDEX "kb_pakshas_key_shared_key" ON "kb_pakshas" ("key") WHERE "tradition" IS NULL;
