-- Drafting becomes a conversation with knobs.
--
-- Additive only, and safe on the shared branch: every new column is nullable
-- except `turn`, whose DEFAULT 1 backfills existing rows to the truth (every
-- draft written before this migration was a first turn). No drops, no renames,
-- no data movement.

-- CreateEnum
CREATE TYPE "DraftAngle" AS ENUM ('pain', 'moment', 'proof');

-- AlterEnum
ALTER TYPE "DraftRequestStatus" ADD VALUE 'superseded';

-- AlterTable
ALTER TABLE "SocialDraftRequest" ADD COLUMN     "angle" "DraftAngle",
ADD COLUMN     "dismissReason" TEXT,
ADD COLUMN     "instruction" TEXT,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "referenceId" TEXT,
ADD COLUMN     "register" INTEGER,
ADD COLUMN     "turn" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "SocialDraftRequest_parentId_idx" ON "SocialDraftRequest"("parentId");

-- CreateIndex
CREATE INDEX "SocialDraftRequest_brand_dismissReason_idx" ON "SocialDraftRequest"("brand", "dismissReason");

-- AddForeignKey
ALTER TABLE "SocialDraftRequest" ADD CONSTRAINT "SocialDraftRequest_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SocialDraftRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialDraftRequest" ADD CONSTRAINT "SocialDraftRequest_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "SocialDraftRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
