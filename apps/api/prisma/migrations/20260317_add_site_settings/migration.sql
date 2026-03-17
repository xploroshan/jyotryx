-- CreateTable
CREATE TABLE "site_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("key")
);

-- Seed default pricing
INSERT INTO "site_settings" ("key", "value", "updatedAt") VALUES
    ('pricing.monthly.price', '499', NOW()),
    ('pricing.annual.price', '4999', NOW()),
    ('pricing.credits.starter.credits', '25', NOW()),
    ('pricing.credits.starter.price', '99', NOW()),
    ('pricing.credits.popular.credits', '75', NOW()),
    ('pricing.credits.popular.price', '249', NOW()),
    ('pricing.credits.pro.credits', '200', NOW()),
    ('pricing.credits.pro.price', '599', NOW())
ON CONFLICT ("key") DO NOTHING;
