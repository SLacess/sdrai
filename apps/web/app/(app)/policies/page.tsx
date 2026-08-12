import { prisma } from '@sinal/db';
import { loadPolicyOverview } from '@/lib/policies/service';
import { DataFetchError, EmptyState } from '@/components/DataFetchError';
import { updatePolicyConfigAction } from './actions';

const POLICY_LABELS: Record<string, string> = {
  'score.thresholds': 'Score thresholds (priority bands)',
  'frequency.caps': 'Frequency caps',
  forbiddenClaims: 'Forbidden claims',
};

export default async function PoliciesPage() {
  let overview: Awaited<ReturnType<typeof loadPolicyOverview>> | null = null;
  let error: string | null = null;
  try {
    overview = await loadPolicyOverview(prisma);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Policies</h1>
        <p className="page-subtitle">
          Tunable operational knobs only. VIP escalation, Red-always-human, and the confidence floor are hardcoded
          guardrails — they are not editable here.
        </p>
      </div>

      {error && <DataFetchError message={error} />}

      {overview?.map((item) => (
        <div className="card" key={item.key}>
          <div className="field-row">
            <div className="field">
              <span className="field-label">Policy</span>
              <span className="field-value">{POLICY_LABELS[item.key] ?? item.key}</span>
            </div>
            <div className="field">
              <span className="field-label">Version</span>
              <span className="field-value">{item.version === 0 ? 'default (unsaved)' : item.version}</span>
            </div>
          </div>

          <form action={updatePolicyConfigAction} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input type="hidden" name="key" value={item.key} />
            <input type="hidden" name="expectedVersion" value={item.version} />
            <textarea name="value" defaultValue={JSON.stringify(item.value, null, 2)} rows={4} />
            <button className="btn btn-primary" type="submit" style={{ alignSelf: 'flex-start' }}>
              Save
            </button>
          </form>

          <div className="section" style={{ marginTop: 14, marginBottom: 0 }}>
            <h2 className="section-title">Change history</h2>
            {item.recentAudit.length === 0 ? (
              <EmptyState message="No changes recorded yet — currently the seed default." />
            ) : (
              <div className="panel">
                <table>
                  <thead>
                    <tr>
                      <th>Version</th>
                      <th>Changed by</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.recentAudit.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.version}</td>
                        <td className="mono">{entry.changedByUserId}</td>
                        <td className="mono">{entry.changedAt.toISOString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ))}

      <div className="section">
        <h2 className="section-title">Read-only guardrails (not editable)</h2>
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Rule</th>
                <th>Behavior</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>VIP escalation</td>
                <td>VIP accounts always escalate to Red risk</td>
              </tr>
              <tr>
                <td>Red always human</td>
                <td>Red-class actions always require human approval</td>
              </tr>
              <tr>
                <td>Confidence floor</td>
                <td>confidence &lt; 0.75 always blocks external action</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
