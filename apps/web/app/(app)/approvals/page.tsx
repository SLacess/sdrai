import { listPendingApprovals, prisma } from '@sinal/db';
import { DataFetchError, EmptyState } from '@/components/DataFetchError';
import { RiskBadge } from '@/components/RiskBadge';
import { decideApprovalAction } from './actions';

export default async function ApprovalsPage() {
  let approvals: Awaited<ReturnType<typeof listPendingApprovals>> | null = null;
  let error: string | null = null;
  try {
    approvals = await listPendingApprovals(prisma);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Approval Center</h1>
        <p className="page-subtitle">Every Yellow/Red action waits here before it can execute — a decision cannot be repeated.</p>
      </div>

      {error && <DataFetchError message={error} />}
      {approvals && approvals.length === 0 && !error && (
        <EmptyState message="No pending approvals. The queue is clear." />
      )}

      {approvals?.map((approval) => {
        const payload = approval.payload as Record<string, unknown>;
        const body = typeof payload.body === 'string' ? payload.body : null;

        return (
          <div className="card" key={approval.id}>
            <div className="field-row">
              <div className="field">
                <span className="field-label">Action</span>
                <span className="field-value">{approval.actionType}</span>
              </div>
              <div className="field">
                <span className="field-label">Risk</span>
                <span className="field-value">
                  <RiskBadge risk={approval.riskLevel} />
                </span>
              </div>
              <div className="field">
                <span className="field-label">Confidence</span>
                <span className="field-value">{approval.confidence !== null ? approval.confidence.toFixed(2) : '—'}</span>
              </div>
              <div className="field">
                <span className="field-label">Created</span>
                <span className="field-value mono">{approval.createdAt.toISOString()}</span>
              </div>
            </div>

            <div className="field" style={{ marginBottom: 10 }}>
              <span className="field-label">Rationale</span>
              <span className="field-value">{approval.rationale}</span>
            </div>

            {body && <div className="approval-body">{body}</div>}

            <form action={decideApprovalAction} className="btn-row" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="hidden" name="approvalId" value={approval.id} />
              <input type="text" name="reason" placeholder="Reason (optional)" style={{ maxWidth: 200 }} />
              {body && (
                <input
                  type="text"
                  name="editedBody"
                  placeholder="Edited message (used only by Edit & Approve)"
                  style={{ maxWidth: 260 }}
                />
              )}
              <button className="btn btn-primary" name="decision" value="APPROVE" type="submit">
                Approve
              </button>
              <button className="btn" name="decision" value="EDIT" type="submit">
                Edit &amp; Approve
              </button>
              <button className="btn btn-danger" name="decision" value="REJECT" type="submit">
                Reject
              </button>
            </form>
          </div>
        );
      })}
    </>
  );
}
