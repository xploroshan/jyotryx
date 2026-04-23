-- Phase A5a: dosha KB table.
--
-- Backs localizeDoshas() in apps/api/src/modules/astrology/astrology.service.ts
-- so the 4 tracked Vedic doshas stop routing through translateFields. The
-- table holds the fixed per-dosha fields (name, canonical remedies list);
-- dynamic descriptions are composed at render time from placeholder
-- templates in kb_briefing_phrases (dosha.{key}.{branch}).
--
--   * kb_doshas : 4 rows keyed "mangal", "kaal_sarp", "nadi", "pitra".
--                 Payload { name: string, remedies: string[] } — the
--                 remedies list is the canonical 4-item recommendation
--                 per dosha; the service drops it to [] when the dosha
--                 is detected-absent.
--
-- Shape matches every other Kb* table so the existing backfill-locales
-- script picks it up once registered in prisma/seed-kb/index.ts.

CREATE TABLE "kb_doshas" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"        TEXT NOT NULL,
  "tradition"  TEXT,
  "i18n"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kb_doshas_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kb_doshas_key_tradition_key" ON "kb_doshas" ("key", "tradition");
CREATE UNIQUE INDEX "kb_doshas_key_shared_key" ON "kb_doshas" ("key") WHERE "tradition" IS NULL;
