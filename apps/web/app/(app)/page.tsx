import { prisma } from '@sinal/db';
import Link from 'next/link';
import { loadCommandCenterQueue } from '@/lib/dashboard/service';
import { DataFetchError, EmptyState } from '@/components/DataFetchError';
import { RiskBadge } from '@/components/RiskBadge';

function Kpi({ label, value, empty }: { label: string; value: string; empty?: boolean }) {
  return (
    <div className="kpi-tile">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value${empty ? ' empty' : ''}`}>{value}</div>
    </div>
  );
}

export default async function CommandCenterPage() {
  let queue: Awaited<ReturnType<typeof loadCommandCenterQueue>> | null = null;
  let error: string | null = null;
  try {
    queue = await loadCommandCenterQueue(prisma);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Command Center</h1>
        <p className="page-subtitle">What happened, what needs attention, where the opportunity and risk are.</p>
      </div>

      {error && <DataFetchError message={error} />}

      {queue && (
        <div className="kpi-grid">
          <Kpi label="Accounts" value={String(queue.metrics.totalAccounts)} empty={queue.metrics.totalAccounts === 0} />
          <Kpi
            label="Qualified accounts"
            value={String(queue.metrics.qualifiedAccounts)}
            empty={queue.metrics.qualifiedAccounts === 0}
          />
          <Kpi
            label="Contacts identified"
            value={String(queue.metrics.totalContacts)}
            empty={queue.metrics.totalContacts === 0}
          />
          <Kpi
            label="Approval queue"
            value={String(queue.metrics.pendingApprovals)}
            empty={queue.metrics.pendingApprovals === 0}
          />
          <Kpi label="Agent runs" value={String(queue.metrics.totalAgentRuns)} empty={queue.metrics.totalAgentRuns === 0} />
          <Kpi
            label="Agent failures"
            value={String(queue.metrics.failedAgentRuns)}
            empty={queue.metrics.failedAgentRuns === 0}
          />
          <Kpi
            label="AI spend (USD)"
            value={
              queue.metrics.aiSpendMicrosUsd > 0
                ? `$${(queue.metrics.aiSpendMicrosUsd / 1_000_000).toFixed(2)}`
                : 'no spend yet'
            }
            empty={queue.metrics.aiSpendMicrosUsd === 0}
          />
        </div>
      )}

      {queue && queue.metrics.totalAccounts === 0 && !error && (
        <div className="empty-state">
          No accounts yet. Trigger account discovery (POST /api/accounts/discover) to start the pipeline.
        </div>
      )}

      {queue && (
        <>
          <div className="section">
            <h2 className="section-title">SQL queue ({queue.sqlQueue.length})</h2>
            {queue.sqlQueue.length === 0 ? (
              <EmptyState message="No sales-qualified leads waiting right now." />
            ) : (
              <div className="panel">
                <table>
                  <thead>
                    <tr>
                      <th>Contact</th>
                      <th>Account</th>
                      <th>Qualified</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.sqlQueue.map((item) => (
                      <tr key={item.contactId}>
                        <td>{item.contactName}</td>
                        <td>
                          <Link href={`/accounts/${item.accountId}`}>{item.accountName}</Link>
                        </td>
                        <td className="mono">{item.updatedAt.toISOString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="section">
            <h2 className="section-title">Upcoming meetings ({queue.upcomingMeetings.length})</h2>
            {queue.upcomingMeetings.length === 0 ? (
              <EmptyState message="No meetings scheduled." />
            ) : (
              <div className="panel">
                <table>
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>When</th>
                      <th>Timezone</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.upcomingMeetings.map((meeting) => (
                      <tr key={meeting.meetingId}>
                        <td>
                          <Link href={`/accounts/${meeting.accountId}`}>{meeting.accountName}</Link>
                        </td>
                        <td className="mono">{meeting.scheduledAt.toISOString()}</td>
                        <td>{meeting.timezone}</td>
                        <td>
                          <span className="badge badge-neutral">{meeting.status.replace(/_/g, ' ')}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="section">
            <h2 className="section-title">Pending approvals ({queue.pendingApprovals.length})</h2>
            {queue.pendingApprovals.length === 0 ? (
              <EmptyState message="Nothing waiting on human review." />
            ) : (
              <div className="panel">
                <table>
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>Risk</th>
                      <th>Rationale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.pendingApprovals.map((approval) => (
                      <tr key={approval.id}>
                        <td>{approval.actionType.replace(/_/g, ' ')}</td>
                        <td className="mono">
                          {approval.entityType} · {approval.entityId}
                        </td>
                        <td>
                          <RiskBadge risk={approval.riskLevel} />
                        </td>
                        <td>{approval.rationale}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="panel-header">
                  <Link href="/approvals">Open Approval Center →</Link>
                </div>
              </div>
            )}
          </div>

          <div className="section">
            <h2 className="section-title">Recent agent failures ({queue.recentFailures.length})</h2>
            {queue.recentFailures.length === 0 ? (
              <EmptyState message="No agent failures recorded." />
            ) : (
              <div className="panel">
                <table>
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Error</th>
                      <th>When</th>
                      <th>Correlation ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.recentFailures.map((failure) => (
                      <tr key={failure.id}>
                        <td>{failure.agent}</td>
                        <td>{failure.errorMessage ?? '—'}</td>
                        <td className="mono">{failure.createdAt.toISOString()}</td>
                        <td className="mono">{failure.correlationId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
