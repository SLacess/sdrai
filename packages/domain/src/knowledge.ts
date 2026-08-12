export type KnowledgeApprovalStateLike = 'DRAFT' | 'APPROVED' | 'DEPRECATED';

export interface KnowledgeItemLike {
  approvalState: KnowledgeApprovalStateLike;
  validFrom: Date | null;
  validUntil: Date | null;
}

/**
 * "Only APPROVED+valid items usable externally" (Sales Brain, BP-042) —
 * approval state alone isn't enough, since an APPROVED item can still be
 * outside its validity window (not yet effective, or expired). Recomputed
 * here so the persistence layer never trusts a stale query result: an item
 * that was valid when fetched but has since lapsed is caught by re-running
 * this at the moment of use, same pattern as evidence freshness checks.
 */
export function isKnowledgeItemUsable(item: KnowledgeItemLike, now: Date = new Date()): boolean {
  if (item.approvalState !== 'APPROVED') return false;
  if (item.validFrom !== null && item.validFrom.getTime() > now.getTime()) return false;
  if (item.validUntil !== null && item.validUntil.getTime() < now.getTime()) return false;
  return true;
}
