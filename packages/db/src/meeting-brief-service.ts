import type { MeetingBrief, Prisma, PrismaClient } from '@prisma/client';
import { verifyRequiredEvidence } from './evidence-service';

export interface MeetingBriefParticipant {
  name: string;
  role?: string;
}

export interface MeetingBriefVerifiedFact {
  claim: string;
  evidenceId: string;
}

export interface MeetingBriefInput {
  executiveSummary: string;
  participants: MeetingBriefParticipant[];
  history: string[];
  verifiedFacts: MeetingBriefVerifiedFact[];
  hypotheses: string[];
  objectives: string[];
  questions: string[];
  likelyObjections: string[];
  recommendedOffer: string | null;
  risks: string[];
  doNotSay: string[];
}

export interface PersistMeetingBriefParams {
  meetingId: string;
  brief: MeetingBriefInput;
  confidence: number;
}

export interface PersistMeetingBriefResult {
  meetingBrief: MeetingBrief;
  droppedFactClaims: string[];
}

/**
 * verifiedFacts arrive from the meeting_prep_agent LLM output, which the
 * schema already forces to cite an evidenceId (CLAUDE.md rule 5/6: facts
 * and inferences never merge). This is the second, independent check: the
 * cited evidence is re-fetched and re-checked for expiry right before
 * persistence, so a fact cannot survive on evidence that expired between
 * generation and save. Facts that fail are dropped, never downgraded into
 * hypotheses — a dropped fact is silently absent, not relabeled as a guess.
 */
export async function persistMeetingBrief(
  prisma: PrismaClient,
  params: PersistMeetingBriefParams,
): Promise<PersistMeetingBriefResult> {
  const requiredIds = params.brief.verifiedFacts.map((fact) => fact.evidenceId);
  const evidenceCheck = await verifyRequiredEvidence(prisma, requiredIds);
  const invalidIds = new Set([...evidenceCheck.missingIds, ...evidenceCheck.expiredIds]);

  const acceptedFacts = params.brief.verifiedFacts.filter((fact) => !invalidIds.has(fact.evidenceId));
  const droppedFactClaims = params.brief.verifiedFacts
    .filter((fact) => invalidIds.has(fact.evidenceId))
    .map((fact) => fact.claim);

  const content = {
    executiveSummary: params.brief.executiveSummary,
    participants: params.brief.participants,
    history: params.brief.history,
    verifiedFacts: acceptedFacts,
    hypotheses: params.brief.hypotheses,
    objectives: params.brief.objectives,
    questions: params.brief.questions,
    likelyObjections: params.brief.likelyObjections,
    recommendedOffer: params.brief.recommendedOffer,
    risks: params.brief.risks,
    doNotSay: params.brief.doNotSay,
  };

  const meetingBrief = await prisma.meetingBrief.upsert({
    where: { meetingId: params.meetingId },
    create: {
      meetingId: params.meetingId,
      content: content as unknown as Prisma.InputJsonValue,
      confidence: params.confidence,
    },
    update: {
      content: content as unknown as Prisma.InputJsonValue,
      confidence: params.confidence,
      generatedAt: new Date(),
    },
  });

  return { meetingBrief, droppedFactClaims };
}
