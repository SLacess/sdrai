import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import {
  decideChangeProposal,
  listChangeProposals,
  persistChangeProposals,
  type LearningProposalInput,
} from './change-proposal-service';

function createMockPrisma() {
  const changeProposal = {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    updateMany: vi.fn(),
  };
  return { prisma: { changeProposal } as unknown as PrismaClient, changeProposal };
}

const PROPOSAL: LearningProposalInput = {
  type: 'THRESHOLD',
  currentVersion: 'v1',
  proposal: 'Raise SQL confidence threshold from 0.75 to 0.8',
  evidence: ['approval_reject_rate_up'],
  expectedImpact: 'Fewer low-quality SQL handoffs',
  risk: 'LOW',
};

describe('persistChangeProposals', () => {
  it('persists nothing and returns OBSERVATION_ONLY when the sample size is below the minimum', async () => {
    const { prisma, changeProposal } = createMockPrisma();

    const result = await persistChangeProposals(prisma, { sampleSize: 5, proposals: [PROPOSAL] });

    expect(result).toEqual({ kind: 'OBSERVATION_ONLY', sampleSize: 5 });
    expect(changeProposal.create).not.toHaveBeenCalled();
  });

  it('ignores the caller-supplied proposals entirely when the sample is insufficient, even if non-empty', async () => {
    const { prisma, changeProposal } = createMockPrisma();

    await persistChangeProposals(prisma, { sampleSize: 0, proposals: [PROPOSAL, PROPOSAL] });

    expect(changeProposal.create).not.toHaveBeenCalled();
  });

  it('persists every proposal as PROPOSED with requiresOfflineEval forced true when the sample is sufficient', async () => {
    const { prisma, changeProposal } = createMockPrisma();
    changeProposal.create.mockResolvedValue({ id: 'proposal-1' });

    const result = await persistChangeProposals(prisma, { sampleSize: 42, proposals: [PROPOSAL] });

    expect(result.kind).toBe('PROPOSED');
    expect(changeProposal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PROPOSED', requiresOfflineEval: true, type: 'THRESHOLD' }),
      }),
    );
  });

  it('attaches the originating agentRunId when provided', async () => {
    const { prisma, changeProposal } = createMockPrisma();
    changeProposal.create.mockResolvedValue({ id: 'proposal-1' });

    await persistChangeProposals(prisma, { sampleSize: 42, agentRunId: 'run-1', proposals: [PROPOSAL] });

    expect(changeProposal.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ agentRunId: 'run-1' }) }),
    );
  });
});

describe('listChangeProposals', () => {
  it('filters by status when provided', async () => {
    const { prisma, changeProposal } = createMockPrisma();
    changeProposal.findMany.mockResolvedValue([]);

    await listChangeProposals(prisma, { status: 'PROPOSED' });

    expect(changeProposal.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'PROPOSED' } }));
  });
});

describe('decideChangeProposal', () => {
  it('returns NOT_FOUND for a missing proposal', async () => {
    const { prisma, changeProposal } = createMockPrisma();
    changeProposal.findUnique.mockResolvedValue(null);

    const result = await decideChangeProposal(prisma, { proposalId: 'x', reviewerUserId: 'user-1', decision: 'ACCEPT' });

    expect(result).toEqual({ kind: 'NOT_FOUND' });
  });

  it('returns CONFLICT when the proposal was already decided', async () => {
    const { prisma, changeProposal } = createMockPrisma();
    changeProposal.findUnique.mockResolvedValue({ id: 'proposal-1', status: 'ACCEPTED' });

    const result = await decideChangeProposal(prisma, { proposalId: 'proposal-1', reviewerUserId: 'user-1', decision: 'REJECT' });

    expect(result).toEqual({ kind: 'CONFLICT', currentStatus: 'ACCEPTED' });
    expect(changeProposal.updateMany).not.toHaveBeenCalled();
  });

  it('decides a pending proposal and records the reviewer', async () => {
    const { prisma, changeProposal } = createMockPrisma();
    changeProposal.findUnique.mockResolvedValue({ id: 'proposal-1', status: 'PROPOSED' });
    changeProposal.updateMany.mockResolvedValue({ count: 1 });
    changeProposal.findUniqueOrThrow.mockResolvedValue({ id: 'proposal-1', status: 'ACCEPTED' });

    const result = await decideChangeProposal(prisma, { proposalId: 'proposal-1', reviewerUserId: 'user-1', decision: 'ACCEPT' });

    expect(result).toEqual({ kind: 'DECIDED', proposal: { id: 'proposal-1', status: 'ACCEPTED' } });
    expect(changeProposal.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'proposal-1', status: 'PROPOSED' }, data: expect.objectContaining({ status: 'ACCEPTED' }) }),
    );
  });
});
