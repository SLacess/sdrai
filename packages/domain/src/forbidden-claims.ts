/**
 * CLAUDE.md rule 13: never affirm "100% acessível", "garantimos compliance",
 * or "seu site viola a lei" without a human-approved artifact that
 * literally authorizes the claim. These defaults exist so the check has
 * teeth even before a supervisor configures the Policies UI's forbidden
 * claims list — a fresh install is never permissive by omission.
 */
export const DEFAULT_FORBIDDEN_CLAIMS: readonly string[] = [
  '100% acessível',
  '100% accessible',
  'garantimos compliance',
  'garantia de compliance',
  'seu site viola a lei',
  'totalmente compatível com a lei',
];

/**
 * Case-insensitive substring match against a configurable forbidden-phrase
 * list — a deterministic backstop independent of the ai_supervisor agent's
 * own judgment, so a phrase this list bans can never reach an external
 * send even if the model (or the supervisor agent reviewing it) misses it.
 */
export function findForbiddenClaim(text: string, forbiddenPhrases: readonly string[]): string | null {
  const lowerText = text.toLowerCase();
  for (const phrase of forbiddenPhrases) {
    if (lowerText.includes(phrase.toLowerCase())) return phrase;
  }
  return null;
}
