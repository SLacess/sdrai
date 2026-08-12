import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { persistAccessibilitySignals } from './accessibility-persistence-service';

function createMockPrisma() {
  const accountSignal = { create: vi.fn() };
  const agentRun = { create: vi.fn() };
  return { prisma: { accountSignal, agentRun } as unknown as PrismaClient, accountSignal, agentRun };
}

function baseParams(overrides: Partial<Parameters<typeof persistAccessibilitySignals>[1]> = {}) {
  return {
    accountId: 'acc-1',
    correlationId: 'corr-1',
    signals: [],
    disclaimer: 'Automated scan is an indicator, not a compliance declaration.',
    agentVersion: '1.0.0',
    agentOutput: {},
    confidence: 0.8,
    provider: 'stub',
    model: 'claude-sonnet-5',
    tokensInput: 100,
    tokensOutput: 30,
    durationMs: 300,
    ...overrides,
  };
}

describe('persistAccessibilitySignals', () => {
  it('creates one AccountSignal per signal, always tagged isIndicatorOnly=true', async () => {
    const { prisma, accountSignal, agentRun } = createMockPrisma();
    accountSignal.create.mockResolvedValue({ id: 'signal-1' });
    agentRun.create.mockResolvedValue({ id: 'run-1' });

    const result = await persistAccessibilitySignals(
      prisma,
      baseParams({
        signals: [{ type: 'image-alt', severity: 'high', description: 'Missing alt text', evidenceIds: ['ev-1'] }],
      }),
    );

    expect(result.signalIds).toEqual(['signal-1']);
    expect(accountSignal.create).toHaveBeenCalledWith({
      data: {
        accountId: 'acc-1',
        type: 'image-alt',
        confidence: 0.8,
        value: {
          severity: 'high',
          description: 'Missing alt text',
          evidenceIds: ['ev-1'],
          disclaimer: 'Automated scan is an indicator, not a compliance declaration.',
          isIndicatorOnly: true,
        },
      },
    });
  });

  it('never writes a compliance/legal field regardless of signal content', async () => {
    const { prisma, accountSignal, agentRun } = createMockPrisma();
    accountSignal.create.mockResolvedValue({ id: 'signal-1' });
    agentRun.create.mockResolvedValue({ id: 'run-1' });

    await persistAccessibilitySignals(
      prisma,
      baseParams({
        signals: [{ type: 'image-alt', severity: 'high', description: 'Fully WCAG compliant, no legal risk', evidenceIds: [] }],
      }),
    );

    const writtenValue = accountSignal.create.mock.calls[0]?.[0].data.value;
    expect(writtenValue.isIndicatorOnly).toBe(true);
    expect(writtenValue).not.toHaveProperty('compliant');
    expect(writtenValue).not.toHaveProperty('legalStatus');
  });

  it('creates multiple AccountSignal rows for multiple findings', async () => {
    const { prisma, accountSignal, agentRun } = createMockPrisma();
    accountSignal.create.mockResolvedValue({ id: 'signal-x' });
    agentRun.create.mockResolvedValue({ id: 'run-1' });

    const result = await persistAccessibilitySignals(
      prisma,
      baseParams({
        signals: [
          { type: 'image-alt', severity: 'high', description: 'a', evidenceIds: [] },
          { type: 'color-contrast', severity: 'medium', description: 'b', evidenceIds: [] },
        ],
      }),
    );

    expect(accountSignal.create).toHaveBeenCalledTimes(2);
    expect(result.signalIds).toEqual(['signal-x', 'signal-x']);
  });

  it('creates exactly one AgentRun job trace even with zero signals', async () => {
    const { prisma, accountSignal, agentRun } = createMockPrisma();
    agentRun.create.mockResolvedValue({ id: 'run-1' });

    const result = await persistAccessibilitySignals(prisma, baseParams({ signals: [] }));

    expect(accountSignal.create).not.toHaveBeenCalled();
    expect(agentRun.create).toHaveBeenCalledTimes(1);
    expect(agentRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ agent: 'accessibility_intelligence', correlationId: 'corr-1', status: 'SUCCESS' }),
      }),
    );
    expect(result.agentRunId).toBe('run-1');
  });
});
