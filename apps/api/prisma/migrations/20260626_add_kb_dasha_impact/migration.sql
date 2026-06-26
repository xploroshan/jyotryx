-- Placement library (1/N): Vimshottari mahadasha impact KB table.
--
-- First of the "placement interpretation" tables that let the interpretation
-- endpoint assemble a plain-language reading from the KB instead of calling the
-- LLM. A mahadasha maps to exactly one ruling planet, so the dasha domain needs
-- just 9 rows — keyed by the canonical English lord ("Sun".."Saturn", "Rahu",
-- "Ketu"). Payload mirrors the InterpretationResult shape so the service can
-- return it verbatim:
--
--   kb_dasha_impacts : 9 rows. Payload
--                      { summary: string, points: string[], guidance: string }.
--
-- Shape matches every other Kb* table, so the backfill-locales script fills the
-- 11 non-English locales once this is registered in prisma/seed-kb/index.ts.
-- Until then InterpretationService.tryKb serves KB only for locales that match
-- exactly (renderStatus().matched) and falls back to the LLM otherwise — so
-- non-English users keep localized output with no regression.

CREATE TABLE "kb_dasha_impacts" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"        TEXT NOT NULL,
  "tradition"  TEXT,
  "i18n"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kb_dasha_impacts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kb_dasha_impacts_key_tradition_key" ON "kb_dasha_impacts" ("key", "tradition");
CREATE UNIQUE INDEX "kb_dasha_impacts_key_shared_key" ON "kb_dasha_impacts" ("key") WHERE "tradition" IS NULL;
