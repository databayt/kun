-- CreateEnum
CREATE TYPE "MediaBriefStatus" AS ENUM ('pending', 'rendered', 'dismissed');

-- CreateTable
CREATE TABLE "SocialMediaBrief" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "status" "MediaBriefStatus" NOT NULL DEFAULT 'pending',
    "renderedUrl" TEXT,
    "renderedBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "renderedAt" TIMESTAMP(3),

    CONSTRAINT "SocialMediaBrief_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocialMediaBrief_status_createdAt_idx" ON "SocialMediaBrief"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SocialMediaBrief_brand_status_idx" ON "SocialMediaBrief"("brand", "status");
