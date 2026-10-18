-- Calendar slot, feature, channel and shape on drafts; feature and kind on media.
-- Additive only: every new column is nullable or defaulted.
ALTER TABLE "SocialDraftRequest" ADD COLUMN "slot" TEXT;
ALTER TABLE "SocialDraftRequest" ADD COLUMN "feature" TEXT;
ALTER TABLE "SocialDraftRequest" ADD COLUMN "channel" TEXT;
ALTER TABLE "SocialDraftRequest" ADD COLUMN "shape" TEXT;
CREATE INDEX "SocialDraftRequest_brand_slot_idx" ON "SocialDraftRequest"("brand", "slot");

ALTER TABLE "SocialMediaBrief" ADD COLUMN "feature" TEXT;
ALTER TABLE "SocialMediaBrief" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'image';

-- Backfill: drafts the queue loader filed carry their slot in requestedBy.
UPDATE "SocialDraftRequest"
SET "slot" = substring("requestedBy" from 7)
WHERE "requestedBy" LIKE 'queue:%#%' AND "slot" IS NULL;
