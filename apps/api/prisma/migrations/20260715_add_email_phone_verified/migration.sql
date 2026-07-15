-- Contact-ownership proof for blocking email verification.
--
-- emailVerified gates email/password login; phoneVerified records that a
-- phone passed OTP. Both default false for NEW rows, but every EXISTING
-- account is grandfathered so the new login gate can never lock a current
-- user out:
--   * emailVerified := true for everyone who already has an account.
--   * phoneVerified := true for anyone who already has a phone on file.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneVerified" BOOLEAN NOT NULL DEFAULT false;

-- Grandfather all pre-existing accounts (run once, right after the columns
-- are added — new signups created after this migration start unverified).
UPDATE "User" SET "emailVerified" = true;
UPDATE "User" SET "phoneVerified" = true WHERE "phone" IS NOT NULL;
