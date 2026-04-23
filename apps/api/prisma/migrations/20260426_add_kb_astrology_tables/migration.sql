-- Phase A4: astrology KB tables.
--
-- Backs the deterministic half of astrology.service.ts so the
-- Chinese zodiac, medical body-zodiac, Flying Stars, Panchang
-- (Karana), Muhurat fallback, and Sade Sati callsites stop routing
-- through translateFields().
--
--   * kb_zodiac_signs     : rows keyed by Western zodiac name — "Aries"..
--                           "Pisces" (12 rows). Payload
--                           { name, element, modality, bodyParts[],
--                             guidance }. Powers medical-body-zodiac
--                           today; future astrology flips (horary,
--                           zodiacal-releasing, decumbiture) will lean
--                           on the same table.
--   * kb_chinese_animals  : rows keyed by the 12 Chinese animals
--                           ("Rat".."Pig"). Payload { traits[] }.
--   * kb_flying_stars     : rows keyed "1".."9". Payload { meaning }.
--   * kb_karanas          : rows keyed by Karana name (11 rows:
--                           "Bava".."Kimstughna"). Payload { name }.
--                           Completes the Panchang KB set — Tithi /
--                           Yoga / Vara / Nakshatra / Paksha already
--                           shipped in 20260422.
--
-- Shape matches every other Kb* table so the existing backfill-locales
-- script picks them up automatically once registered in
-- prisma/seed-kb/index.ts.

-- ─── KbZodiacSign ───────────────────────────────────────────────────────────
CREATE TABLE "kb_zodiac_signs" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"        TEXT NOT NULL,
  "tradition"  TEXT,
  "i18n"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kb_zodiac_signs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kb_zodiac_signs_key_tradition_key" ON "kb_zodiac_signs" ("key", "tradition");
CREATE UNIQUE INDEX "kb_zodiac_signs_key_shared_key" ON "kb_zodiac_signs" ("key") WHERE "tradition" IS NULL;
CREATE INDEX "kb_zodiac_signs_tradition_idx" ON "kb_zodiac_signs" ("tradition");

-- ─── KbChineseAnimal ────────────────────────────────────────────────────────
CREATE TABLE "kb_chinese_animals" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"        TEXT NOT NULL,
  "tradition"  TEXT,
  "i18n"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kb_chinese_animals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kb_chinese_animals_key_tradition_key" ON "kb_chinese_animals" ("key", "tradition");
CREATE UNIQUE INDEX "kb_chinese_animals_key_shared_key" ON "kb_chinese_animals" ("key") WHERE "tradition" IS NULL;

-- ─── KbFlyingStar ───────────────────────────────────────────────────────────
CREATE TABLE "kb_flying_stars" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"        TEXT NOT NULL,
  "tradition"  TEXT,
  "i18n"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kb_flying_stars_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kb_flying_stars_key_tradition_key" ON "kb_flying_stars" ("key", "tradition");
CREATE UNIQUE INDEX "kb_flying_stars_key_shared_key" ON "kb_flying_stars" ("key") WHERE "tradition" IS NULL;

-- ─── KbKarana ───────────────────────────────────────────────────────────────
CREATE TABLE "kb_karanas" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"        TEXT NOT NULL,
  "tradition"  TEXT,
  "i18n"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kb_karanas_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kb_karanas_key_tradition_key" ON "kb_karanas" ("key", "tradition");
CREATE UNIQUE INDEX "kb_karanas_key_shared_key" ON "kb_karanas" ("key") WHERE "tradition" IS NULL;
