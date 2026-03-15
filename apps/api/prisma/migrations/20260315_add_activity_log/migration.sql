-- CreateEnum
CREATE TYPE "AdminAction" AS ENUM ('USER_UPDATE', 'USER_DELETE', 'USER_CREDITS_UPDATE', 'USER_ROLE_CHANGE', 'SUBSCRIPTION_CANCEL', 'SUBSCRIPTION_UPDATE');

-- CreateTable
CREATE TABLE "activity_logs" (
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

-- CreateIndex
CREATE INDEX "activity_logs_adminId_idx" ON "activity_logs"("adminId");
CREATE INDEX "activity_logs_entityType_entityId_idx" ON "activity_logs"("entityType", "entityId");
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");
