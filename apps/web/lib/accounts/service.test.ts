import type { PrismaClient } from '@sinal/db';
import { describe, expect, it, vi } from 'vitest';
import { NotFoundError, ValidationError } from '@/lib/http/errors';
import { getAccountById, listAccounts } from './service';

function accountRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acc-1',
    brandName: 'Acme',
    domain: 'acme.com',
    status: 'DISCOVERED',
    priorityBand: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    scores: [],
    ...overrides,
  };
}

function createMockPrisma() {
  const account = { findMany: vi.fn(), findUnique: vi.fn() };
  return { prisma: { account } as unknown as PrismaClient, account };
}

describe('listAccounts', () => {
  it('returns a summary page with no cursor when fewer rows than the page size exist', async () => {
    const { prisma, account } = createMockPrisma();
    account.findMany.mockResolvedValue([
      accountRow({ id: 'acc-1', scores: [{ total: 82 }] }),
      accountRow({ id: 'acc-2', priorityBand: 'B' }),
    ]);

    const result = await listAccounts(prisma, {});

    expect(result.items).toEqual([
      { id: 'acc-1', brandName: 'Acme', domain: 'acme.com', status: 'DISCOVERED', priorityBand: null, score: 82 },
      { id: 'acc-2', brandName: 'Acme', domain: 'acme.com', status: 'DISCOVERED', priorityBand: 'B', score: null },
    ]);
    expect(result.nextCursor).toBeNull();
  });

  it('returns a nextCursor when more rows exist than the page size', async () => {
    const { prisma, account } = createMockPrisma();
    const rows = Array.from({ length: 26 }, (_, i) => accountRow({ id: `acc-${i}` }));
    account.findMany.mockResolvedValue(rows);

    const result = await listAccounts(prisma, {});

    expect(result.items).toHaveLength(25);
    expect(result.nextCursor).not.toBeNull();
    expect(typeof result.nextCursor).toBe('string');
  });

  it('passes status/priority filters through to the query and rejects unknown values', async () => {
    const { prisma, account } = createMockPrisma();
    account.findMany.mockResolvedValue([]);

    await listAccounts(prisma, { status: 'QUALIFIED_ACCOUNT', priority: 'A' });

    expect(account.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'QUALIFIED_ACCOUNT', priorityBand: 'A' }) }),
    );
  });

  it('rejects an unrecognized status filter without querying the database', async () => {
    const { prisma, account } = createMockPrisma();
    await expect(listAccounts(prisma, { status: 'NOT_A_REAL_STATUS' })).rejects.toBeInstanceOf(ValidationError);
    expect(account.findMany).not.toHaveBeenCalled();
  });

  it('rejects an unrecognized priority filter', async () => {
    const { prisma, account } = createMockPrisma();
    await expect(listAccounts(prisma, { priority: 'Z' })).rejects.toBeInstanceOf(ValidationError);
    expect(account.findMany).not.toHaveBeenCalled();
  });

  it('rejects a malformed cursor', async () => {
    const { prisma } = createMockPrisma();
    await expect(listAccounts(prisma, { cursor: 'not-valid-base64url!!' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('round-trips a cursor from one page into a valid where clause on the next', async () => {
    const { prisma, account } = createMockPrisma();
    const rows = Array.from({ length: 26 }, (_, i) => accountRow({ id: `acc-${i}` }));
    account.findMany.mockResolvedValueOnce(rows);
    const firstPage = await listAccounts(prisma, {});

    account.findMany.mockResolvedValueOnce([]);
    await listAccounts(prisma, { cursor: firstPage.nextCursor });

    const secondCallArgs = account.findMany.mock.calls[1]?.[0];
    expect(secondCallArgs.where.OR).toEqual([
      { createdAt: { gt: expect.any(Date) } },
      { createdAt: expect.any(Date), id: { gt: 'acc-24' } },
    ]);
  });
});

describe('getAccountById', () => {
  it('returns the Account360 shape including evidence/signals/contacts/timeline/opportunities/messageDrafts', async () => {
    const { prisma, account } = createMockPrisma();
    account.findUnique.mockResolvedValue(
      accountRow({
        hubspotId: 'hs-1',
        scores: [{ total: 55 }],
        evidence: [{ id: 'ev-1', claim: 'Checkout has keyboard issues', sourceUri: 'https://acme.com', confidence: 0.9, expiresAt: null }],
        signals: [{ id: 'sig-1' }],
        contacts: [
          {
            id: 'contact-1',
            name: 'Jane Doe',
            messageDrafts: [
              { id: 'draft-1', angle: 'accessibility-audit', subject: 'Hi', status: 'DRAFT', riskLevel: 'YELLOW', createdAt: new Date('2026-01-02T00:00:00.000Z') },
            ],
          },
        ],
        stateEvents: [{ id: 'event-1' }],
        opportunities: [
          {
            id: 'opp-1',
            stage: 'QUALIFIED_OPPORTUNITY',
            need: 'Accessibility remediation',
            score: 70,
            arrPotentialMin: 10000,
            arrPotentialMax: 20000,
            currency: 'BRL',
            nextAction: 'Book discovery call',
            hubspotDealId: 'deal-1',
            meetings: [
              { id: 'meeting-1', scheduledAt: new Date('2026-02-01T14:00:00.000Z'), timezone: 'America/Sao_Paulo', status: 'SCHEDULED', briefId: 'brief-1' },
            ],
          },
        ],
      }),
    );

    const result = await getAccountById(prisma, 'acc-1');

    expect(result).toEqual({
      id: 'acc-1',
      brandName: 'Acme',
      domain: 'acme.com',
      status: 'DISCOVERED',
      priorityBand: null,
      hubspotId: 'hs-1',
      score: 55,
      evidence: [
        { id: 'ev-1', claim: 'Checkout has keyboard issues', sourceUri: 'https://acme.com', confidence: 0.9, expiresAt: null, freshness: 'NO_EXPIRY' },
      ],
      signals: [{ id: 'sig-1' }],
      contacts: [
        {
          id: 'contact-1',
          name: 'Jane Doe',
          messageDrafts: [
            { id: 'draft-1', angle: 'accessibility-audit', subject: 'Hi', status: 'DRAFT', riskLevel: 'YELLOW', createdAt: new Date('2026-01-02T00:00:00.000Z') },
          ],
        },
      ],
      timeline: [{ id: 'event-1' }],
      opportunities: [
        {
          id: 'opp-1',
          stage: 'QUALIFIED_OPPORTUNITY',
          need: 'Accessibility remediation',
          score: 70,
          arrPotentialMin: 10000,
          arrPotentialMax: 20000,
          currency: 'BRL',
          nextAction: 'Book discovery call',
          hubspotDealId: 'deal-1',
          meetings: [{ id: 'meeting-1', scheduledAt: new Date('2026-02-01T14:00:00.000Z'), timezone: 'America/Sao_Paulo', status: 'SCHEDULED', hasBrief: true }],
        },
      ],
      messageDrafts: [
        { id: 'draft-1', contactId: 'contact-1', contactName: 'Jane Doe', angle: 'accessibility-audit', subject: 'Hi', status: 'DRAFT', riskLevel: 'YELLOW', createdAt: new Date('2026-01-02T00:00:00.000Z') },
      ],
    });
  });

  it('marks evidence with a past expiresAt as EXPIRED and evidence with a future expiresAt as FRESH', async () => {
    const { prisma, account } = createMockPrisma();
    account.findUnique.mockResolvedValue(
      accountRow({
        evidence: [
          { id: 'ev-expired', claim: 'stale claim', sourceUri: null, confidence: 0.5, expiresAt: new Date('2000-01-01T00:00:00.000Z') },
          { id: 'ev-fresh', claim: 'current claim', sourceUri: null, confidence: 0.5, expiresAt: new Date('2999-01-01T00:00:00.000Z') },
        ],
        contacts: [],
        opportunities: [],
      }),
    );

    const result = await getAccountById(prisma, 'acc-1');

    expect(result.evidence.map((e) => e.freshness)).toEqual(['EXPIRED', 'FRESH']);
  });

  it('throws NotFoundError when the account does not exist', async () => {
    const { prisma, account } = createMockPrisma();
    account.findUnique.mockResolvedValue(null);
    await expect(getAccountById(prisma, 'missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});
