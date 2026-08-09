-- Vector KB: per-chunk locale.
--
-- The corpus is English-authored and the table had no locale column at all,
-- so a Hindi chat query retrieved English chunks which were then handed to a
-- model instructed to answer in Hindi. That works, but it grounds the answer
-- in a language the user did not ask for and wastes the translation the
-- structured Kb* tables already do properly.
--
-- Defaulted to 'en' so every existing row stays valid and searchable with no
-- backfill. search() prefers the requested locale and falls back to 'en',
-- so behaviour is unchanged until translated chunks are actually inserted.

ALTER TABLE "knowledge_documents"
  ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'en';

CREATE INDEX IF NOT EXISTS "knowledge_documents_category_locale_idx"
  ON "knowledge_documents" ("category", "locale");
