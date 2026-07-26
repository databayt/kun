-- CreateEnum
CREATE TYPE "VariantStatus" AS ENUM ('draft', 'pending', 'approved', 'scheduled', 'publishing', 'published', 'failed', 'rejected');

-- CreateTable
CREATE TABLE "SocialPiece" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "source" TEXT NOT NULL DEFAULT 'human',
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialPiece_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialVariant" (
    "id" TEXT NOT NULL,
    "pieceId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "status" "VariantStatus" NOT NULL DEFAULT 'draft',
    "scheduledFor" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "result" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialMetric" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocialPiece_brand_createdAt_idx" ON "SocialPiece"("brand", "createdAt");

-- CreateIndex
CREATE INDEX "SocialVariant_status_scheduledFor_idx" ON "SocialVariant"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "SocialVariant_pieceId_idx" ON "SocialVariant"("pieceId");

-- CreateIndex
CREATE INDEX "SocialMetric_variantId_fetchedAt_idx" ON "SocialMetric"("variantId", "fetchedAt");

-- AddForeignKey
ALTER TABLE "SocialVariant" ADD CONSTRAINT "SocialVariant_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "SocialPiece"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialMetric" ADD CONSTRAINT "SocialMetric_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "SocialVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
