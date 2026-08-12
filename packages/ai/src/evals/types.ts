import { z } from 'zod';

export const EvalCaseSchema = z.object({
  id: z.string(),
  agent: z.string(),
  category: z.string(),
  input: z.unknown(),
  expected: z.record(z.unknown()),
  critical: z.boolean(),
});

export type EvalCase = z.infer<typeof EvalCaseSchema>;

export type AgentRunner = (input: unknown) => unknown | Promise<unknown>;

export type EvalCaseStatus = 'PASS' | 'FAIL' | 'SKIPPED';

export interface EvalCaseResult {
  id: string;
  agent: string;
  category: string;
  critical: boolean;
  status: EvalCaseStatus;
  reason?: string;
  actual?: unknown;
}

export interface EvalSummary {
  total: number;
  pass: number;
  fail: number;
  skipped: number;
  criticalFail: number;
  results: EvalCaseResult[];
}
