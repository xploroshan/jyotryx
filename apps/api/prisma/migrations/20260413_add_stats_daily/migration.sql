-- CreateTable: stats_daily for pre-aggregated admin dashboard metrics
CREATE TABLE IF NOT EXISTS "stats_daily" (
    "date"                DATE         NOT NULL,
    "totalUsers"          INTEGER      NOT NULL DEFAULT 0,
    "newUsers"            INTEGER      NOT NULL DEFAULT 0,
    "premiumUsers"        INTEGER      NOT NULL DEFAULT 0,
    "activeSubscriptions" INTEGER      NOT NULL DEFAULT 0,
    "totalRevenue"        DECIMAL(12,2) NOT NULL DEFAULT 0,
    "dailyRevenue"        DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalSessions"       INTEGER      NOT NULL DEFAULT 0,
    "dailySessions"       INTEGER      NOT NULL DEFAULT 0,
    "creditsConsumed"     INTEGER      NOT NULL DEFAULT 0,
    "kundliCount"         INTEGER      NOT NULL DEFAULT 0,
    "matchingCount"       INTEGER      NOT NULL DEFAULT 0,
    "palmistryCount"      INTEGER      NOT NULL DEFAULT 0,
    "reportCount"         INTEGER      NOT NULL DEFAULT 0,
    "tarotCount"          INTEGER      NOT NULL DEFAULT 0,
    "llmCalls"            INTEGER      NOT NULL DEFAULT 0,
    "llmCostUsd"          DECIMAL(12,6) NOT NULL DEFAULT 0,
    "llmTokens"           INTEGER      NOT NULL DEFAULT 0,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stats_daily_pkey" PRIMARY KEY ("date")
);
