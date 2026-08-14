import { prisma } from '@sinal/db';
import { notFound } from 'next/navigation';
import { getAccountById } from '@/lib/accounts/service';
import { DataFetchError, EmptyState } from '@/components/DataFetchError';
import { RiskBadge } from '@/components/RiskBadge';
import { NotFoundError } from '@/lib/http/errors';

const EVIDENCE_FRESHNESS_BADGE: Record<string, string> = {
  FRESH: 'badge-green',
  EXPIRED: 'badge-red',
  NO_EXPIRY: 'badge-neutral',
};

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let account: Awaited<ReturnType<typeof getAccountById>> | null = null;
  let error: string | null = null;
  try {
    account = await getAccountById(prisma, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    error = err instanceof Error ? err.message : String(err);
  }

  if (error) {
    return (
      <>
        <div className="page-header">
          <h1 className="page-title">Account</h1>
        </div>
        <DataFetchError message={error} />
      </>
    );
  }

  if (!account) return null;

  const hubspotBaseUrl = process.env.HUBSPOT_APP_BASE_URL;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">{account.brandName}</h1>
        <p className="page-subtitle mono">{account.domain}</p>
      </div>

      <div className="field-row section">
        <div className="field">
          <span className="field-label">Status</span>
          <span className="field-value">
            <span className="badge badge-neutral">{account.status.replace(/_/g, ' ')}</span>
          </span>
        </div>
        <div className="field">
          <span className="field-label">Priority band</span>
          <span className="field-value">{account.priorityBand ?? '—'}</span>
        </div>
        <div className="field">
          <span className="field-label">Score</span>
          <span className="field-value">{account.score !== null ? account.score.toFixed(1) : '—'}</span>
        </div>
        <div className="field">
          <span className="field-label">HubSpot</span>
          <span className="field-value mono">
            {account.hubspotId === null ? (
              '—'
            ) : hubspotBaseUrl ? (
              <a href={`${hubspotBaseUrl}/contacts/company/${account.hubspotId}`} target="_blank" rel="noreferrer">
                {account.hubspotId}
              </a>
            ) : (
              account.hubspotId
            )}
          </span>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Buying committee ({account.contacts.length})</h2>
        {account.contacts.length === 0 ? (
          <EmptyState message="No contacts identified yet." />
        ) : (
          <div className="panel">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Title</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {(account.contacts as Array<Record<string, unknown>>).map((contact) => (
                  <tr key={String(contact.id)}>
                    <td>{String(contact.name ?? '—')}</td>
                    <td>{String(contact.title ?? '—')}</td>
                    <td>{String(contact.roleInBuyingCommittee ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="section">
        <h2 className="section-title">Opportunities ({account.opportunities.length})</h2>
        {account.opportunities.length === 0 ? (
          <EmptyState message="No opportunities yet." />
        ) : (
          <div className="panel">
            <table>
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Need</th>
                  <th>Score</th>
                  <th>ARR potential</th>
                  <th>Next action</th>
                  <th>Meetings</th>
                </tr>
              </thead>
              <tbody>
                {account.opportunities.map((opportunity) => (
                  <tr key={opportunity.id}>
                    <td>
                      <span className="badge badge-neutral">{opportunity.stage.replace(/_/g, ' ')}</span>
                    </td>
                    <td>{opportunity.need ?? '—'}</td>
                    <td>{opportunity.score !== null ? opportunity.score.toFixed(1) : '—'}</td>
                    <td className="mono">
                      {opportunity.arrPotentialMin !== null || opportunity.arrPotentialMax !== null
                        ? `${opportunity.currency} ${((opportunity.arrPotentialMin ?? 0) / 100).toLocaleString()}–${((opportunity.arrPotentialMax ?? 0) / 100).toLocaleString()}`
                        : '—'}
                    </td>
                    <td>{opportunity.nextAction ?? '—'}</td>
                    <td>
                      {opportunity.meetings.length === 0
                        ? '—'
                        : opportunity.meetings.map((meeting) => (
                            <div key={meeting.id} className="mono">
                              {new Date(meeting.scheduledAt).toISOString()} ({meeting.timezone}) —{' '}
                              {meeting.status}
                              {meeting.hasBrief ? ' · brief ready' : ''}
                            </div>
                          ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="section">
        <h2 className="section-title">Message drafts ({account.messageDrafts.length})</h2>
        {account.messageDrafts.length === 0 ? (
          <EmptyState message="No message drafts yet." />
        ) : (
          <div className="panel">
            <table>
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Angle</th>
                  <th>Subject</th>
                  <th>Message</th>
                  <th>Status</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {account.messageDrafts.map((draft) => (
                  <tr key={draft.id}>
                    <td>{draft.contactName}</td>
                    <td>{draft.angle ?? '—'}</td>
                    <td>{draft.subject ?? '—'}</td>
                    <td>
                      {draft.body}
                      {draft.wasEdited && <span className="badge badge-neutral"> edited</span>}
                    </td>
                    <td>
                      <span className="badge badge-neutral">{draft.status.replace(/_/g, ' ')}</span>
                    </td>
                    <td>
                      <RiskBadge risk={draft.riskLevel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="section">
        <h2 className="section-title">Evidence ({account.evidence.length})</h2>
        {account.evidence.length === 0 ? (
          <EmptyState message="No evidence captured yet." />
        ) : (
          <div className="panel">
            <table>
              <thead>
                <tr>
                  <th>Claim</th>
                  <th>Source</th>
                  <th>Confidence</th>
                  <th>Freshness</th>
                </tr>
              </thead>
              <tbody>
                {account.evidence.map((item) => (
                  <tr key={item.id}>
                    <td>{item.claim}</td>
                    <td className="mono">{item.sourceUri ?? '—'}</td>
                    <td>{item.confidence.toFixed(2)}</td>
                    <td>
                      <span className={`badge ${EVIDENCE_FRESHNESS_BADGE[item.freshness]}`}>
                        {item.freshness.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="section">
        <h2 className="section-title">Signals ({account.signals.length})</h2>
        {account.signals.length === 0 ? (
          <EmptyState message="No signals recorded yet." />
        ) : (
          <div className="panel">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Confidence</th>
                  <th>Observed</th>
                </tr>
              </thead>
              <tbody>
                {(account.signals as Array<Record<string, unknown>>).map((signal) => (
                  <tr key={String(signal.id)}>
                    <td>{String(signal.type ?? '—')}</td>
                    <td>{typeof signal.confidence === 'number' ? signal.confidence.toFixed(2) : '—'}</td>
                    <td className="mono">{String(signal.observedAt ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="section">
        <h2 className="section-title">Timeline ({account.timeline.length})</h2>
        {account.timeline.length === 0 ? (
          <EmptyState message="No state history yet." />
        ) : (
          <div className="panel">
            <table>
              <thead>
                <tr>
                  <th>From</th>
                  <th>To</th>
                  <th>Reason</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {(account.timeline as Array<Record<string, unknown>>).map((event) => (
                  <tr key={String(event.id)}>
                    <td>{String(event.fromState ?? '—')}</td>
                    <td>{String(event.toState ?? '—')}</td>
                    <td>{String(event.reason ?? '—')}</td>
                    <td className="mono">{String(event.timestamp ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
