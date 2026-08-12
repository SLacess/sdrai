export type AccessibilityScanSeverity = 'info' | 'low' | 'medium' | 'high';

export interface AccessibilityScanFinding {
  rule: string;
  severity: AccessibilityScanSeverity;
  description: string;
  selector?: string;
}

/**
 * A scan result is an automated indicator, never a compliance declaration
 * (CLAUDE.md rule 14 / master build prompt: "Scan automatizado é indicador,
 * não auditoria completa"). This type intentionally has no
 * compliant/violation/legal field for that reason.
 */
export interface AccessibilityScanAdapter {
  readonly name: string;
  scan(domain: string): Promise<AccessibilityScanFinding[]>;
}
