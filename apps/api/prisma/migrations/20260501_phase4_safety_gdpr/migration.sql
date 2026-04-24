-- Phase 4 safety + GDPR tables.
--
-- `flagged_messages` holds OpenAI moderation hits on chat messages.
-- `gdpr_requests` tracks GDPR export/delete requests with a 30-day SLA.
--
-- Neither table carries a FK to users/chat_messages: chat_messages is a
-- partitioned table (cross-partition FKs are disallowed), and a GDPR
-- request may legitimately outlive its user row once fulfilled —
-- entity deletion is the whole point. Column names stay camelCase to
-- match the convention the users / stats_daily tables established.

CREATE TABLE "flagged_messages" (
    "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
    "messageId"  UUID         NOT NULL,
    "userId"     UUID         NOT NULL,
    "categories" TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
    "scores"     JSONB        NOT NULL,
    "status"     VARCHAR(16)  NOT NULL DEFAULT 'pending',
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flagged_messages_pkey" PRIMARY KEY ("id")
);

-- Status + createdAt index targets the "show me pending items, oldest
-- first" pagination the Safety tab does. Partial on pending status
-- keeps the index tiny — resolved rows don't need to be indexed for
-- the queue view.
CREATE INDEX "flagged_messages_status_createdAt_idx"
    ON "flagged_messages" ("status", "createdAt");

CREATE TABLE "gdpr_requests" (
    "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
    "userId"       UUID         NOT NULL,
    "type"         VARCHAR(16)  NOT NULL,
    "status"       VARCHAR(16)  NOT NULL DEFAULT 'pending',
    "dueBy"        TIMESTAMP(3) NOT NULL,
    "fulfilledAt"  TIMESTAMP(3),
    "adminId"      UUID,
    "note"         TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gdpr_requests_pkey" PRIMARY KEY ("id")
);

-- status + dueBy index so the admin tab can cheaply sort pending
-- requests by "closest to breach" without a sequential scan.
CREATE INDEX "gdpr_requests_status_dueBy_idx"
    ON "gdpr_requests" ("status", "dueBy");
