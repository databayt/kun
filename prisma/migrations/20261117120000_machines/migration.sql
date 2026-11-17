-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "os" TEXT NOT NULL DEFAULT '',
    "appVersion" TEXT NOT NULL DEFAULT '',
    "tokenHash" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "health" JSONB,
    "repos" JSONB,
    "currentTask" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MachineMessage" (
    "id" TEXT NOT NULL,
    "toLogin" TEXT NOT NULL,
    "fromLogin" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "MachineMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Machine_login_key" ON "Machine"("login");

-- CreateIndex
CREATE UNIQUE INDEX "Machine_tokenHash_key" ON "Machine"("tokenHash");

-- CreateIndex
CREATE INDEX "MachineMessage_toLogin_readAt_idx" ON "MachineMessage"("toLogin", "readAt");

