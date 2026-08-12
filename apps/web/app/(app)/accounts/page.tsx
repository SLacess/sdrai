import { prisma } from '@sinal/db';
import Link from 'next/link';
import { listAccounts } from '@/lib/accounts/service';
import { DataFetchError, EmptyState } from '@/components/DataFetchError';

export default async function AccountsPage() {
  let result: Awaited<ReturnType<typeof listAccounts>> | null = null;
  let error: string | null = null;
  try {
    result = await listAccounts(prisma, {});
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Accounts</h1>
        <p className="page-subtitle">Discovered and researched accounts, prioritized by score.</p>
      </div>

      {error && <DataFetchError message={error} />}
      {result && result.items.length === 0 && !error && (
        <EmptyState message="No accounts yet. Trigger account discovery to start the pipeline." />
      )}
      {result && result.items.length > 0 && (
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Account</th>
                <th>Domain</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((account) => (
                <tr key={account.id}>
                  <td>
                    <Link href={`/accounts/${account.id}`}>{account.brandName}</Link>
                  </td>
                  <td className="mono">{account.domain}</td>
                  <td>
                    <span className="badge badge-neutral">{account.status.replace(/_/g, ' ')}</span>
                  </td>
                  <td>{account.priorityBand ?? '—'}</td>
                  <td>{account.score !== null ? account.score.toFixed(1) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
