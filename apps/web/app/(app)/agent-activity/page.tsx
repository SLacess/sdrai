import { prisma } from '@sinal/db';
import { loadAgentActivity } from '@/lib/agent-activity/service';
import { DataFetchError, EmptyState } from '@/components/DataFetchError';
import { StatusBadge } from '@/components/RiskBadge';

function formatCost(costMicrosUsd: number | null): string {
  if (costMicrosUsd === null) return '—';
  return `$${(costMicrosUsd / 1_000_000).toFixed(4)}`;
}

function formatMs(ms: number | null): string {
  return ms === null ? '—' : `${ms.toLocaleString()} ms`;
}

export default async function AgentActivityPage() {
  let activity: Awaited<ReturnType<typeof loadAgentActivity>> | null = null;
  let error: string | null = null;
  try {
    activity = await loadAgentActivity(prisma);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Agent Activity</h1>
        <p className="page-subtitle">Run traces, latency, model, tokens, and cost across every agent invocation.</p>
      </div>

      {error && <DataFetchError message={error} />}

      {activity && (
        <div className="kpi-grid">
          <div className="kpi-tile">
            <div className="kpi-label">Total runs</div>
            <div className={`kpi-value${activity.stats.totalRuns === 0 ? ' empty' : ''}`}>
              {activity.stats.totalRuns}
            </div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Failed runs</div>
            <div className={`kpi-value${activity.stats.failedRuns === 0 ? ' empty' : ''}`}>
              {activity.stats.failedRuns} ({(activity.stats.failureRate * 100).toFixed(1)}%)
            </div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Latency p50</div>
            <div className={`kpi-value${activity.stats.latencyP50Ms === null ? ' empty' : ''}`}>
              {activity.stats.latencyP50Ms === null ? 'no data' : formatMs(activity.stats.latencyP50Ms)}
            </div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Latency p95</div>
            <div className={`kpi-value${activity.stats.latencyP95Ms === null ? ' empty' : ''}`}>
              {activity.stats.latencyP95Ms === null ? 'no data' : formatMs(activity.stats.latencyP95Ms)}
            </div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Total AI spend</div>
            <div className={`kpi-value${activity.stats.totalCostMicrosUsd === 0 ? ' empty' : ''}`}>
              {activity.stats.totalCostMicrosUsd === 0 ? 'no spend yet' : formatCost(activity.stats.totalCostMicrosUsd)}
            </div>
          </div>
        </div>
      )}

      {activity && (
        <div className="section">
          <h2 className="section-title">Failed runs ({activity.failedRuns.length})</h2>
          {activity.failedRuns.length === 0 ? (
            <EmptyState message="No failed runs recorded." />
          ) : (
            <div className="panel">
              <table>
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Error</th>
                    <th>Correlation ID</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.failedRuns.map((run) => (
                    <tr key={run.id}>
                      <td>
                        {run.agent} <span className="mono">v{run.agentVersion}</span>
                      </td>
                      <td>{run.errorMessage ?? '—'}</td>
                      <td className="mono">{run.correlationId}</td>
                      <td className="mono">{run.createdAt.toISOString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activity && (
        <div className="section">
          <h2 className="section-title">Recent runs ({activity.recentRuns.length})</h2>
          {activity.recentRuns.length === 0 ? (
            <EmptyState message="No agent runs recorded yet." />
          ) : (
            <div className="panel">
              <table>
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Status</th>
                    <th>Model</th>
                    <th>Tokens (in/out)</th>
                    <th>Cost</th>
                    <th>Duration</th>
                    <th>Correlation ID</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.recentRuns.map((run) => (
                    <tr key={run.id}>
                      <td>
                        {run.agent} <span className="mono">v{run.agentVersion}</span>
                      </td>
                      <td>
                        <StatusBadge status={run.status} />
                      </td>
                      <td className="mono">{run.model ?? '—'}</td>
                      <td className="mono">
                        {run.tokensInput ?? '—'} / {run.tokensOutput ?? '—'}
                      </td>
                      <td className="mono">{formatCost(run.costMicrosUsd)}</td>
                      <td className="mono">{formatMs(run.durationMs)}</td>
                      <td className="mono">{run.correlationId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
