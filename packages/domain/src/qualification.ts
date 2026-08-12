export type EngagementLevel = 'none' | 'neutral' | 'positive' | 'high';

export interface QualificationScope {
  domains?: number;
  channels: string[];
  description?: string;
}

export interface QualificationCriteria {
  fit: boolean;
  relevantPerson: boolean;
  need: string | null;
  scope: QualificationScope;
  engagement: EngagementLevel;
  blockers: string[];
}

export interface SqlDetermination {
  isSql: boolean;
  unmetCriteria: string[];
}

/**
 * The deterministic SQL criteria (docs/IMPLEMENTATION_GUIDE.md section 5:
 * fit, relevant person, need, minimal scope, positive engagement, no
 * blockers). This is computed here — never trusted from the agent's own
 * `isSql` claim — so a fixture with a missing need (or any other unmet
 * criterion) is structurally not SQL regardless of what the LLM asserts.
 */
export function determineIsSql(criteria: QualificationCriteria): SqlDetermination {
  const unmetCriteria: string[] = [];

  if (!criteria.fit) unmetCriteria.push('NOT_A_FIT');
  if (!criteria.relevantPerson) unmetCriteria.push('NOT_RELEVANT_PERSON');
  if (!criteria.need) unmetCriteria.push('MISSING_NEED');

  const hasMinimalScope =
    (criteria.scope.domains ?? 0) > 0 || criteria.scope.channels.length > 0 || Boolean(criteria.scope.description);
  if (!hasMinimalScope) unmetCriteria.push('MISSING_SCOPE');

  if (criteria.engagement !== 'positive' && criteria.engagement !== 'high') {
    unmetCriteria.push('ENGAGEMENT_NOT_POSITIVE');
  }
  if (criteria.blockers.length > 0) unmetCriteria.push('HAS_BLOCKERS');

  return { isSql: unmetCriteria.length === 0, unmetCriteria };
}
