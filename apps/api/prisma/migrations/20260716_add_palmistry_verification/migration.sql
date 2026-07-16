-- Palmistry authenticity: content hash of the analysed image (uniqueness /
-- duplicate detection) + the verification id printed on the report.
ALTER TABLE "palmistry_readings" ADD COLUMN "imageSha256" CHAR(64);
ALTER TABLE "palmistry_readings" ADD COLUMN "verificationId" TEXT;

CREATE UNIQUE INDEX "palmistry_readings_verificationId_key" ON "palmistry_readings"("verificationId");
CREATE INDEX "palmistry_readings_userId_imageSha256_idx" ON "palmistry_readings"("userId", "imageSha256");
