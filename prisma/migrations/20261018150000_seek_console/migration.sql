-- CreateEnum
CREATE TYPE "SeekCommandStatus" AS ENUM ('pending', 'applied', 'failed');

-- CreateTable
CREATE TABLE "SeekInstance" (
    "id" TEXT NOT NULL,
    "lastTickAt" TIMESTAMP(3),
    "state" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeekInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeekItem" (
    "id" TEXT NOT NULL,
    "instance" TEXT NOT NULL,
    "track" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "lane" TEXT,
    "stage" TEXT NOT NULL,
    "tier" TEXT,
    "score" DOUBLE PRECISION,
    "title" TEXT NOT NULL,
    "org" TEXT,
    "country" TEXT,
    "city" TEXT,
    "remote" TEXT,
    "channel" TEXT,
    "beneficiary" TEXT,
    "deadline" TEXT,
    "touch" INTEGER,
    "appliedAt" TIMESTAMP(3),
    "lastTouchAt" TIMESTAMP(3),
    "holdReason" TEXT,
    "sourceUrl" TEXT,
    "recordUrl" TEXT,
    "notes" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "pushedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeekItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeekEvent" (
    "id" TEXT NOT NULL,
    "instance" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "externalId" TEXT NOT NULL DEFAULT '',
    "title" TEXT,
    "lane" TEXT,
    "detail" TEXT,

    CONSTRAINT "SeekEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeekCommand" (
    "id" TEXT NOT NULL,
    "instance" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "externalId" TEXT,
    "payload" JSONB NOT NULL,
    "status" "SeekCommandStatus" NOT NULL DEFAULT 'pending',
    "by" TEXT NOT NULL,
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "SeekCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeekItem_instance_track_stage_idx" ON "SeekItem"("instance", "track", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "SeekItem_instance_externalId_key" ON "SeekItem"("instance", "externalId");

-- CreateIndex
CREATE INDEX "SeekEvent_instance_ts_idx" ON "SeekEvent"("instance", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "SeekEvent_instance_ts_kind_externalId_key" ON "SeekEvent"("instance", "ts", "kind", "externalId");

-- CreateIndex
CREATE INDEX "SeekCommand_instance_status_createdAt_idx" ON "SeekCommand"("instance", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SeekCommand_instance_externalId_idx" ON "SeekCommand"("instance", "externalId");

