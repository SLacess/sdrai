import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export interface TraceContext {
  correlationId: string;
  entityType: string | undefined;
  entityId: string | undefined;
  agentRunId: string | undefined;
}

const storage = new AsyncLocalStorage<TraceContext>();

export function newCorrelationId(): string {
  return randomUUID();
}

export function runWithTraceContext<T>(context: Partial<TraceContext>, fn: () => T): T {
  const parent = storage.getStore();
  const merged: TraceContext = {
    correlationId: context.correlationId ?? parent?.correlationId ?? newCorrelationId(),
    entityType: context.entityType ?? parent?.entityType,
    entityId: context.entityId ?? parent?.entityId,
    agentRunId: context.agentRunId ?? parent?.agentRunId,
  };
  return storage.run(merged, fn);
}

export function getTraceContext(): TraceContext | undefined {
  return storage.getStore();
}

export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}
