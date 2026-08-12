-- CreateTable
CREATE TABLE "Digest" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'DAILY_SUPERVISOR',
    "forDate" DATE NOT NULL,
    "content" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Digest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Digest_type_forDate_key" ON "Digest"("type", "forDate");
