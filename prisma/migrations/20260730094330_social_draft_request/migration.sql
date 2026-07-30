-- CreateEnum
CREATE TYPE "DraftRequestStatus" AS ENUM ('pending', 'answered', 'failed');

-- CreateTable
CREATE TABLE "SocialDraftRequest" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "requestedBy" TEXT,
    "status" "DraftRequestStatus" NOT NULL DEFAULT 'pending',
    "ar" TEXT,
    "en" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "SocialDraftRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocialDraftRequest_status_createdAt_idx" ON "SocialDraftRequest"("status", "createdAt");
