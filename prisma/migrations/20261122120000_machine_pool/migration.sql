-- AlterTable
ALTER TABLE "Machine" ADD COLUMN     "resources" JSONB,
ADD COLUMN     "share" JSONB;

-- CreateTable
CREATE TABLE "ComputeJob" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "requester" TEXT NOT NULL,
    "target" TEXT,
    "donor" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "inputs" JSONB NOT NULL,
    "outputs" JSONB,
    "needs" JSONB,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "log" TEXT NOT NULL DEFAULT '',
    "claims" INTEGER NOT NULL DEFAULT 0,
    "lastProgressAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ComputeJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComputeJob_status_idx" ON "ComputeJob"("status");

-- CreateIndex
CREATE INDEX "ComputeJob_requester_idx" ON "ComputeJob"("requester");

