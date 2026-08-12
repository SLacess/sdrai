export interface EvidenceLike {
  id: string;
  expiresAt: Date | null;
}

export function isEvidenceExpired(expiresAt: Date | null, now: Date = new Date()): boolean {
  return expiresAt !== null && expiresAt.getTime() <= now.getTime();
}

export function filterActiveEvidence<T extends EvidenceLike>(items: readonly T[], now: Date = new Date()): T[] {
  return items.filter((item) => !isEvidenceExpired(item.expiresAt, now));
}

export interface EvidenceCheckResult {
  allPresent: boolean;
  missingIds: string[];
  expiredIds: string[];
}

/**
 * A claim referencing evidence is only externally usable when every required
 * evidence id both exists and is unexpired (CLAUDE.md rule: facts used
 * externally must reference current Evidence/KnowledgeItem, never stale ones).
 */
export function checkRequiredEvidence(
  requiredIds: readonly string[],
  available: readonly EvidenceLike[],
  now: Date = new Date(),
): EvidenceCheckResult {
  const byId = new Map(available.map((item) => [item.id, item]));
  const missingIds: string[] = [];
  const expiredIds: string[] = [];

  for (const id of requiredIds) {
    const evidence = byId.get(id);
    if (!evidence) {
      missingIds.push(id);
      continue;
    }
    if (isEvidenceExpired(evidence.expiresAt, now)) expiredIds.push(id);
  }

  return { allPresent: missingIds.length === 0 && expiredIds.length === 0, missingIds, expiredIds };
}
