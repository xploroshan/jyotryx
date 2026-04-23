-- Phase A2b: numerology KB tables.
--
-- Three narrow entity tables backing numerology.service.ts so analyzeName,
-- analyzeBrand, and getPersonalYear stop calling translateFields.
--
--   * kb_number_meanings      : rows keyed by the numerology number as a
--                               string ("1".."9","11","22","33"). Payload
--                               { planet, meaning, strengths[], cautions[],
--                                 colors[], days[] } mirrors the inline
--                               NUMBER_MEANINGS map.
--   * kb_business_sectors     : rows keyed "1".."9". Payload
--                               { suitable[], avoid[] } mirrors BUSINESS_SECTORS.
--   * kb_personal_year_themes : rows keyed "1".."9". Payload
--                               { theme, description, career, finance,
--                                 relationships, health } mirrors the inline
--                               themes map in getPersonalYear.
--
-- Shape matches every other Kb* table so the existing backfill-locales
-- script picks them up automatically once registered in
-- prisma/seed-kb/index.ts.

-- ─── KbNumberMeaning ────────────────────────────────────────────────────────
CREATE TABLE "kb_number_meanings" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"        TEXT NOT NULL,
  "tradition"  TEXT,
  "i18n"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kb_number_meanings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kb_number_meanings_key_tradition_key" ON "kb_number_meanings" ("key", "tradition");
CREATE UNIQUE INDEX "kb_number_meanings_key_shared_key" ON "kb_number_meanings" ("key") WHERE "tradition" IS NULL;

-- ─── KbBusinessSector ───────────────────────────────────────────────────────
CREATE TABLE "kb_business_sectors" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"        TEXT NOT NULL,
  "tradition"  TEXT,
  "i18n"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kb_business_sectors_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kb_business_sectors_key_tradition_key" ON "kb_business_sectors" ("key", "tradition");
CREATE UNIQUE INDEX "kb_business_sectors_key_shared_key" ON "kb_business_sectors" ("key") WHERE "tradition" IS NULL;

-- ─── KbPersonalYearTheme ────────────────────────────────────────────────────
CREATE TABLE "kb_personal_year_themes" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"        TEXT NOT NULL,
  "tradition"  TEXT,
  "i18n"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kb_personal_year_themes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kb_personal_year_themes_key_tradition_key" ON "kb_personal_year_themes" ("key", "tradition");
CREATE UNIQUE INDEX "kb_personal_year_themes_key_shared_key" ON "kb_personal_year_themes" ("key") WHERE "tradition" IS NULL;
