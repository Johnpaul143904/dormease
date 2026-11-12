ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;

ALTER TABLE "User" ADD COLUMN "clerkUserId" TEXT;

CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");
