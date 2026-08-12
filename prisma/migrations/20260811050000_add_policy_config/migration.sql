-- CreateTable
CREATE TABLE "PolicyConfig" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedByUserId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyConfigAudit" (
    "id" UUID NOT NULL,
    "policyKey" TEXT NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB NOT NULL,
    "version" INTEGER NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyConfigAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PolicyConfig_key_key" ON "PolicyConfig"("key");

-- CreateIndex
CREATE INDEX "PolicyConfigAudit_policyKey_changedAt_idx" ON "PolicyConfigAudit"("policyKey", "changedAt");
