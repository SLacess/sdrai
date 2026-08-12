import { describe, expect, it } from 'vitest';
import { runEvalDataset } from './runner';
import type { EvalCase } from './types';

function makeCase(overrides: Partial<EvalCase> = {}): EvalCase {
  return {
    id: 'EVAL-001',
    agent: 'policy_engine',
    category: 'decision',
    input: {},
    expected: {},
    critical: false,
    ...overrides,
  };
}

describe('runEvalDataset', () => {
  it('marks a case PASS when every expected key matches the runner output', async () => {
    const summary = await runEvalDataset(
      [makeCase({ expected: { outcome: 'ALLOW' } })],
      { policy_engine: () => ({ outcome: 'ALLOW', riskLevel: 'GREEN' }) },
    );
    expect(summary).toMatchObject({ total: 1, pass: 1, fail: 0, skipped: 0, criticalFail: 0 });
    expect(summary.results[0]?.status).toBe('PASS');
  });

  it('marks a case FAIL when an expected key mismatches', async () => {
    const summary = await runEvalDataset(
      [makeCase({ expected: { outcome: 'BLOCK' } })],
      { policy_engine: () => ({ outcome: 'ALLOW' }) },
    );
    expect(summary.fail).toBe(1);
    expect(summary.results[0]?.status).toBe('FAIL');
  });

  it('counts a failed critical case in criticalFail', async () => {
    const summary = await runEvalDataset(
      [makeCase({ critical: true, expected: { outcome: 'BLOCK' } })],
      { policy_engine: () => ({ outcome: 'ALLOW' }) },
    );
    expect(summary.criticalFail).toBe(1);
  });

  it('does not count a failed non-critical case in criticalFail', async () => {
    const summary = await runEvalDataset(
      [makeCase({ critical: false, expected: { outcome: 'BLOCK' } })],
      { policy_engine: () => ({ outcome: 'ALLOW' }) },
    );
    expect(summary.criticalFail).toBe(0);
  });

  it('marks a case SKIPPED when no runner is registered for its agent', async () => {
    const summary = await runEvalDataset([makeCase({ agent: 'reply_classifier' })], {});
    expect(summary.skipped).toBe(1);
    expect(summary.results[0]).toMatchObject({ status: 'SKIPPED', reason: expect.stringContaining('reply_classifier') });
  });

  it('marks a case FAIL when the runner throws', async () => {
    const summary = await runEvalDataset(
      [makeCase()],
      {
        policy_engine: () => {
          throw new Error('boom');
        },
      },
    );
    expect(summary.fail).toBe(1);
    expect(summary.results[0]).toMatchObject({ status: 'FAIL', reason: 'boom' });
  });

  it('only requires expected keys to match, ignoring extra actual fields', async () => {
    const summary = await runEvalDataset(
      [makeCase({ expected: { outcome: 'ALLOW' } })],
      { policy_engine: () => ({ outcome: 'ALLOW', riskLevel: 'GREEN', rulesTriggered: ['x'] }) },
    );
    expect(summary.results[0]?.status).toBe('PASS');
  });

  it('aggregates totals across a mixed batch', async () => {
    const summary = await runEvalDataset(
      [
        makeCase({ id: 'a', expected: { outcome: 'ALLOW' } }),
        makeCase({ id: 'b', expected: { outcome: 'BLOCK' } }),
        makeCase({ id: 'c', agent: 'unregistered' }),
      ],
      { policy_engine: () => ({ outcome: 'ALLOW' }) },
    );
    expect(summary).toMatchObject({ total: 3, pass: 1, fail: 1, skipped: 1 });
  });
});
