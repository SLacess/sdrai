const RISK_CLASS: Record<string, string> = {
  GREEN: 'badge-green',
  YELLOW: 'badge-yellow',
  RED: 'badge-red',
};

export function RiskBadge({ risk }: { risk: string }) {
  return <span className={`badge ${RISK_CLASS[risk] ?? 'badge-neutral'}`}>{risk}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  return <span className="badge badge-neutral">{status.replace(/_/g, ' ')}</span>;
}
