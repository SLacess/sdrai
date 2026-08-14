import { prisma } from '@sinal/db';
import Link from 'next/link';
import { draftReplyAction } from './actions';
import { describeProposedAction, listInboxThreads } from '@/lib/inbox/service';
import { DataFetchError, EmptyState } from '@/components/DataFetchError';
import { RiskBadge, StatusBadge } from '@/components/RiskBadge';

/**
 * This page never renders a send control — drafting still only ever
 * produces a PENDING_APPROVAL row (createReplyDraft is structurally
 * incapable of sending), and the only place a human decision turns into a
 * send is the Approval Center. That makes "Red reply cannot expose
 * auto-send" true structurally for every risk tier, not just Red: there is
 * nothing to click here that sends anything, only something that drafts.
 */
export default async function InboxPage() {
  let threads: Awaited<ReturnType<typeof listInboxThreads>> | null = null;
  let error: string | null = null;
  try {
    threads = await listInboxThreads(prisma);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Inbox</h1>
        <p className="page-subtitle">Inbound replies, their classification, and the proposed response.</p>
      </div>

      {error && <DataFetchError message={error} />}
      {threads && threads.length === 0 && !error && <EmptyState message="No inbound replies yet." />}

      {threads &&
        threads.map((thread) => (
          <div key={thread.inboundMessageId} className="card">
            <div className="field-row">
              <div className="field">
                <span className="field-label">Contact</span>
                <span className="field-value">
                  <Link href={`/accounts/${thread.accountId}`}>{thread.contactName}</Link>
                  <span className="field-value" style={{ color: 'var(--text-faint)' }}>
                    {' '}
                    · {thread.accountName}
                  </span>
                </span>
              </div>
              <div className="field">
                <span className="field-label">Channel</span>
                <span className="field-value">
                  <span className="badge badge-neutral">{thread.channel}</span>
                </span>
              </div>
              <div className="field">
                <span className="field-label">Received</span>
                <span className="field-value mono">{thread.receivedAt.toISOString()}</span>
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <span className="field-label">Intent</span>
                <span className="field-value">
                  <StatusBadge status={thread.intent} />
                </span>
              </div>
              <div className="field">
                <span className="field-label">Sentiment</span>
                <span className="field-value">
                  <StatusBadge status={thread.sentiment} />
                </span>
              </div>
              <div className="field">
                <span className="field-label">Confidence</span>
                <span className="field-value">
                  {thread.classificationConfidence !== null ? thread.classificationConfidence.toFixed(2) : '—'}
                </span>
              </div>
              {thread.requiresHuman && (
                <div className="field">
                  <span className="field-label">Escalation</span>
                  <span className="field-value">
                    <span className="badge badge-red">NEEDS HUMAN</span>
                  </span>
                </div>
              )}
            </div>

            <div className="approval-body">{thread.rawContent}</div>

            <div className="section" style={{ marginTop: 14, marginBottom: 0 }}>
              <h2 className="section-title">Proposed action</h2>
              {(() => {
                const action = describeProposedAction(thread.proposedDraft);
                switch (action.kind) {
                  case 'NO_DRAFT_YET':
                    return (
                      <form action={draftReplyAction}>
                        <input type="hidden" name="inboundMessageId" value={thread.inboundMessageId} />
                        <p className="page-subtitle" style={{ marginTop: 0 }}>
                          No reply drafted yet.
                        </p>
                        <button type="submit" className="btn btn-primary">
                          Draft reply
                        </button>
                      </form>
                    );
                  case 'PENDING_HUMAN_REVIEW':
                    return (
                      <>
                        <div className="field-row" style={{ marginBottom: 0 }}>
                          <div className="field">
                            <span className="field-label">Risk</span>
                            <span className="field-value">
                              <RiskBadge risk={action.riskLevel} />
                            </span>
                          </div>
                          <div className="field">
                            <span className="field-label">Draft status</span>
                            <span className="field-value">
                              <StatusBadge status={action.draftStatus} />
                            </span>
                          </div>
                          <div className="field">
                            <span className="field-label">Approval</span>
                            <span className="field-value">
                              <Link href="/approvals">Review in Approval Center →</Link>
                            </span>
                          </div>
                        </div>
                        {action.riskLevel === 'RED' && (
                          <p className="page-subtitle" style={{ marginTop: 8 }}>
                            Red-risk reply — a human decision in the Approval Center is required. No automatic send
                            is available for this thread.
                          </p>
                        )}
                      </>
                    );
                  case 'DECIDED':
                    return (
                      <div className="field-row" style={{ marginBottom: 0 }}>
                        <div className="field">
                          <span className="field-label">Risk</span>
                          <span className="field-value">
                            <RiskBadge risk={action.riskLevel} />
                          </span>
                        </div>
                        <div className="field">
                          <span className="field-label">Draft status</span>
                          <span className="field-value">
                            <StatusBadge status={action.draftStatus} />
                          </span>
                        </div>
                        <div className="field">
                          <span className="field-label">Approval</span>
                          <span className="field-value">
                            <StatusBadge status={action.approvalStatus} />
                          </span>
                        </div>
                      </div>
                    );
                }
              })()}
            </div>
          </div>
        ))}
    </>
  );
}
