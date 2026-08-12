# WF-16 — Learning Loop

**Trigger:** weekly  
**Input/ref:** `date range`

## Steps
Aggregate approve/edit/reject, conversions, agent metrics, eval failures;
1. Learning Analyst proposes changes;
1. create Yellow change proposals;
1. never deploy automatically.

## Guardrails
No autonomous policy/prompt/weight change. Offline eval required.

## Output
change proposals

## Failure/retry
insufficient sample => no proposal / observation only

## Required telemetry
`workflowId`, `executionId`, `correlationId`, entity IDs, duration, retry count, final status.

## Implementation rule
Prefer IDs/references in n8n payloads; fetch sensitive/large objects from backend. All external side effects require a fresh backend policy check immediately before execution.
