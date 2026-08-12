import type { Digest, Prisma, PrismaClient } from '@prisma/client';

export interface DailyDigestContent {
  forDate: string;
  metrics: {
    totalAccounts: number;
    qualifiedAccounts: number;
    newSqlCount: number;
    meetingsScheduledCount: number;
    aiSpendMicrosUsd: number;
  };
  pendingApprovals: {
    total: number;
    byRiskLevel: Record<string, number>;
  };
  failures: {
    total: number;
    byAgent: Record<string, number>;
  };
  blockedActions: {
    total: number;
  };
}

export interface GenerateDailyDigestParams {
  forDate: Date;
  windowStart: Date;
  windowEnd: Date;
}

export interface GenerateDailyDigestResult {
  digest: Digest;
  content: DailyDigestContent;
}

/**
 * WF-15: every field here is a count or an aggregate keyed by agent/risk
 * level — never a contact name, email, phone number, or message body. That
 * is the entire PII guarantee: the digest is structurally incapable of
 * naming a person because nothing queried here selects a person-identifying
 * column. Re-running for the same forDate upserts in place (one digest per
 * day), so a retriggered daily job can't accumulate duplicates.
 */
export async function generateDailySupervisorDigest(
  prisma: PrismaClient,
  params: GenerateDailyDigestParams,
): Promise<GenerateDailyDigestResult> {
  const dateRangeFilter = { createdAt: { gte: params.windowStart, lt: params.windowEnd } };

  const [
    totalAccounts,
    qualifiedAccounts,
    newSqlCount,
    meetingsScheduledCount,
    spend,
    pendingApprovalsByRisk,
    failuresByAgent,
    blockedCount,
  ] = await Promise.all([
    prisma.account.count(),
    prisma.account.count({ where: { status: 'QUALIFIED_ACCOUNT' } }),
    prisma.leadStateEvent.count({
      where: { toState: 'SQL', timestamp: { gte: params.windowStart, lt: params.windowEnd } },
    }),
    prisma.meeting.count({ where: dateRangeFilter }),
    prisma.agentRun.aggregate({ _sum: { costMicrosUsd: true }, where: dateRangeFilter }),
    prisma.approval.groupBy({ by: ['riskLevel'], where: { status: 'PENDING' }, _count: true }),
    prisma.agentRun.groupBy({ by: ['agent'], where: { status: 'FAILED', ...dateRangeFilter }, _count: true }),
    prisma.messageDraft.count({ where: { policyState: 'BLOCK', ...dateRangeFilter } }),
  ]);

  const byRiskLevel: Record<string, number> = {};
  let pendingTotal = 0;
  for (const row of pendingApprovalsByRisk) {
    byRiskLevel[row.riskLevel] = row._count;
    pendingTotal += row._count;
  }

  const byAgent: Record<string, number> = {};
  let failuresTotal = 0;
  for (const row of failuresByAgent) {
    byAgent[row.agent] = row._count;
    failuresTotal += row._count;
  }

  const content: DailyDigestContent = {
    forDate: params.forDate.toISOString().slice(0, 10),
    metrics: {
      totalAccounts,
      qualifiedAccounts,
      newSqlCount,
      meetingsScheduledCount,
      aiSpendMicrosUsd: spend._sum.costMicrosUsd ?? 0,
    },
    pendingApprovals: { total: pendingTotal, byRiskLevel },
    failures: { total: failuresTotal, byAgent },
    blockedActions: { total: blockedCount },
  };

  const digest = await prisma.digest.upsert({
    where: { type_forDate: { type: 'DAILY_SUPERVISOR', forDate: params.forDate } },
    create: {
      type: 'DAILY_SUPERVISOR',
      forDate: params.forDate,
      content: content as unknown as Prisma.InputJsonValue,
    },
    update: {
      content: content as unknown as Prisma.InputJsonValue,
      generatedAt: new Date(),
    },
  });

  return { digest, content };
}

export async function getDailySupervisorDigest(prisma: PrismaClient, forDate: Date): Promise<Digest | null> {
  return prisma.digest.findUnique({ where: { type_forDate: { type: 'DAILY_SUPERVISOR', forDate } } });
}
