CREATE TABLE "ClerkIdentity" (
    "clerkUserId" TEXT NOT NULL,
    "email" TEXT,
    "fullName" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "clerkUpdatedAt" TIMESTAMP(3),
    "lastEventAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClerkIdentity_pkey" PRIMARY KEY ("clerkUserId")
);

CREATE TABLE "ClerkWebhookEvent" (
    "eventId" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClerkWebhookEvent_pkey" PRIMARY KEY ("eventId")
);

CREATE INDEX "ClerkWebhookEvent_clerkUserId_eventAt_idx"
    ON "ClerkWebhookEvent"("clerkUserId", "eventAt");
