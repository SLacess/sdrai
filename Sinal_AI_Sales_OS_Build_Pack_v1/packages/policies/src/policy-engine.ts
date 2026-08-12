export type RiskLevel = 'GREEN'|'YELLOW'|'RED';
export type PolicyOutcome = 'ALLOW'|'REQUIRE_APPROVAL'|'BLOCK';

export interface ActionContext {
  action: string;
  actionClass: RiskLevel;
  confidence: number;
  accountVip: boolean;
  hasSuppression: boolean;
  frequencyCapOk: boolean;
  requiredEvidencePresent: boolean;
  verifiedChannel: boolean;
  inboundPending: boolean;
  containsTechnicalOrLegalClaim: boolean;
  approvedKnowledgeForClaim: boolean;
  isFirstTouch: boolean;
  isCustomPricing: boolean;
  isContractLegalSecurity: boolean;
  isDemoOrNegotiation: boolean;
}

export interface PolicyDecisionResult {
  outcome: PolicyOutcome;
  riskLevel: RiskLevel;
  rulesTriggered: string[];
  reason: string;
}

export function evaluateAction(c: ActionContext): PolicyDecisionResult {
  const rules: string[] = [];
  if (c.hasSuppression) return block('SUPPRESSION', 'Contact/account is suppressed');
  if (c.inboundPending) return block('INBOUND_PENDING', 'Outbound is paused while inbound is unresolved');
  if (!c.verifiedChannel) return block('CHANNEL_UNVERIFIED', 'External action requires verified channel');
  if (!c.frequencyCapOk) return block('FREQUENCY_CAP', 'Frequency cap exceeded');
  if (c.confidence < 0.75) return block('LOW_CONFIDENCE', 'Confidence below external-action threshold');
  if (c.containsTechnicalOrLegalClaim && !c.approvedKnowledgeForClaim) return block('UNSUPPORTED_TECH_LEGAL_CLAIM', 'Technical/legal claim lacks approved support');
  if (!c.requiredEvidencePresent) return block('MISSING_EVIDENCE', 'Required evidence is absent or expired');

  if (c.actionClass === 'RED' || c.isCustomPricing || c.isContractLegalSecurity || c.isDemoOrNegotiation) {
    return approval('RED_ACTION', 'Red actions always require a human');
  }
  if (c.accountVip) rules.push('VIP_ACCOUNT');
  if (c.isFirstTouch) rules.push('FIRST_TOUCH');
  if (c.confidence < 0.90) rules.push('CONFIDENCE_REVIEW');
  if (c.actionClass === 'YELLOW') rules.push('YELLOW_CLASS');

  if (rules.length) return { outcome:'REQUIRE_APPROVAL', riskLevel: c.accountVip ? 'RED' : 'YELLOW', rulesTriggered:rules, reason:'Human approval required by MVP guardrails' };
  return { outcome:'ALLOW', riskLevel:'GREEN', rulesTriggered:['GREEN_ALL_CHECKS_PASS'], reason:'All autonomous action checks passed' };
}
function block(rule:string, reason:string):PolicyDecisionResult { return {outcome:'BLOCK',riskLevel:'RED',rulesTriggered:[rule],reason}; }
function approval(rule:string, reason:string):PolicyDecisionResult { return {outcome:'REQUIRE_APPROVAL',riskLevel:'RED',rulesTriggered:[rule],reason}; }
