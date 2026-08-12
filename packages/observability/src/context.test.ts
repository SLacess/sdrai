import { describe, expect, it } from 'vitest';
import { getCorrelationId, getTraceContext, newCorrelationId, runWithTraceContext } from './context';

describe('trace context', () => {
  it('has no context outside of runWithTraceContext', () => {
    expect(getTraceContext()).toBeUndefined();
    expect(getCorrelationId()).toBeUndefined();
  });

  it('exposes correlationId and entity fields inside the callback', () => {
    const correlationId = newCorrelationId();
    runWithTraceContext({ correlationId, entityType: 'ACCOUNT', entityId: 'acc-1' }, () => {
      expect(getCorrelationId()).toBe(correlationId);
      expect(getTraceContext()).toEqual({
        correlationId,
        entityType: 'ACCOUNT',
        entityId: 'acc-1',
        agentRunId: undefined,
      });
    });
  });

  it('generates a correlationId automatically when none is provided', () => {
    runWithTraceContext({}, () => {
      expect(getCorrelationId()).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  it('inherits and overrides parent context in nested calls', () => {
    const parentId = newCorrelationId();
    runWithTraceContext({ correlationId: parentId, entityType: 'ACCOUNT', entityId: 'acc-1' }, () => {
      runWithTraceContext({ agentRunId: 'run-1' }, () => {
        expect(getTraceContext()).toEqual({
          correlationId: parentId,
          entityType: 'ACCOUNT',
          entityId: 'acc-1',
          agentRunId: 'run-1',
        });
      });
      // Nested run must not leak back into parent scope.
      expect(getTraceContext()?.agentRunId).toBeUndefined();
    });
  });

  it('propagates context across async boundaries', async () => {
    const correlationId = newCorrelationId();
    await runWithTraceContext({ correlationId }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(getCorrelationId()).toBe(correlationId);
    });
  });
});
