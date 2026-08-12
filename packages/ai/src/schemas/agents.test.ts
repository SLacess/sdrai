import { describe, expect, it } from 'vitest';
import { AgentSchemas } from './agents';
import type { z } from 'zod';

const UUID = '11111111-1111-4111-8111-111111111111';

function baseEnvelope(extra: Record<string, unknown> = {}) {
  return {
    runId: UUID,
    agent: 'test_agent',
    agentVersion: '1.0.0',
    status: 'success' as const,
    confidence: 0.9,
    createdAt: '2026-08-11T00:00:00.000Z',
    ...extra,
  };
}

interface Fixture {
  valid: Record<string, unknown>;
  invalid: Record<string, unknown>;
  invalidReason: string;
}

const fixtures: Record<keyof typeof AgentSchemas, Fixture> = {
  account_hunter: {
    valid: baseEnvelope({
      accounts: [
        { brandName: 'Acme', domain: 'acme.com', sourceUris: ['https://acme.com'], fitHints: [] },
      ],
    }),
    invalid: baseEnvelope({
      accounts: [{ brandName: 'Acme', domain: 'acme.com', sourceUris: [] }],
    }),
    invalidReason: 'sourceUris requires at least one source (no unsourced accounts)',
  },
  research_agent: {
    valid: baseEnvelope({
      dossier: { summary: 'Overview', digitalAssets: ['acme.com'], initiatives: [], sourceCoverage: 0.8 },
    }),
    invalid: baseEnvelope({
      dossier: { summary: 'Overview', digitalAssets: [], initiatives: [], sourceCoverage: 1.5 },
    }),
    invalidReason: 'sourceCoverage must be within 0..1',
  },
  accessibility_intelligence: {
    valid: baseEnvelope({
      signals: [
        {
          type: 'contrast',
          severity: 'medium',
          description: 'Low contrast on CTA',
          evidenceIds: [UUID],
          scanIsIndicator: true,
        },
      ],
      opportunityScore: 70,
      disclaimer: 'Automated scan is an indicator, not a compliance declaration.',
    }),
    invalid: baseEnvelope({
      signals: [
        {
          type: 'contrast',
          severity: 'medium',
          description: 'Low contrast on CTA',
          evidenceIds: [UUID],
          scanIsIndicator: false,
        },
      ],
      opportunityScore: 70,
      disclaimer: 'x',
    }),
    invalidReason: 'scanIsIndicator must always be literal true — never a compliance declaration',
  },
  buying_committee_mapper: {
    valid: baseEnvelope({
      contacts: [
        {
          name: 'Jane Doe',
          role: 'DECISION_MAKER',
          channel: { type: 'EMAIL', address: 'jane@acme.com', verified: true },
          confidence: 0.8,
          sourceEvidenceIds: [UUID],
        },
      ],
    }),
    invalid: baseEnvelope({
      contacts: [
        {
          name: 'Jane Doe',
          role: 'CEO',
          channel: { type: 'EMAIL', address: 'jane@acme.com', verified: true },
          confidence: 0.8,
          sourceEvidenceIds: [UUID],
        },
      ],
    }),
    invalidReason: 'role must be one of the enumerated buying-committee roles',
  },
  scoring_agent: {
    valid: baseEnvelope({ score: 82, priority: 'A', factors: { companyFit: 90 }, explanation: ['strong fit'] }),
    invalid: baseEnvelope({ score: 150, priority: 'A', factors: {}, explanation: [] }),
    invalidReason: 'score must be within 0..100',
  },
  message_angle_agent: {
    valid: baseEnvelope({
      angle: { name: 'Accessibility risk', personaRelevance: 'CTO', problemFrame: 'x', cta: 'Book a call', evidenceIds: [UUID] },
      alternatives: ['a', 'b', 'c'],
    }),
    invalid: baseEnvelope({
      angle: { name: 'Accessibility risk', personaRelevance: 'CTO', problemFrame: 'x', cta: 'Book a call', evidenceIds: [UUID] },
      alternatives: ['a', 'b', 'c', 'd'],
    }),
    invalidReason: 'alternatives may contain at most 3 entries',
  },
  personalization_writer: {
    valid: baseEnvelope({
      draft: {
        body: 'Hello',
        language: 'pt-BR',
        evidenceIds: [UUID],
        knowledgeItemIds: [UUID],
        claims: [{ text: 'x', support: [{ evidenceId: UUID, claim: 'x' }] }],
      },
    }),
    invalid: baseEnvelope({
      draft: {
        body: 'Hello',
        language: 'fr',
        evidenceIds: [UUID],
        knowledgeItemIds: [UUID],
        claims: [],
      },
    }),
    invalidReason: 'language must be one of pt-BR, es, en',
  },
  outreach_scheduler: {
    valid: baseEnvelope({ nextAction: null }),
    invalid: baseEnvelope({
      nextAction: { actionType: 'follow_up', scheduledAt: '2026-08-12T00:00:00.000Z', channel: 'SMS', reason: 'x' },
    }),
    invalidReason: 'channel must be one of EMAIL, LINKEDIN, PHONE, INTERNAL',
  },
  reply_classifier: {
    valid: baseEnvelope({
      classification: {
        intent: 'OPT_OUT',
        sentiment: 'NEUTRAL',
        objectionType: null,
        requiresHuman: true,
        pauseSequence: true,
      },
    }),
    invalid: baseEnvelope({
      classification: {
        intent: 'OPT_OUT',
        sentiment: 'NEUTRAL',
        objectionType: null,
        requiresHuman: true,
        pauseSequence: false,
      },
    }),
    invalidReason: 'pauseSequence must always be literal true — any inbound pauses the sequence',
  },
  reply_composer: {
    valid: baseEnvelope({ draft: null, escalationReason: 'Requires human: legal question' }),
    invalid: baseEnvelope({
      draft: { body: 'x', language: 'pt-BR', actionClass: 'BLUE', knowledgeItemIds: [], evidenceIds: [] },
      escalationReason: null,
    }),
    invalidReason: 'actionClass must be one of GREEN, YELLOW, RED',
  },
  qualification_agent: {
    valid: baseEnvelope({
      qualification: {
        fit: true,
        relevantPerson: true,
        need: 'Accessibility remediation',
        scope: { channels: [] },
        engagement: 'positive',
        timing: null,
        blockers: [],
        missingFields: [],
        isSql: true,
        handoffReason: null,
        nextQuestion: null,
      },
    }),
    invalid: baseEnvelope({
      qualification: {
        fit: true,
        relevantPerson: true,
        need: null,
        scope: { channels: [] },
        engagement: 'medium',
        timing: null,
        blockers: [],
        missingFields: ['need'],
        isSql: false,
        handoffReason: null,
        nextQuestion: null,
      },
    }),
    invalidReason: 'engagement must be one of none, neutral, positive, high',
  },
  meeting_coordinator: {
    valid: baseEnvelope({
      action: 'PROPOSE_SLOTS',
      slots: ['2026-08-12T14:00:00.000Z', '2026-08-12T15:00:00.000Z'],
      timezone: 'America/Sao_Paulo',
      participants: [],
      escalationReason: null,
    }),
    invalid: baseEnvelope({
      action: 'PROPOSE_SLOTS',
      slots: [
        '2026-08-12T14:00:00.000Z',
        '2026-08-12T15:00:00.000Z',
        '2026-08-12T16:00:00.000Z',
        '2026-08-12T17:00:00.000Z',
        '2026-08-12T18:00:00.000Z',
        '2026-08-12T19:00:00.000Z',
      ],
      timezone: 'America/Sao_Paulo',
      participants: [],
      escalationReason: null,
    }),
    invalidReason: 'slots may contain at most 5 entries',
  },
  meeting_prep_agent: {
    valid: baseEnvelope({
      brief: {
        executiveSummary: 'x',
        participants: [{ name: 'Jane Doe', role: 'CTO' }],
        history: [],
        verifiedFacts: [{ claim: 'Uses WordPress', evidenceId: UUID }],
        hypotheses: [],
        objectives: [],
        questions: [],
        likelyObjections: [],
        recommendedOffer: null,
        risks: [],
        doNotSay: [],
      },
    }),
    invalid: baseEnvelope({
      brief: {
        executiveSummary: 'x',
        participants: [{ name: 'Jane Doe' }],
        history: [],
        verifiedFacts: [{ claim: 'Uses WordPress' }],
        hypotheses: [],
        objectives: [],
        questions: [],
        likelyObjections: [],
        recommendedOffer: null,
        risks: [],
        doNotSay: [],
      },
    }),
    invalidReason: 'every verified fact must carry an evidenceId',
  },
  crm_sync_agent: {
    valid: baseEnvelope({
      operations: [{ object: 'COMPANY', operation: 'UPDATE', externalId: 'hs-1', fields: { name: 'Acme' } }],
    }),
    invalid: baseEnvelope({
      operations: [{ object: 'LEAD', operation: 'UPDATE', externalId: 'hs-1', fields: {} }],
    }),
    invalidReason: 'object must be one of COMPANY, CONTACT, DEAL, NOTE, ACTIVITY',
  },
  ai_supervisor: {
    valid: baseEnvelope({
      verdict: 'PASS',
      unsupportedClaims: [],
      staleEvidenceIds: [],
      genericityScore: 0.2,
      personalizationScore: 0.8,
      policyRisk: 'GREEN',
      requiredApproval: false,
      reasons: [],
    }),
    invalid: baseEnvelope({
      verdict: 'PASS',
      unsupportedClaims: [],
      staleEvidenceIds: [],
      genericityScore: 1.2,
      personalizationScore: 0.8,
      policyRisk: 'GREEN',
      requiredApproval: false,
      reasons: [],
    }),
    invalidReason: 'genericityScore must be within 0..1',
  },
  learning_analyst: {
    valid: baseEnvelope({
      proposals: [
        {
          type: 'PROMPT',
          currentVersion: 'v3',
          proposal: 'Shorten CTA',
          evidence: ['EVAL-004 regression'],
          expectedImpact: 'higher reply rate',
          risk: 'LOW',
          requiresOfflineEval: true,
        },
      ],
    }),
    invalid: baseEnvelope({
      proposals: [
        {
          type: 'PROMPT',
          currentVersion: 'v3',
          proposal: 'Shorten CTA',
          evidence: [],
          expectedImpact: 'higher reply rate',
          risk: 'LOW',
          requiresOfflineEval: false,
        },
      ],
    }),
    invalidReason: 'requiresOfflineEval must always be literal true — no unrestricted auto-learning',
  },
};

