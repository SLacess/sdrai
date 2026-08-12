import { describe, expect, it } from 'vitest';
import { evaluateAction, type ActionContext, type PolicyDecisionResult } from './policy-engine';

// A context that passes every blocking check and lands on the GREEN/ALLOW
// path so each table case only needs to override the field(s) under test.
const BASE: ActionContext = {
  action: 'send_first_touch_email',
  actionClass: 'GREEN',
  confidence: 0.95,
  accountVip: false,
  hasSuppression: false,
  frequencyCapOk: true,
  requiredEvidencePresent: true,
  verifiedChannel: true,
  inboundPending: false,
  containsTechnicalOrLegalClaim: false,
  approvedKnowledgeForClaim: false,
  isFirstTouch: false,
  isCustomPricing: false,
  isContractLegalSecurity: false,
  isDemoOrNegotiation: false,
};

interface Case {
  name: string;
  overrides: Partial<ActionContext>;
  expected: PolicyDecisionResult;
}

const cases: Case[] = [
  {
    name: 'allows when every guardrail passes',
    overrides: {},
    expected: {
      outcome: 'ALLOW',
      riskLevel: 'GREEN',
      rulesTriggered: ['GREEN_ALL_CHECKS_PASS'],
      reason: 'All autonomous action checks passed',
    },
  },
  {
    name: 'blocks suppressed contacts/accounts',
    overrides: { hasSuppression: true },
    expected: {
      outcome: 'BLOCK',
      riskLevel: 'RED',
      rulesTriggered: ['SUPPRESSION'],
      reason: 'Contact/account is suppressed',
    },
  },
  {
    name: 'blocks while an inbound reply is pending classification',
    overrides: { inboundPending: true },
    expected: {
      outcome: 'BLOCK',
      riskLevel: 'RED',
      rulesTriggered: ['INBOUND_PENDING'],
      reason: 'Outbound is paused while inbound is unresolved',
    },
  },
  {
    name: 'blocks unverified channels',
    overrides: { verifiedChannel: false },
    expected: {
      outcome: 'BLOCK',
      riskLevel: 'RED',
      rulesTriggered: ['CHANNEL_UNVERIFIED'],
      reason: 'External action requires verified channel',
    },
  },
  {
    name: 'blocks when the frequency cap was exceeded',
    overrides: { frequencyCapOk: false },
    expected: {
      outcome: 'BLOCK',
      riskLevel: 'RED',
      rulesTriggered: ['FREQUENCY_CAP'],
      reason: 'Frequency cap exceeded',
    },
  },
  {
    name: 'blocks confidence below the 0.75 external-action threshold',
    overrides: { confidence: 0.5 },
    expected: {
      outcome: 'BLOCK',
      riskLevel: 'RED',
      rulesTriggered: ['LOW_CONFIDENCE'],
      reason: 'Confidence below external-action threshold',
    },
  },
  {
    name: 'confidence of exactly 0.75 clears the low-confidence block',
    overrides: { confidence: 0.75 },
    expected: {
      outcome: 'REQUIRE_APPROVAL',
      riskLevel: 'YELLOW',
      rulesTriggered: ['CONFIDENCE_REVIEW'],
      reason: 'Human approval required by MVP guardrails',
    },
  },
  {
    name: 'confidence of exactly 0.90 clears the confidence-review escalation',
    overrides: { confidence: 0.9 },
    expected: {
      outcome: 'ALLOW',
      riskLevel: 'GREEN',
      rulesTriggered: ['GREEN_ALL_CHECKS_PASS'],
      reason: 'All autonomous action checks passed',
    },
  },
  {
    name: 'blocks unsupported technical/legal claims',
    overrides: { containsTechnicalOrLegalClaim: true, approvedKnowledgeForClaim: false },
    expected: {
      outcome: 'BLOCK',
      riskLevel: 'RED',
      rulesTriggered: ['UNSUPPORTED_TECH_LEGAL_CLAIM'],
      reason: 'Technical/legal claim lacks approved support',
    },
  },
  {
    name: 'allows technical/legal claims backed by approved knowledge',
    overrides: { containsTechnicalOrLegalClaim: true, approvedKnowledgeForClaim: true },
    expected: {
      outcome: 'ALLOW',
      riskLevel: 'GREEN',
      rulesTriggered: ['GREEN_ALL_CHECKS_PASS'],
      reason: 'All autonomous action checks passed',
    },
  },
  {
    name: 'blocks when required evidence is missing or expired',
    overrides: { requiredEvidencePresent: false },
    expected: {
      outcome: 'BLOCK',
      riskLevel: 'RED',
      rulesTriggered: ['MISSING_EVIDENCE'],
      reason: 'Required evidence is absent or expired',
    },
  },
  {
    name: 'RED action class always requires a human',
    overrides: { actionClass: 'RED' },
    expected: {
      outcome: 'REQUIRE_APPROVAL',
      riskLevel: 'RED',
      rulesTriggered: ['RED_ACTION'],
      reason: 'Red actions always require a human',
    },
  },
  {
    name: 'custom pricing always requires a human',
    overrides: { isCustomPricing: true },
    expected: {
      outcome: 'REQUIRE_APPROVAL',
      riskLevel: 'RED',
      rulesTriggered: ['RED_ACTION'],
      reason: 'Red actions always require a human',
    },
  },
  {
    name: 'contract/legal/security topics always require a human',
    overrides: { isContractLegalSecurity: true },
    expected: {
      outcome: 'REQUIRE_APPROVAL',
      riskLevel: 'RED',
      rulesTriggered: ['RED_ACTION'],
      reason: 'Red actions always require a human',
    },
  },
  {
    name: 'demo/negotiation actions always require a human',
    overrides: { isDemoOrNegotiation: true },
    expected: {
      outcome: 'REQUIRE_APPROVAL',
      riskLevel: 'RED',
      rulesTriggered: ['RED_ACTION'],
      reason: 'Red actions always require a human',
    },
  },
  {
    name: 'VIP accounts escalate to RED approval even on GREEN-class actions',
    overrides: { accountVip: true },
    expected: {
      outcome: 'REQUIRE_APPROVAL',
      riskLevel: 'RED',
      rulesTriggered: ['VIP_ACCOUNT'],
      reason: 'Human approval required by MVP guardrails',
    },
  },
  {
    name: 'first touch requires YELLOW approval',
    overrides: { isFirstTouch: true },
    expected: {
      outcome: 'REQUIRE_APPROVAL',
      riskLevel: 'YELLOW',
      rulesTriggered: ['FIRST_TOUCH'],
      reason: 'Human approval required by MVP guardrails',
    },
  },
  {
    name: 'YELLOW action class requires YELLOW approval',
    overrides: { actionClass: 'YELLOW' },
    expected: {
      outcome: 'REQUIRE_APPROVAL',
      riskLevel: 'YELLOW',
      rulesTriggered: ['YELLOW_CLASS'],
      reason: 'Human approval required by MVP guardrails',
    },
  },
  {
    name: 'stacks multiple YELLOW-tier rules and keeps VIP escalation to RED',
    overrides: { accountVip: true, isFirstTouch: true },
    expected: {
      outcome: 'REQUIRE_APPROVAL',
      riskLevel: 'RED',
      rulesTriggered: ['VIP_ACCOUNT', 'FIRST_TOUCH'],
      reason: 'Human approval required by MVP guardrails',
    },
  },
];

describe('evaluateAction', () => {
  it.each(cases.map((c) => [c.name, c] as const))('%s', (_name, testCase) => {
    const result = evaluateAction({ ...BASE, ...testCase.overrides });
    expect(result).toEqual(testCase.expected);
  });

  it('checks suppression before any other rule (short-circuit ordering)', () => {
    const result = evaluateAction({
      ...BASE,
      hasSuppression: true,
      inboundPending: true,
      verifiedChannel: false,
      frequencyCapOk: false,
      confidence: 0,
      requiredEvidencePresent: false,
    });
    expect(result.rulesTriggered).toEqual(['SUPPRESSION']);
  });

  it('checks inbound-pending before channel/frequency/confidence/evidence rules', () => {
    const result = evaluateAction({
      ...BASE,
      inboundPending: true,
      verifiedChannel: false,
      frequencyCapOk: false,
      confidence: 0,
      requiredEvidencePresent: false,
    });
    expect(result.rulesTriggered).toEqual(['INBOUND_PENDING']);
  });
});
