-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "AdminAction" AS ENUM ('USER_UPDATE', 'USER_DELETE', 'USER_CREDITS_UPDATE', 'USER_ROLE_CHANGE', 'SUBSCRIPTION_CANCEL', 'SUBSCRIPTION_UPDATE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "activity_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "adminId" UUID NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "action" "AdminAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID NOT NULL,
    "entityLabel" TEXT,
    "previousData" JSONB,
    "newData" JSONB,
    "undone" BOOLEAN NOT NULL DEFAULT false,
    "undoneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "activity_logs_adminId_idx" ON "activity_logs"("adminId");
CREATE INDEX IF NOT EXISTS "activity_logs_entityType_entityId_idx" ON "activity_logs"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");
