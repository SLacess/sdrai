import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEvalDataset, runEvalDataset, type AgentRunner } from '@sinal/ai';
import { evaluateAction, type ActionContext } from '@sinal/policies';

function mapPolicyEngineInput(input: unknown): ActionContext {
  const i = (input ?? {}) as Record<string, unknown>;
  return {
    action: 'eval_case',
    actionClass: 'GREEN',
    confidence: typeof i.confidence === 'number' ? i.confidence : 1,
    accountVip: false,
    hasSuppression: Boolean(i.suppression),
    frequencyCapOk: i.caps === undefined ? true : Boolean(i.caps),
    requiredEvidencePresent: i.evidence === undefined ? true : Boolean(i.evidence),
    verifiedChannel: i.verified === undefined ? true : Boolean(i.verified),
    inboundPending: Boolean(i.inboundPending),
    containsTechnicalOrLegalClaim: false,
    approvedKnowledgeForClaim: false,
    isFirstTouch: Boolean(i.firstTouch),
    isCustomPricing: false,
    isContractLegalSecurity: false,
    isDemoOrNegotiation: false,
  };
}

// Only agents with a real, deterministic implementation are wired here.
// Everything else (reply_classifier, ai_supervisor, ...) needs a live AI
// provider we don't have credentials for in this environment, so those
// cases are honestly reported SKIPPED rather than given a fabricated grade.
const runners: Record<string, AgentRunner> = {
  policy_engine: (input) => evaluateAction(mapPolicyEngineInput(input)),
};

async function main() {
  const datasetPath = path.resolve(process.cwd(), 'tests/evals/dataset.jsonl');
  const jsonl = readFileSync(datasetPath, 'utf8');
  const cases = parseEvalDataset(jsonl);
  const summary = await runEvalDataset(cases, runners);

  console.log(`Eval dataset: ${datasetPath}`);
  console.log(
    `Total: ${summary.total}  Pass: ${summary.pass}  Fail: ${summary.fail}  Skipped: ${summary.skipped}  Critical fails: ${summary.criticalFail}`,
  );
  console.log();

  const byCategory = new Map<string, { pass: number; fail: number; skipped: number }>();
  for (const result of summary.results) {
    const bucket = byCategory.get(result.category) ?? { pass: 0, fail: 0, skipped: 0 };
    if (result.status === 'PASS') bucket.pass++;
    else if (result.status === 'FAIL') bucket.fail++;
    else bucket.skipped++;
    byCategory.set(result.category, bucket);
  }
  console.log('By category:');
  for (const [category, counts] of byCategory) {
    console.log(`  ${category}: pass=${counts.pass} fail=${counts.fail} skipped=${counts.skipped}`);
  }
  console.log();

  const failures = summary.results.filter((r) => r.status === 'FAIL');
  if (failures.length > 0) {
    console.log('Failures:');
    for (const failure of failures) {
      const tag = failure.critical ? 'CRITICAL' : 'non-critical';
      const reason = failure.reason ? ` — ${failure.reason}` : '';
      console.log(`  [${tag}] ${failure.id} (${failure.agent}/${failure.category})${reason}`);
    }
    console.log();
  }

  const skipped = summary.results.filter((r) => r.status === 'SKIPPED');
  if (skipped.length > 0) {
    const agents = [...new Set(skipped.map((s) => s.agent))];
    console.log(`Skipped ${skipped.length} case(s) — no runner wired yet for: ${agents.join(', ')}.`);
    console.log('These require a configured AI provider (AI_API_KEY_PRIMARY) and are NOT counted as passing.');
    console.log();
  }

  if (summary.criticalFail > 0) {
    console.error(`FAILED: ${summary.criticalFail} critical case(s) did not pass.`);
    process.exitCode = 1;
    return;
  }
  console.log('OK: no critical failures among evaluated cases.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
