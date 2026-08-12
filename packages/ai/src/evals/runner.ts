import { isDeepStrictEqual } from 'node:util';
import type { AgentRunner, EvalCase, EvalCaseResult, EvalSummary } from './types';

/**
 * A case passes when every key present in `expected` deep-equals the same
 * key in `actual` — a subset match, since fixtures only assert the fields
 * that matter for that case rather than the full agent envelope.
 */
function matchesExpected(actual: unknown, expected: Record<string, unknown>): boolean {
  if (typeof actual !== 'object' || actual === null) return false;
  const actualRecord = actual as Record<string, unknown>;
  return Object.entries(expected).every(([key, value]) => isDeepStrictEqual(actualRecord[key], value));
}

export async function runEvalDataset(
  cases: readonly EvalCase[],
  runners: Readonly<Record<string, AgentRunner>>,
): Promise<EvalSummary> {
  const results: EvalCaseResult[] = [];

  for (const evalCase of cases) {
    const runner = runners[evalCase.agent];
    if (!runner) {
      results.push({
        id: evalCase.id,
        agent: evalCase.agent,
        category: evalCase.category,
        critical: evalCase.critical,
        status: 'SKIPPED',
        reason: `No runner registered for agent "${evalCase.agent}"`,
      });
      continue;
    }

    try {
      const actual = await runner(evalCase.input);
      const pass = matchesExpected(actual, evalCase.expected);
      results.push({
        id: evalCase.id,
        agent: evalCase.agent,
        category: evalCase.category,
        critical: evalCase.critical,
        status: pass ? 'PASS' : 'FAIL',
        actual,
      });
    } catch (error) {
      results.push({
        id: evalCase.id,
        agent: evalCase.agent,
        category: evalCase.category,
        critical: evalCase.critical,
        status: 'FAIL',
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    total: cases.length,
    pass: results.filter((r) => r.status === 'PASS').length,
    fail: results.filter((r) => r.status === 'FAIL').length,
    skipped: results.filter((r) => r.status === 'SKIPPED').length,
    criticalFail: results.filter((r) => r.status === 'FAIL' && r.critical).length,
    results,
  };
}
