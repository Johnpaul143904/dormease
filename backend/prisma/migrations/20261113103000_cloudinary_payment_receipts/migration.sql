ALTER TABLE "PaymentSubmission"
  ALTER COLUMN "proofData" DROP NOT NULL,
  ADD COLUMN "cloudinaryAssetId" TEXT,
  ADD COLUMN "cloudinaryPublicId" TEXT,
  ADD COLUMN "cloudinarySecureUrl" TEXT,
  ADD COLUMN "cloudinaryResourceType" TEXT,
  ADD COLUMN "cloudinaryFormat" TEXT;

CREATE TABLE "CloudinaryReceiptDeletion" (
  "assetId" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CloudinaryReceiptDeletion_pkey" PRIMARY KEY ("assetId")
);

CREATE INDEX "CloudinaryReceiptDeletion_nextAttemptAt_createdAt_idx"
  ON "CloudinaryReceiptDeletion"("nextAttemptAt", "createdAt");
