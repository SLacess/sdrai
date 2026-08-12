import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { createFirstTouchDraft, type CreateFirstTouchDraftParams } from './message-draft-service';

function createMockPrisma() {
  const messageDraft = { create: vi.fn() };
  const evidence = { findMany: vi.fn() };
  const approval = { create: vi.fn() };
  const policyConfig = { findUnique: vi.fn().mockResolvedValue(null) };
  return {
    prisma: { messageDraft, evidence, approval, policyConfig } as unknown as PrismaClient,
    messageDraft,
    evidence,
    approval,
    policyConfig,
  };
}

const EVIDENCE_ID = '11111111-1111-4111-8111-111111111111';

function baseParams(overrides: Partial<CreateFirstTouchDraftParams> = {}): CreateFirstTouchDraftParams {
  return {
    contactId: 'contact-1',
    angle: 'Accessibility risk',
    body: 'Hi Jane, ...',
    language: 'pt-BR',
    promptVersion: '1.0.0',
    evidenceIds: [EVIDENCE_ID],
    knowledgeItemIds: [],
    claims: [{ text: 'x', support: [{ evidenceId: EVIDENCE_ID }] }],
    confidence: 0.9,
    supervisorVerdict: 'PASS',
    unsupportedClaims: [],
    supervisorReasons: [],
    accountVip: false,
    hasSuppression: false,
    frequencyCapOk: true,
    verifiedChannel: true,
    inboundPending: false,
    ...overrides,
  };
}

describe('createFirstTouchDraft', () => {
  it('always requires approval for a clean first touch and creates a linked Approval', async () => {
    const { prisma, messageDraft, evidence, approval } = createMockPrisma();
    evidence.findMany.mockResolvedValue([{ id: EVIDENCE_ID, expiresAt: null }]);
    messageDraft.create.mockResolvedValue({ id: 'draft-1', status: 'PENDING_APPROVAL' });
    approval.create.mockResolvedValue({ id: 'approval-1' });

    const result = await createFirstTouchDraft(prisma, baseParams());

    expect(result.policyDecision.outcome).toBe('REQUIRE_APPROVAL');
    expect(messageDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING_APPROVAL', policyState: 'REQUIRE_APPROVAL' }),
      }),
    );
    expect(approval.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actionType: 'SEND_FIRST_TOUCH', messageDraftId: 'draft-1' }),
      }),
    );
    expect(result.approval).toEqual({ id: 'approval-1' });
  });

  it('short-circuits on a supervisor BLOCK verdict without touching evidence or creating an Approval', async () => {
    const { prisma, messageDraft, evidence, approval } = createMockPrisma();
    messageDraft.create.mockResolvedValue({ id: 'draft-1', status: 'CANCELLED' });

    const result = await createFirstTouchDraft(prisma, baseParams({ supervisorVerdict: 'BLOCK', supervisorReasons: ['fabricated claim'] }));

    expect(result.policyDecision).toEqual({
      outcome: 'BLOCK',
      riskLevel: 'RED',
      rulesTriggered: ['SUPERVISOR_BLOCK'],
      reason: 'fabricated claim',
    });
    expect(evidence.findMany).not.toHaveBeenCalled();
    expect(approval.create).not.toHaveBeenCalled();
    expect(messageDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED', riskLevel: 'RED', policyState: 'BLOCK' }) }),
    );
  });

  it('blocks and creates no Approval when the contact/account is suppressed', async () => {
    const { prisma, messageDraft, evidence, approval } = createMockPrisma();
    evidence.findMany.mockResolvedValue([{ id: EVIDENCE_ID, expiresAt: null }]);
    messageDraft.create.mockResolvedValue({ id: 'draft-1', status: 'CANCELLED' });

    const result = await createFirstTouchDraft(prisma, baseParams({ hasSuppression: true }));

    expect(result.policyDecision.outcome).toBe('BLOCK');
    expect(result.policyDecision.rulesTriggered).toEqual(['SUPPRESSION']);
    expect(approval.create).not.toHaveBeenCalled();
  });

  it('blocks when required evidence is missing or expired', async () => {
    const { prisma, messageDraft, evidence, approval } = createMockPrisma();
    evidence.findMany.mockResolvedValue([]);
    messageDraft.create.mockResolvedValue({ id: 'draft-1', status: 'CANCELLED' });

    const result = await createFirstTouchDraft(prisma, baseParams());

    expect(result.policyDecision.rulesTriggered).toEqual(['MISSING_EVIDENCE']);
    expect(approval.create).not.toHaveBeenCalled();
  });

  it('blocks when the supervisor flagged unsupported claims', async () => {
    const { prisma, messageDraft, evidence, approval } = createMockPrisma();
    evidence.findMany.mockResolvedValue([{ id: EVIDENCE_ID, expiresAt: null }]);
    messageDraft.create.mockResolvedValue({ id: 'draft-1', status: 'CANCELLED' });

    const result = await createFirstTouchDraft(prisma, baseParams({ unsupportedClaims: ['We guarantee compliance'] }));

    expect(result.policyDecision.rulesTriggered).toEqual(['UNSUPPORTED_TECH_LEGAL_CLAIM']);
    expect(approval.create).not.toHaveBeenCalled();
  });

  it('links the created evidence and knowledge item rows to the draft', async () => {
    const { prisma, messageDraft, evidence, approval } = createMockPrisma();
    evidence.findMany.mockResolvedValue([{ id: EVIDENCE_ID, expiresAt: null }]);
    messageDraft.create.mockResolvedValue({ id: 'draft-1' });
    approval.create.mockResolvedValue({ id: 'approval-1' });
    const knowledgeId = '22222222-2222-4222-8222-222222222222';

    await createFirstTouchDraft(prisma, baseParams({ knowledgeItemIds: [knowledgeId] }));

    expect(messageDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          evidence: { create: [{ evidenceId: EVIDENCE_ID }] },
          knowledge: { create: [{ knowledgeItemId: knowledgeId }] },
        }),
      }),
    );
  });

  it('blocks a draft containing a default forbidden claim before even checking the supervisor verdict', async () => {
    const { prisma, messageDraft, evidence, approval } = createMockPrisma();
    messageDraft.create.mockResolvedValue({ id: 'draft-1', status: 'CANCELLED' });

    const result = await createFirstTouchDraft(
      prisma,
      baseParams({ body: 'Our platform makes your site 100% accessible, guaranteed.' }),
    );

    expect(result.policyDecision).toEqual({
      outcome: 'BLOCK',
      riskLevel: 'RED',
      rulesTriggered: ['FORBIDDEN_CLAIM'],
      reason: 'Draft contains a forbidden claim: "100% accessible"',
    });
    expect(evidence.findMany).not.toHaveBeenCalled();
    expect(approval.create).not.toHaveBeenCalled();
  });

  it('blocks using a supervisor-configured forbidden phrase, not just the built-in defaults', async () => {
    const { prisma, messageDraft, policyConfig } = createMockPrisma();
    policyConfig.findUnique.mockResolvedValue({ key: 'forbiddenClaims', value: ['fully certified'], version: 2 });
    messageDraft.create.mockResolvedValue({ id: 'draft-1', status: 'CANCELLED' });

    const result = await createFirstTouchDraft(prisma, baseParams({ body: 'This solution is fully certified.' }));

    expect(result.policyDecision.rulesTriggered).toEqual(['FORBIDDEN_CLAIM']);
  });
});
