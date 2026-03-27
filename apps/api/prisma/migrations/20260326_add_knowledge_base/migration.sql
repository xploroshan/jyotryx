-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "text" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "topic" TEXT,
    "source" TEXT,
    "embedding" JSONB,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_documents_category_idx" ON "knowledge_documents"("category");
CREATE INDEX "knowledge_documents_category_topic_idx" ON "knowledge_documents"("category", "topic");
