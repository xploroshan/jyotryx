-- Phase A3b: report KB table.
--
-- Single table backing the fallback path in apps/api/src/modules/report/
-- report.service.ts and apps/api/src/queue/report.processor.ts. The
-- normal LLM-generation path is already locale-aware via
-- getLocaleInstruction(locale) in the system prompt, so no new schema
-- is needed for that path.
--
--   * kb_report_sections : rows keyed "{TYPE}:{order}" — e.g.
--                          "LIFE:1", "CAREER:6", "PALM:3". Payload
--                          { title, content }. Content uses a single
--                          {name} placeholder that the service
--                          substitutes at render time. 36 rows at
--                          steady state (6 report types × 6 sections).
--
-- Shape matches every other Kb* table so backfill-locales picks it up
-- once registered in prisma/seed-kb/index.ts.

CREATE TABLE "kb_report_sections" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "key"        TEXT NOT NULL,
  "tradition"  TEXT,
  "i18n"       JSONB NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kb_report_sections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "kb_report_sections_key_tradition_key" ON "kb_report_sections" ("key", "tradition");
CREATE UNIQUE INDEX "kb_report_sections_key_shared_key" ON "kb_report_sections" ("key") WHERE "tradition" IS NULL;
