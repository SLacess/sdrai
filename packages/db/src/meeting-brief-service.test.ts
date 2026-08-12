import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { persistMeetingBrief, type MeetingBriefInput } from './meeting-brief-service';

const VALID_EVIDENCE_ID = '11111111-1111-4111-8111-111111111111';
const EXPIRED_EVIDENCE_ID = '22222222-2222-4222-8222-222222222222';
const MISSING_EVIDENCE_ID = '33333333-3333-4333-8333-333333333333';

function createMockPrisma(evidenceRows: Array<{ id: string; expiresAt: Date | null }>) {
  const evidence = { findMany: vi.fn().mockResolvedValue(evidenceRows) };
  const meetingBrief = { upsert: vi.fn() };
  return { prisma: { evidence, meetingBrief } as unknown as PrismaClient, evidence, meetingBrief };
}

function baseBrief(overrides: Partial<MeetingBriefInput> = {}): MeetingBriefInput {
  return {
    executiveSummary: 'Acme is evaluating accessibility remediation.',
    participants: [{ name: 'Jane Doe', role: 'CTO' }],
    history: ['Positive reply on 2026-08-03'],
    verifiedFacts: [{ claim: 'Checkout flow has keyboard issues', evidenceId: VALID_EVIDENCE_ID }],
    hypotheses: ['May be evaluating multiple vendors'],
    objectives: ['Confirm budget owner'],
    questions: ['What is the target launch date?'],
    likelyObjections: ['Price'],
    recommendedOffer: null,
    risks: [],
    doNotSay: ['Guaranteed legal compliance'],
    ...overrides,
  };
}

describe('persistMeetingBrief', () => {
  it('keeps a verified fact whose evidence is present and not expired', async () => {
    const { prisma, meetingBrief } = createMockPrisma([{ id: VALID_EVIDENCE_ID, expiresAt: null }]);
    meetingBrief.upsert.mockResolvedValue({ id: 'brief-1' });

    const result = await persistMeetingBrief(prisma, {
      meetingId: 'meeting-1',
      brief: baseBrief(),
      confidence: 0.9,
    });

    expect(result.droppedFactClaims).toEqual([]);
    const call = meetingBrief.upsert.mock.calls[0]?.[0];
    expect(call.create.content.verifiedFacts).toEqual([
      { claim: 'Checkout flow has keyboard issues', evidenceId: VALID_EVIDENCE_ID },
    ]);
  });

  it('drops a verified fact whose evidence has since expired', async () => {
    const { prisma, meetingBrief } = createMockPrisma([
      { id: EXPIRED_EVIDENCE_ID, expiresAt: new Date('2000-01-01T00:00:00.000Z') },
    ]);
    meetingBrief.upsert.mockResolvedValue({ id: 'brief-1' });

    const result = await persistMeetingBrief(prisma, {
      meetingId: 'meeting-1',
      brief: baseBrief({ verifiedFacts: [{ claim: 'Fully WCAG compliant', evidenceId: EXPIRED_EVIDENCE_ID }] }),
      confidence: 0.9,
    });

    expect(result.droppedFactClaims).toEqual(['Fully WCAG compliant']);
    const call = meetingBrief.upsert.mock.calls[0]?.[0];
    expect(call.create.content.verifiedFacts).toEqual([]);
  });

  it('drops a verified fact citing an evidence id that does not exist', async () => {
    const { prisma, meetingBrief } = createMockPrisma([]);
    meetingBrief.upsert.mockResolvedValue({ id: 'brief-1' });

    const result = await persistMeetingBrief(prisma, {
      meetingId: 'meeting-1',
      brief: baseBrief({ verifiedFacts: [{ claim: 'Made up claim', evidenceId: MISSING_EVIDENCE_ID }] }),
      confidence: 0.9,
    });

    expect(result.droppedFactClaims).toEqual(['Made up claim']);
  });

  it('never merges a dropped fact into hypotheses', async () => {
    const { prisma, meetingBrief } = createMockPrisma([]);
    meetingBrief.upsert.mockResolvedValue({ id: 'brief-1' });

    await persistMeetingBrief(prisma, {
      meetingId: 'meeting-1',
      brief: baseBrief({
        verifiedFacts: [{ claim: 'Made up claim', evidenceId: MISSING_EVIDENCE_ID }],
        hypotheses: ['May be evaluating multiple vendors'],
      }),
      confidence: 0.9,
    });

    const call = meetingBrief.upsert.mock.calls[0]?.[0];
    expect(call.create.content.hypotheses).toEqual(['May be evaluating multiple vendors']);
    expect(call.create.content.hypotheses).not.toContain('Made up claim');
  });

  it('upserts by meetingId so a brief can be regenerated', async () => {
    const { prisma, meetingBrief } = createMockPrisma([{ id: VALID_EVIDENCE_ID, expiresAt: null }]);
    meetingBrief.upsert.mockResolvedValue({ id: 'brief-1' });

    await persistMeetingBrief(prisma, { meetingId: 'meeting-1', brief: baseBrief(), confidence: 0.9 });

    const call = meetingBrief.upsert.mock.calls[0]?.[0];
    expect(call.where).toEqual({ meetingId: 'meeting-1' });
    expect(call.update.confidence).toBe(0.9);
  });
});
