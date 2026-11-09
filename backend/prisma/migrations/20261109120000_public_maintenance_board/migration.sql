ALTER TYPE "MaintenanceStatus" ADD VALUE 'APPROVED';
ALTER TYPE "MaintenanceStatus" ADD VALUE 'REJECTED';

ALTER TABLE "MaintenanceRequest"
ADD COLUMN "announcementTitle" TEXT,
ADD COLUMN "announcementDescription" TEXT,
ADD COLUMN "publicLocation" TEXT,
ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "MaintenanceRequest_status_updatedAt_idx"
ON "MaintenanceRequest"("status", "updatedAt");

CREATE TABLE "MaintenanceStatusHistory" (
    "id" SERIAL NOT NULL,
    "maintenanceRequestId" INTEGER NOT NULL,
    "status" "MaintenanceStatus" NOT NULL,
    "note" TEXT,
    "changedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MaintenanceStatusHistory_maintenanceRequestId_createdAt_idx"
ON "MaintenanceStatusHistory"("maintenanceRequestId", "createdAt");

ALTER TABLE "MaintenanceStatusHistory"
ADD CONSTRAINT "MaintenanceStatusHistory_maintenanceRequestId_fkey"
FOREIGN KEY ("maintenanceRequestId") REFERENCES "MaintenanceRequest"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MaintenanceStatusHistory"
ADD CONSTRAINT "MaintenanceStatusHistory_changedById_fkey"
FOREIGN KEY ("changedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "MaintenanceStatusHistory" ("maintenanceRequestId", "status", "createdAt")
SELECT "id", "status", "createdAt"
FROM "MaintenanceRequest";
