-- CreateTable: llm_usage
CREATE TABLE IF NOT EXISTS "llm_usage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DECIMAL(12, 6) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "llm_usage_userId_idx" ON "llm_usage"("userId");
CREATE INDEX IF NOT EXISTS "llm_usage_userId_createdAt_idx" ON "llm_usage"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "llm_usage_createdAt_idx" ON "llm_usage"("createdAt");
CREATE INDEX IF NOT EXISTS "llm_usage_provider_model_idx" ON "llm_usage"("provider", "model");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'llm_usage_userId_fkey') THEN
    ALTER TABLE "llm_usage" ADD CONSTRAINT "llm_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
