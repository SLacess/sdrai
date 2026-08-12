import { AccountStatus, PriorityBand, type Prisma, type PrismaClient } from '@sinal/db';
import { isEvidenceExpired } from '@sinal/domain';
import { NotFoundError, ValidationError } from '@/lib/http/errors';

const PAGE_SIZE = 25;

export interface ListAccountsParams {
  status?: string | null;
  priority?: string | null;
  cursor?: string | null;
}

export interface AccountSummaryDTO {
  id: string;
  brandName: string;
  domain: string;
  status: string;
  priorityBand: string | null;
  score: number | null;
}

export interface AccountListDTO {
  items: AccountSummaryDTO[];
  nextCursor: string | null;
}

export type EvidenceFreshness = 'FRESH' | 'EXPIRED' | 'NO_EXPIRY';

export interface EvidenceSummaryDTO {
  id: string;
  claim: string;
  sourceUri: string | null;
  confidence: number;
  expiresAt: Date | null;
  freshness: EvidenceFreshness;
}

export interface OpportunityMeetingDTO {
  id: string;
  scheduledAt: Date;
  timezone: string;
  status: string;
  hasBrief: boolean;
}

export interface OpportunitySummaryDTO {
  id: string;
  stage: string;
  need: string | null;
  score: number | null;
  arrPotentialMin: number | null;
  arrPotentialMax: number | null;
  currency: string;
  nextAction: string | null;
  hubspotDealId: string | null;
  meetings: OpportunityMeetingDTO[];
}

export interface MessageDraftSummaryDTO {
  id: string;
  contactId: string;
  contactName: string;
  angle: string | null;
  subject: string | null;
  status: string;
  riskLevel: string;
  createdAt: Date;
}

export interface Account360DTO extends AccountSummaryDTO {
  hubspotId: string | null;
  evidence: EvidenceSummaryDTO[];
  signals: unknown[];
  contacts: unknown[];
  timeline: unknown[];
  opportunities: OpportunitySummaryDTO[];
  messageDrafts: MessageDraftSummaryDTO[];
}

function toEvidenceSummary(evidence: { id: string; claim: string; sourceUri: string | null; confidence: number; expiresAt: Date | null }, now: Date): EvidenceSummaryDTO {
  const freshness: EvidenceFreshness = evidence.expiresAt === null ? 'NO_EXPIRY' : isEvidenceExpired(evidence.expiresAt, now) ? 'EXPIRED' : 'FRESH';
  return {
    id: evidence.id,
    claim: evidence.claim,
    sourceUri: evidence.sourceUri,
    confidence: evidence.confidence,
    expiresAt: evidence.expiresAt,
    freshness,
  };
}

function assertValidEnum(value: string, allowed: readonly string[], field: string): void {
  if (!allowed.includes(value)) {
    throw new ValidationError(`Invalid ${field} "${value}". Expected one of: ${allowed.join(', ')}`);
  }
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  const [iso, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  if (!iso || !id || Number.isNaN(Date.parse(iso))) {
    throw new ValidationError('Invalid pagination cursor');
  }
  return { createdAt: new Date(iso), id };
}

type AccountWithLatestScore = Prisma.AccountGetPayload<{
  include: { scores: true };
}>;

function toAccountSummary(account: AccountWithLatestScore): AccountSummaryDTO {
  return {
    id: account.id,
    brandName: account.brandName,
    domain: account.domain,
    status: account.status,
    priorityBand: account.priorityBand ?? null,
    score: account.scores[0]?.total ?? null,
  };
}

export async function listAccounts(prisma: PrismaClient, params: ListAccountsParams): Promise<AccountListDTO> {
  if (params.status) assertValidEnum(params.status, Object.values(AccountStatus), 'status');
  if (params.priority) assertValidEnum(params.priority, Object.values(PriorityBand), 'priority');

  const where: Prisma.AccountWhereInput = {};
  if (params.status) where.status = params.status as AccountStatus;
  if (params.priority) where.priorityBand = params.priority as PriorityBand;

  if (params.cursor) {
    const { createdAt, id } = decodeCursor(params.cursor);
    where.OR = [{ createdAt: { gt: createdAt } }, { createdAt, id: { gt: id } }];
  }

  const rows = await prisma.account.findMany({
    where,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: PAGE_SIZE + 1,
    include: {
      scores: { where: { scoreType: 'ACCOUNT_PRIORITY' }, orderBy: { calculatedAt: 'desc' }, take: 1 },
    },
  });

  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const last = page.at(-1);
  const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null;

  return { items: page.map(toAccountSummary), nextCursor };
}

export async function getAccountById(prisma: PrismaClient, id: string): Promise<Account360DTO> {
  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      scores: { where: { scoreType: 'ACCOUNT_PRIORITY' }, orderBy: { calculatedAt: 'desc' }, take: 1 },
      evidence: true,
      signals: true,
      contacts: { include: { messageDrafts: { orderBy: { createdAt: 'desc' } } } },
      stateEvents: { orderBy: { timestamp: 'desc' } },
      opportunities: {
        orderBy: { updatedAt: 'desc' },
        include: { meetings: { orderBy: { scheduledAt: 'desc' } } },
      },
    },
  });
  if (!account) throw new NotFoundError(`Account ${id} not found`);

  const now = new Date();
  const messageDrafts: MessageDraftSummaryDTO[] = account.contacts.flatMap((contact) =>
    contact.messageDrafts.map((draft) => ({
      id: draft.id,
      contactId: contact.id,
      contactName: contact.name,
      angle: draft.angle,
      subject: draft.subject,
      status: draft.status,
      riskLevel: draft.riskLevel,
      createdAt: draft.createdAt,
    })),
  );

  const opportunities: OpportunitySummaryDTO[] = account.opportunities.map((opportunity) => ({
    id: opportunity.id,
    stage: opportunity.stage,
    need: opportunity.need,
    score: opportunity.score,
    arrPotentialMin: opportunity.arrPotentialMin,
    arrPotentialMax: opportunity.arrPotentialMax,
    currency: opportunity.currency,
    nextAction: opportunity.nextAction,
    hubspotDealId: opportunity.hubspotDealId,
    meetings: opportunity.meetings.map((meeting) => ({
      id: meeting.id,
      scheduledAt: meeting.scheduledAt,
      timezone: meeting.timezone,
      status: meeting.status,
      hasBrief: meeting.briefId !== null,
    })),
  }));

  return {
    ...toAccountSummary(account),
    hubspotId: account.hubspotId,
    evidence: account.evidence.map((item) => toEvidenceSummary(item, now)),
    signals: account.signals,
    contacts: account.contacts,
    timeline: account.stateEvents,
    opportunities,
    messageDrafts,
  };
}
