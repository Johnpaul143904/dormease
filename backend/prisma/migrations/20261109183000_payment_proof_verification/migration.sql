CREATE TYPE "PaymentSubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "Payment"
ADD COLUMN "amountPaid" DECIMAL(10,2) NOT NULL DEFAULT 0;

UPDATE "Payment"
SET "amountPaid" = "amount"
WHERE "paymentStatus" = 'PAID';

CREATE TABLE "PaymentSubmission" (
    "id" SERIAL NOT NULL,
    "paymentId" INTEGER NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "proofFileName" TEXT NOT NULL,
    "proofMimeType" TEXT NOT NULL,
    "proofSize" INTEGER NOT NULL,
    "proofData" BYTEA NOT NULL,
    "status" "PaymentSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionRemarks" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentVerificationHistory" (
    "id" SERIAL NOT NULL,
    "paymentSubmissionId" INTEGER NOT NULL,
    "status" "PaymentSubmissionStatus" NOT NULL,
    "remarks" TEXT,
    "changedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentVerificationHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentSubmission_referenceNumber_key"
ON "PaymentSubmission"("referenceNumber");

CREATE INDEX "PaymentSubmission_paymentId_createdAt_idx"
ON "PaymentSubmission"("paymentId", "createdAt");

CREATE INDEX "PaymentSubmission_tenantId_createdAt_idx"
ON "PaymentSubmission"("tenantId", "createdAt");

CREATE INDEX "PaymentSubmission_status_createdAt_idx"
ON "PaymentSubmission"("status", "createdAt");

CREATE INDEX "PaymentVerificationHistory_paymentSubmissionId_createdAt_idx"
ON "PaymentVerificationHistory"("paymentSubmissionId", "createdAt");

ALTER TABLE "PaymentSubmission"
ADD CONSTRAINT "PaymentSubmission_paymentId_fkey"
FOREIGN KEY ("paymentId") REFERENCES "Payment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentSubmission"
ADD CONSTRAINT "PaymentSubmission_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentSubmission"
ADD CONSTRAINT "PaymentSubmission_verifiedById_fkey"
FOREIGN KEY ("verifiedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentVerificationHistory"
ADD CONSTRAINT "PaymentVerificationHistory_paymentSubmissionId_fkey"
FOREIGN KEY ("paymentSubmissionId") REFERENCES "PaymentSubmission"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentVerificationHistory"
ADD CONSTRAINT "PaymentVerificationHistory_changedById_fkey"
FOREIGN KEY ("changedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
