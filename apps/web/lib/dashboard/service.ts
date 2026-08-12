import { listPendingApprovals, type Approval, type PrismaClient } from '@sinal/db';

const QUEUE_LIMIT = 10;

export interface CommandCenterMetrics {
  totalAccounts: number;
  qualifiedAccounts: number;
  totalContacts: number;
  pendingApprovals: number;
  totalAgentRuns: number;
  failedAgentRuns: number;
  aiSpendMicrosUsd: number;
}

export interface SqlQueueItemDTO {
  contactId: string;
  contactName: string;
  accountId: string;
  accountName: string;
  updatedAt: Date;
}

export interface UpcomingMeetingDTO {
  meetingId: string;
  scheduledAt: Date;
  timezone: string;
  status: string;
  accountId: string;
  accountName: string;
}

export interface AgentFailureDTO {
  id: string;
  agent: string;
  errorMessage: string | null;
  createdAt: Date;
  correlationId: string;
}

export interface CommandCenterQueueDTO {
  metrics: CommandCenterMetrics;
  sqlQueue: SqlQueueItemDTO[];
  upcomingMeetings: UpcomingMeetingDTO[];
  pendingApprovals: Approval[];
  recentFailures: AgentFailureDTO[];
}

/**
 * One aggregate read for the Command Center: KPIs plus the four queues an
 * SDR needs to triage first (SQLs waiting on outreach, meetings coming up,
 * approvals blocking a send, and agent runs that need investigation).
 */
export async function loadCommandCenterQueue(
  prisma: PrismaClient,
  now: Date = new Date(),
): Promise<CommandCenterQueueDTO> {
  const [
    totalAccounts,
    qualifiedAccounts,
    totalContacts,
    pendingApprovalsCount,
    totalAgentRuns,
    failedAgentRuns,
    spend,
    sqlContacts,
    meetings,
    approvals,
    failures,
  ] = await Promise.all([
    prisma.account.count(),
    prisma.account.count({ where: { status: 'QUALIFIED_ACCOUNT' } }),
    prisma.contact.count(),
    prisma.approval.count({ where: { status: 'PENDING' } }),
    prisma.agentRun.count(),
    prisma.agentRun.count({ where: { status: 'FAILED' } }),
    prisma.agentRun.aggregate({ _sum: { costMicrosUsd: true } }),
    prisma.contact.findMany({
      where: { leadState: 'SQL' },
      orderBy: { updatedAt: 'desc' },
      take: QUEUE_LIMIT,
      include: { account: true },
    }),
    prisma.meeting.findMany({
      where: { scheduledAt: { gte: now } },
      orderBy: { scheduledAt: 'asc' },
      take: QUEUE_LIMIT,
      include: { opportunity: { include: { account: true } } },
    }),
    listPendingApprovals(prisma, { limit: 5 }),
    prisma.agentRun.findMany({
      where: { status: 'FAILED' },
      orderBy: { createdAt: 'desc' },
      take: QUEUE_LIMIT,
    }),
  ]);

  return {
    metrics: {
      totalAccounts,
      qualifiedAccounts,
      totalContacts,
      pendingApprovals: pendingApprovalsCount,
      totalAgentRuns,
      failedAgentRuns,
      aiSpendMicrosUsd: spend._sum.costMicrosUsd ?? 0,
    },
    sqlQueue: sqlContacts.map((contact) => ({
      contactId: contact.id,
      contactName: contact.name,
      accountId: contact.account.id,
      accountName: contact.account.brandName,
      updatedAt: contact.updatedAt,
    })),
    upcomingMeetings: meetings.map((meeting) => ({
      meetingId: meeting.id,
      scheduledAt: meeting.scheduledAt,
      timezone: meeting.timezone,
      status: meeting.status,
      accountId: meeting.opportunity.account.id,
      accountName: meeting.opportunity.account.brandName,
    })),
    pendingApprovals: approvals,
    recentFailures: failures.map((run) => ({
      id: run.id,
      agent: run.agent,
      errorMessage: run.errorMessage,
      createdAt: run.createdAt,
      correlationId: run.correlationId,
    })),
  };
}
