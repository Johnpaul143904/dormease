CREATE TYPE "InvitationStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'REVOKED', 'REJECTED');

CREATE TABLE "RoomInvitation" (
    "id" SERIAL NOT NULL,
    "roomId" INTEGER NOT NULL,
    "tenantId" INTEGER,
    "code" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RoomInvitation_code_key" ON "RoomInvitation"("code");
CREATE INDEX "RoomInvitation_roomId_idx" ON "RoomInvitation"("roomId");

ALTER TABLE "RoomInvitation"
ADD CONSTRAINT "RoomInvitation_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RoomInvitation"
ADD CONSTRAINT "RoomInvitation_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
