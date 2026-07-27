-- AlterTable
ALTER TABLE "SocialMetric" ADD COLUMN     "comments" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reactions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shares" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "views" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SocialVariant" ADD COLUMN     "metricsAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "metricsError" TEXT,
ADD COLUMN     "metricsFetchedAt" TIMESTAMP(3),
ADD COLUMN     "metricsGaveUp" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "SocialVariant_status_metricsFetchedAt_idx" ON "SocialVariant"("status", "metricsFetchedAt");
