# WF-13 — CRM Reconciliation

**Trigger:** hourly/daily  
**Input/ref:** `cursor/since`

## Steps
Load changed internal records + HubSpot deltas;
1. CRM Sync Agent proposes operations;
1. apply precedence mapping;
1. upsert allowed fields;
1. log conflicts/report.

## Guardrails
Manual authoritative CRM fields never overwritten.

## Output
sync counts/conflicts

## Failure/retry
retry provider errors; conflict is not auto-resolved

## Required telemetry
`workflowId`, `executionId`, `correlationId`, entity IDs, duration, retry count, final status.

## Implementation rule
Prefer IDs/references in n8n payloads; fetch sensitive/large objects from backend. All external side effects require a fresh backend policy check immediately before execution.
