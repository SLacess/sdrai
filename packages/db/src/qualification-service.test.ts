import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { persistQualification } from './qualification-service';

function createMockPrisma() {
  const opportunity = { create: vi.fn() };
  const contact = { updateMany: vi.fn() };
  const leadStateEvent = { create: vi.fn() };
  const tx = { contact, leadStateEvent };
  const prisma = {
    opportunity,
    ...tx,
    $transaction: vi.fn(async (fn: (transactionClient: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { prisma: prisma as unknown as PrismaClient, opportunity, contact, leadStateEvent };
}

const QUALIFIED = {
  fit: true,
  relevantPerson: true,
  need: 'Accessibility remediation',
  scope: { channels: ['web'] },
  engagement: 'positive' as const,
  blockers: [],
  timing: null,
  handoffReason: null,
};

describe('persistQualification', () => {
  it('does not create an opportunity or transition the contact when need is missing', async () => {
    const { prisma, opportunity, contact } = createMockPrisma();

    const result = await persistQualification(prisma, {
      contactId: 'contact-1',
      accountId: 'acc-1',
      currentLeadState: 'QUALIFYING',
      qualification: { ...QUALIFIED, need: null },
      correlationId: 'corr-1',
    });

    expect(result.isSql).toBe(false);
    expect(result.unmetCriteria).toContain('MISSING_NEED');
    expect(result.opportunityId).toBeNull();
    expect(opportunity.create).not.toHaveBeenCalled();
    expect(contact.updateMany).not.toHaveBeenCalled();
  });

  it('requires handoff for a meeting request even when the deterministic criteria are not met', async () => {
    const { prisma, opportunity } = createMockPrisma();

    const result = await persistQualification(prisma, {
      contactId: 'contact-1',
      accountId: 'acc-1',
      currentLeadState: 'QUALIFYING',
      qualification: { ...QUALIFIED, need: null, handoffReason: 'Prospect explicitly asked for a call' },
      correlationId: 'corr-1',
    });

    expect(result.isSql).toBe(false);
    expect(result.requiresHandoff).toBe(true);
    expect(opportunity.create).not.toHaveBeenCalled();
  });

  it('does not require handoff when not SQL and no handoff was requested', async () => {
    const { prisma } = createMockPrisma();
    const result = await persistQualification(prisma, {
      contactId: 'contact-1',
      accountId: 'acc-1',
      currentLeadState: 'QUALIFYING',
      qualification: { ...QUALIFIED, engagement: 'neutral' },
      correlationId: 'corr-1',
    });
    expect(result.requiresHandoff).toBe(false);
  });

  it('creates an Opportunity and transitions the contact to SQL when criteria are met', async () => {
    const { prisma, opportunity, contact, leadStateEvent } = createMockPrisma();
    opportunity.create.mockResolvedValue({ id: 'opp-1' });
    contact.updateMany.mockResolvedValue({ count: 1 });

    const result = await persistQualification(prisma, {
      contactId: 'contact-1',
      accountId: 'acc-1',
      currentLeadState: 'QUALIFYING',
      qualification: QUALIFIED,
      correlationId: 'corr-1',
    });

    expect(result).toEqual({ isSql: true, unmetCriteria: [], opportunityId: 'opp-1', requiresHandoff: true });
    expect(opportunity.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        accountId: 'acc-1',
        stage: 'QUALIFIED_OPPORTUNITY',
        need: 'Accessibility remediation',
        contacts: { create: [{ contactId: 'contact-1' }] },
      }),
    });
    expect(contact.updateMany).toHaveBeenCalledWith({
      where: { id: 'contact-1', leadState: 'QUALIFYING' },
      data: { leadState: 'SQL' },
    });
    expect(leadStateEvent.create).toHaveBeenCalled();
  });

  it('still creates the opportunity but skips the transition when the contact is already SQL', async () => {
    const { prisma, opportunity, contact } = createMockPrisma();
    opportunity.create.mockResolvedValue({ id: 'opp-1' });

    const result = await persistQualification(prisma, {
      contactId: 'contact-1',
      accountId: 'acc-1',
      currentLeadState: 'SQL',
      qualification: QUALIFIED,
      correlationId: 'corr-1',
    });

    expect(result.opportunityId).toBe('opp-1');
    expect(contact.updateMany).not.toHaveBeenCalled();
  });
});
