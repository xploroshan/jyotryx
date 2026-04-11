-- GIN index for fast array-contains queries on knowledge_documents.keywords
-- Replaces the seq-scan that occurs on: WHERE keywords @> ARRAY['...']
CREATE INDEX IF NOT EXISTS "knowledge_documents_keywords_gin"
  ON "knowledge_documents" USING GIN ("keywords");
