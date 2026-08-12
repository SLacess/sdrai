# WF-12 — Meeting Brief

**Trigger:** T-24h/T-2h  
**Input/ref:** `meetingId`

## Steps
Refresh stale research if allowed;
1. load participants/history/qualification;
1. Meeting Prep Agent;
1. evidence validation;
1. persist brief;
1. notify closer.

## Guardrails
Facts vs hypotheses separated. No unsupported competitor/legal claim.

## Output
meetingBriefId

## Failure/retry
partial allowed with explicit gaps

## Required telemetry
`workflowId`, `executionId`, `correlationId`, entity IDs, duration, retry count, final status.

## Implementation rule
Prefer IDs/references in n8n payloads; fetch sensitive/large objects from backend. All external side effects require a fresh backend policy check immediately before execution.
