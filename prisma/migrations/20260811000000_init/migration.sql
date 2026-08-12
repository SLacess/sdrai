-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('DISCOVERED', 'RESEARCHING', 'QUALIFIED_ACCOUNT', 'NURTURE_ACCOUNT', 'DISQUALIFIED_ACCOUNT', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "LeadState" AS ENUM ('IDENTIFIED', 'VERIFIED', 'READY_FOR_OUTREACH', 'IN_SEQUENCE', 'ENGAGED', 'POSITIVE_REPLY', 'QUALIFYING', 'SQL', 'MEETING_BOOKED', 'NURTURE', 'NOT_INTERESTED', 'DO_NOT_CONTACT', 'INVALID');

-- CreateEnum
CREATE TYPE "OpportunityStage" AS ENUM ('PRE_OPPORTUNITY', 'QUALIFIED_OPPORTUNITY', 'DEMO_SCHEDULED', 'DISCOVERY_COMPLETE', 'PROPOSAL_REQUIRED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "PriorityBand" AS ENUM ('A', 'B', 'C', 'BELOW_THRESHOLD');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'EDITED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('GREEN', 'YELLOW', 'RED');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'PARTIAL', 'BLOCKED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('INBOUND', 'OUTBOUND', 'INTERNAL');

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('EMAIL', 'LINKEDIN', 'PHONE', 'WHATSAPP', 'CALENDAR', 'INTERNAL', 'WEB');

-- CreateEnum
CREATE TYPE "ChannelStatus" AS ENUM ('UNKNOWN', 'UNVERIFIED', 'VERIFIED', 'INVALID', 'BOUNCED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "EnrollmentState" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'QUEUED', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'REPLIED', 'BOUNCED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EvidenceSourceType" AS ENUM ('WEBSITE', 'PUBLIC_API', 'SEARCH_PROVIDER', 'CRM', 'INTERNAL_KNOWLEDGE', 'HUMAN', 'AUTOMATED_SCAN', 'OTHER');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('ACCOUNT', 'CONTACT', 'OPPORTUNITY', 'MESSAGE', 'CAMPAIGN', 'KNOWLEDGE_ITEM');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('SYSTEM', 'AGENT', 'USER', 'N8N', 'PROVIDER');

-- CreateEnum
CREATE TYPE "SuppressionScope" AS ENUM ('ADDRESS', 'DOMAIN', 'CONTACT', 'ACCOUNT');

-- CreateEnum
CREATE TYPE "IntentType" AS ENUM ('UNKNOWN', 'NEUTRAL', 'INTERESTED', 'POSITIVE_REPLY', 'READY_TO_BUY', 'REQUEST_INFO', 'REQUEST_DEMO', 'REQUEST_MEETING', 'OBJECTION', 'NOT_NOW', 'NOT_INTERESTED', 'OPT_OUT', 'PROCUREMENT', 'LEGAL', 'SECURITY', 'PRICING');

-- CreateEnum
CREATE TYPE "SentimentType" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE', 'MIXED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PolicyOutcome" AS ENUM ('ALLOW', 'REQUIRE_APPROVAL', 'BLOCK');

-- CreateEnum
CREATE TYPE "KnowledgeApprovalState" AS ENUM ('DRAFT', 'APPROVED', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "KnowledgeType" AS ENUM ('PRODUCT_TRUTH', 'PRICING_PACKAGING', 'ACCESSIBILITY_TRUTH', 'LEGAL_COMPLIANCE', 'CASE_LIBRARY', 'OBJECTION_LIBRARY', 'PERSONA_PLAYBOOK', 'VERTICAL_PLAYBOOK', 'VOICE_STYLE', 'PROPOSAL_COMPONENT');

-- CreateEnum
CREATE TYPE "ScoreType" AS ENUM ('ACCOUNT_PRIORITY', 'ACCESSIBILITY_OPPORTUNITY', 'CONTACT_QUALITY', 'ENGAGEMENT', 'OPPORTUNITY');

-- CreateTable
CREATE TABLE "Account" (
    "id" UUID NOT NULL,
    "legalName" TEXT,
    "brandName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "country" TEXT,
    "sector" TEXT,
    "employeeBand" TEXT,
    "revenueBand" TEXT,
    "status" "AccountStatus" NOT NULL DEFAULT 'DISCOVERED',
    "priorityBand" "PriorityBand",
    "ownerUserId" TEXT,
    "hubspotId" TEXT,
    "isVip" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastResearchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountSignal" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "sourceUrl" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" DOUBLE PRECISION NOT NULL,
    "rawExcerpt" TEXT,
    "contentHash" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" UUID NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "claim" TEXT NOT NULL,
    "sourceType" "EvidenceSourceType" NOT NULL,
    "sourceUri" TEXT,
    "sourceTitle" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" DOUBLE PRECISION NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "contentHash" TEXT,
    "rawExcerpt" TEXT,
    "metadata" JSONB,
    "accountId" UUID,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "title" TEXT,
    "department" TEXT,
    "email" TEXT,
    "linkedinUrl" TEXT,
    "roleInBuyingCommittee" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "leadState" "LeadState" NOT NULL DEFAULT 'IDENTIFIED',
    "hubspotId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactChannel" (
    "id" UUID NOT NULL,
    "contactId" UUID NOT NULL,
    "channel" "ChannelType" NOT NULL,
    "address" TEXT NOT NULL,
    "status" "ChannelStatus" NOT NULL DEFAULT 'UNKNOWN',
    "verificationSource" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "ContactChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Score" (
    "id" UUID NOT NULL,
    "scoreType" "ScoreType" NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "factorsJson" JSONB NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accountId" UUID,
    "contactId" UUID,
    "opportunityId" UUID,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icp" JSONB NOT NULL,
    "offer" JSONB NOT NULL,
    "channels" "ChannelType"[],
    "active" BOOLEAN NOT NULL DEFAULT false,
    "guardrails" JSONB NOT NULL,
    "frequencyCaps" JSONB NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'pt-BR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceEnrollment" (
    "id" UUID NOT NULL,
    "campaignId" UUID NOT NULL,
    "contactId" UUID NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "state" "EnrollmentState" NOT NULL DEFAULT 'ACTIVE',
    "nextActionAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "pauseReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SequenceEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Touchpoint" (
    "id" UUID NOT NULL,
    "contactId" UUID NOT NULL,
    "channel" "ChannelType" NOT NULL,
    "direction" "Direction" NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT,
    "sentAt" TIMESTAMP(3),
    "providerId" TEXT,
    "status" "MessageStatus" NOT NULL,
    "idempotencyKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Touchpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageDraft" (
    "id" UUID NOT NULL,
    "contactId" UUID NOT NULL,
    "campaignId" UUID,
    "angle" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "policyState" "PolicyOutcome",
    "status" "MessageStatus" NOT NULL DEFAULT 'DRAFT',
    "language" TEXT NOT NULL DEFAULT 'pt-BR',
    "promptVersion" TEXT NOT NULL,
    "modelMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageDraftEvidence" (
    "messageDraftId" UUID NOT NULL,
    "evidenceId" UUID NOT NULL,

    CONSTRAINT "MessageDraftEvidence_pkey" PRIMARY KEY ("messageDraftId","evidenceId")
);

-- CreateTable
CREATE TABLE "MessageDraftKnowledge" (
    "messageDraftId" UUID NOT NULL,
    "knowledgeItemId" UUID NOT NULL,

    CONSTRAINT "MessageDraftKnowledge_pkey" PRIMARY KEY ("messageDraftId","knowledgeItemId")
);

-- CreateTable
CREATE TABLE "InboundMessage" (
    "id" UUID NOT NULL,
    "contactId" UUID NOT NULL,
    "channel" "ChannelType" NOT NULL,
    "providerId" TEXT,
    "rawContent" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "intent" "IntentType" NOT NULL DEFAULT 'UNKNOWN',
    "sentiment" "SentimentType" NOT NULL DEFAULT 'UNKNOWN',
    "objection" TEXT,
    "classificationConfidence" DOUBLE PRECISION,
    "requiresHuman" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadStateEvent" (
    "id" UUID NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "fromState" TEXT,
    "toState" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accountId" UUID,
    "contactId" UUID,

    CONSTRAINT "LeadStateEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" UUID NOT NULL,
    "actionType" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "rationale" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerUserId" TEXT,
    "editedPayload" JSONB,
    "decisionReason" TEXT,
    "decisionAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messageDraftId" UUID,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "stage" "OpportunityStage" NOT NULL DEFAULT 'PRE_OPPORTUNITY',
    "need" TEXT,
    "scope" JSONB,
    "timing" TEXT,
    "budgetSignal" TEXT,
    "score" DOUBLE PRECISION,
    "arrPotentialMin" INTEGER,
    "arrPotentialMax" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "hubspotDealId" TEXT,
    "nextAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityContact" (
    "opportunityId" UUID NOT NULL,
    "contactId" UUID NOT NULL,
    "role" TEXT,

    CONSTRAINT "OpportunityContact_pkey" PRIMARY KEY ("opportunityId","contactId")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" UUID NOT NULL,
    "opportunityId" UUID NOT NULL,
    "externalId" TEXT,
    "participants" JSONB NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "briefId" TEXT,
    "notesRef" TEXT,
    "transcriptRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingBrief" (
    "id" UUID NOT NULL,
    "meetingId" UUID NOT NULL,
    "content" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeItem" (
    "id" UUID NOT NULL,
    "type" "KnowledgeType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceRef" TEXT,
    "tags" TEXT[],
    "jurisdiction" TEXT,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "approvalState" "KnowledgeApprovalState" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" UUID NOT NULL,
    "parentRunId" UUID,
    "agent" TEXT NOT NULL,
    "agentVersion" TEXT NOT NULL,
    "entityType" "EntityType",
    "entityId" TEXT,
    "inputRefs" JSONB NOT NULL,
    "outputJson" JSONB,
    "model" TEXT,
    "provider" TEXT,
    "tokensInput" INTEGER,
    "tokensOutput" INTEGER,
    "costMicrosUsd" INTEGER,
    "durationMs" INTEGER,
    "confidence" DOUBLE PRECISION,
    "status" "AgentRunStatus" NOT NULL DEFAULT 'QUEUED',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyDecision" (
    "id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "outcome" "PolicyOutcome" NOT NULL,
    "rulesTriggered" JSONB NOT NULL,
    "requiredApproval" BOOLEAN NOT NULL,
    "reason" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION,
    "evidenceIds" TEXT[],
    "knowledgeItemIds" TEXT[],
    "correlationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suppression" (
    "id" UUID NOT NULL,
    "scope" "SuppressionScope" NOT NULL,
    "channel" "ChannelType",
    "address" TEXT,
    "domain" TEXT,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accountId" UUID,
    "contactId" UUID,

    CONSTRAINT "Suppression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "key" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseJson" JSONB,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "IntegrationEvent" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "payload" JSONB,
    "processedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_domain_key" ON "Account"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "Account_hubspotId_key" ON "Account"("hubspotId");

-- CreateIndex
CREATE INDEX "Account_status_priorityBand_idx" ON "Account"("status", "priorityBand");

-- CreateIndex
CREATE INDEX "Account_country_sector_idx" ON "Account"("country", "sector");

-- CreateIndex
CREATE INDEX "AccountSignal_accountId_type_idx" ON "AccountSignal"("accountId", "type");

-- CreateIndex
CREATE INDEX "Evidence_entityType_entityId_idx" ON "Evidence"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Evidence_expiresAt_idx" ON "Evidence"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Contact_hubspotId_key" ON "Contact"("hubspotId");

-- CreateIndex
CREATE INDEX "Contact_accountId_leadState_idx" ON "Contact"("accountId", "leadState");

-- CreateIndex
CREATE INDEX "Contact_email_idx" ON "Contact"("email");

-- CreateIndex
CREATE INDEX "ContactChannel_contactId_channel_status_idx" ON "ContactChannel"("contactId", "channel", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ContactChannel_channel_address_key" ON "ContactChannel"("channel", "address");

-- CreateIndex
CREATE INDEX "Score_scoreType_calculatedAt_idx" ON "Score"("scoreType", "calculatedAt");

-- CreateIndex
CREATE INDEX "Campaign_active_idx" ON "Campaign"("active");

-- CreateIndex
CREATE INDEX "SequenceEnrollment_state_nextActionAt_idx" ON "SequenceEnrollment"("state", "nextActionAt");

-- CreateIndex
CREATE UNIQUE INDEX "SequenceEnrollment_campaignId_contactId_key" ON "SequenceEnrollment"("campaignId", "contactId");

-- CreateIndex
CREATE UNIQUE INDEX "Touchpoint_providerId_key" ON "Touchpoint"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "Touchpoint_idempotencyKey_key" ON "Touchpoint"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Touchpoint_contactId_createdAt_idx" ON "Touchpoint"("contactId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageDraft_contactId_status_idx" ON "MessageDraft"("contactId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InboundMessage_providerId_key" ON "InboundMessage"("providerId");

-- CreateIndex
CREATE INDEX "InboundMessage_contactId_receivedAt_idx" ON "InboundMessage"("contactId", "receivedAt");

-- CreateIndex
CREATE INDEX "LeadStateEvent_entityType_entityId_timestamp_idx" ON "LeadStateEvent"("entityType", "entityId", "timestamp");

-- CreateIndex
CREATE INDEX "Approval_status_riskLevel_createdAt_idx" ON "Approval"("status", "riskLevel", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_hubspotDealId_key" ON "Opportunity"("hubspotDealId");

-- CreateIndex
CREATE INDEX "Opportunity_stage_updatedAt_idx" ON "Opportunity"("stage", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_externalId_key" ON "Meeting"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_briefId_key" ON "Meeting"("briefId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingBrief_meetingId_key" ON "MeetingBrief"("meetingId");

-- CreateIndex
CREATE INDEX "KnowledgeItem_type_approvalState_idx" ON "KnowledgeItem"("type", "approvalState");

-- CreateIndex
CREATE INDEX "AgentRun_agent_status_createdAt_idx" ON "AgentRun"("agent", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AgentRun_entityType_entityId_idx" ON "AgentRun"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AgentRun_correlationId_idx" ON "AgentRun"("correlationId");

-- CreateIndex
CREATE INDEX "PolicyDecision_entityType_entityId_createdAt_idx" ON "PolicyDecision"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "PolicyDecision_outcome_createdAt_idx" ON "PolicyDecision"("outcome", "createdAt");

-- CreateIndex
CREATE INDEX "Suppression_scope_address_domain_idx" ON "Suppression"("scope", "address", "domain");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE INDEX "IntegrationEvent_provider_type_receivedAt_idx" ON "IntegrationEvent"("provider", "type", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationEvent_provider_externalId_key" ON "IntegrationEvent"("provider", "externalId");

-- AddForeignKey
ALTER TABLE "AccountSignal" ADD CONSTRAINT "AccountSignal_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactChannel" ADD CONSTRAINT "ContactChannel_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceEnrollment" ADD CONSTRAINT "SequenceEnrollment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SequenceEnrollment" ADD CONSTRAINT "SequenceEnrollment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Touchpoint" ADD CONSTRAINT "Touchpoint_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDraft" ADD CONSTRAINT "MessageDraft_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDraft" ADD CONSTRAINT "MessageDraft_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDraftEvidence" ADD CONSTRAINT "MessageDraftEvidence_messageDraftId_fkey" FOREIGN KEY ("messageDraftId") REFERENCES "MessageDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDraftEvidence" ADD CONSTRAINT "MessageDraftEvidence_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDraftKnowledge" ADD CONSTRAINT "MessageDraftKnowledge_messageDraftId_fkey" FOREIGN KEY ("messageDraftId") REFERENCES "MessageDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDraftKnowledge" ADD CONSTRAINT "MessageDraftKnowledge_knowledgeItemId_fkey" FOREIGN KEY ("knowledgeItemId") REFERENCES "KnowledgeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundMessage" ADD CONSTRAINT "InboundMessage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadStateEvent" ADD CONSTRAINT "LeadStateEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadStateEvent" ADD CONSTRAINT "LeadStateEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_messageDraftId_fkey" FOREIGN KEY ("messageDraftId") REFERENCES "MessageDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityContact" ADD CONSTRAINT "OpportunityContact_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityContact" ADD CONSTRAINT "OpportunityContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingBrief" ADD CONSTRAINT "MeetingBrief_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_parentRunId_fkey" FOREIGN KEY ("parentRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suppression" ADD CONSTRAINT "Suppression_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suppression" ADD CONSTRAINT "Suppression_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

