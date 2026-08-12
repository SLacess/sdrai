# WF-15 — Daily Supervisor Digest

**Trigger:** daily  
**Input/ref:** `date`

## Steps
Aggregate KPIs, pending approvals, SQLs, meetings, failures, spend, blocked actions;
1. generate concise digest;
1. deliver internal channel.

## Guardrails
No external prospect action. Avoid exposing unnecessary PII.

## Output
digestId

## Failure/retry
metrics gap noted explicitly

## Required telemetry
`workflowId`, `executionId`, `correlationId`, entity IDs, duration, retry count, final status.

## Implementation rule
Prefer IDs/references in n8n payloads; fetch sensitive/large objects from backend. All external side effects require a fresh backend policy check immediately before execution.