describe('AgentSchemas contract', () => {
  it('covers exactly the 16 agents declared in the manifest', () => {
    expect(Object.keys(AgentSchemas).sort()).toEqual(Object.keys(fixtures).sort());
    expect(Object.keys(AgentSchemas)).toHaveLength(16);
  });

  it.each(Object.keys(fixtures) as Array<keyof typeof AgentSchemas>)('%s accepts a valid envelope', (agent) => {
    const schema = AgentSchemas[agent] as z.ZodTypeAny;
    const result = schema.safeParse(fixtures[agent].valid);
    expect(result.success, result.success ? undefined : JSON.stringify(result.error.issues)).toBe(true);
  });

  it.each(Object.keys(fixtures) as Array<keyof typeof AgentSchemas>)(
    '%s rejects an envelope that violates its contract',
    (agent) => {
      const schema = AgentSchemas[agent] as z.ZodTypeAny;
      const result = schema.safeParse(fixtures[agent].invalid);
      expect(result.success).toBe(false);
    },
  );

  it('rejects an envelope missing the shared base fields regardless of agent', () => {
    const { runId: _runId, ...withoutRunId } = fixtures.scoring_agent.valid;
    const result = AgentSchemas.scoring_agent.safeParse(withoutRunId);
    expect(result.success).toBe(false);
  });
});
