-- Full drafts + review queue: media on both the draft ask and the variant,
-- and the two terminal review verdicts on the draft lifecycle.
--
-- Additive only — the shared Neon DB serves prod while this applies. The new
-- enum values are not written by any code until the review-queue actions
-- deploy, and old clients ignore columns they never select.

-- AlterEnum
ALTER TYPE "DraftRequestStatus" ADD VALUE 'consumed';
ALTER TYPE "DraftRequestStatus" ADD VALUE 'dismissed';

-- AlterTable
ALTER TABLE "SocialVariant" ADD COLUMN "mediaUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "SocialDraftRequest" ADD COLUMN "mediaUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill: every legacy single-media variant becomes a one-element array, so
-- readers can go mediaUrls-first without a fallback ever missing live rows.
UPDATE "SocialVariant" SET "mediaUrls" = ARRAY["mediaUrl"]
 WHERE "mediaUrl" IS NOT NULL AND "mediaUrl" <> '';
