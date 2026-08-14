import type { Prisma, PrismaClient, Score } from '@prisma/client';
import { calculateAccountScore, type AccountScoreFactors } from '@sinal/domain';
import { getPolicyConfig, POLICY_CONFIG_KEYS } from './policy-config-service';
import { transitionEntityState } from './state-transition';

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

  // Promote out of RESEARCHING once the score clears the same
  // sqlMinimumAccountScore threshold the Policies UI already exposes —
  // this is what keeps the Command Center's "Qualified accounts" KPI from
  // being permanently stuck at zero. Only promotes from RESEARCHING: an
  // account that hasn't started research yet, or that a human already
  // moved to NURTURE/DISQUALIFIED/SUPPRESSED, is left alone.
  const thresholds = await getPolicyConfig(prisma, POLICY_CONFIG_KEYS.scoreThresholds);
  const sqlMinimumAccountScore = (thresholds.value as { sqlMinimumAccountScore?: number })?.sqlMinimumAccountScore ?? 70;
  if (total >= sqlMinimumAccountScore) {
    const account = await prisma.account.findUnique({ where: { id: accountId }, select: { status: true } });
    if (account?.status === 'RESEARCHING') {
      await transitionEntityState(prisma, {
        entity: 'ACCOUNT',
        id: accountId,
        from: 'RESEARCHING',
        to: 'QUALIFIED_ACCOUNT',
        reason: `Account score ${total} meets SQL minimum threshold ${sqlMinimumAccountScore}`,
        actorType: 'SYSTEM',
      });
    }
  }

  return score;
}
