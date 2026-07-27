-- CreateTable
CREATE TABLE "SystemHeartbeat" (
    "key" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "detail" TEXT,

    CONSTRAINT "SystemHeartbeat_pkey" PRIMARY KEY ("key")
);
