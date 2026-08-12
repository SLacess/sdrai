import type { Prisma, PrismaClient, Score } from '@prisma/client';
import { calculateAccountScore, type AccountScoreFactors } from '@sinal/domain';

export const ACCOUNT_SCORE_MODEL_VERSION = 'account-score-v1';

/**
 * Persists a versioned, explainable score: the total AND the factors that
 * produced it (CLAUDE.md: never save just `score = 87`), then updates the
 * account's priorityBand to match. Scoring is deterministic and pure in
 * @sinal/domain; this is only the persistence/versioning wrapper around it.
 */
export async function recordAccountScore(
  prisma: PrismaClient,
  accountId: string,
  factors: AccountScoreFactors,
): Promise<Score> {
  const { total, priority } = calculateAccountScore(factors);

  const score = await prisma.score.create({
    data: {
      scoreType: 'ACCOUNT_PRIORITY',
      total,
      factorsJson: factors as unknown as Prisma.InputJsonValue,
      modelVersion: ACCOUNT_SCORE_MODEL_VERSION,
      accountId,
    },
  });

  await prisma.account.update({ where: { id: accountId }, data: { priorityBand: priority } });

  return score;
}
