-- CreateEnum
CREATE TYPE "ChangeProposalType" AS ENUM ('PROMPT', 'WEIGHT', 'THRESHOLD', 'PLAYBOOK', 'SEQUENCE');

-- CreateEnum
CREATE TYPE "ChangeProposalRisk" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ChangeProposalStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "ChangeProposal" (
    "id" UUID NOT NULL,
    "agentRunId" UUID,
    "type" "ChangeProposalType" NOT NULL,
    "currentVersion" TEXT NOT NULL,
    "proposal" TEXT NOT NULL,
    "evidence" TEXT[],
    "expectedImpact" TEXT NOT NULL,
    "risk" "ChangeProposalRisk" NOT NULL,
    "requiresOfflineEval" BOOLEAN NOT NULL DEFAULT true,
    "status" "ChangeProposalStatus" NOT NULL DEFAULT 'PROPOSED',
    "reviewerUserId" TEXT,
    "decisionReason" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChangeProposal_status_createdAt_idx" ON "ChangeProposal"("status", "createdAt");
