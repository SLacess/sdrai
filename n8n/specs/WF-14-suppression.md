# WF-14 — Suppression

**Trigger:** opt-out/bounce/admin  
**Input/ref:** `target + reason`

## Steps
Create suppression idempotently;
1. pause/cancel enrollments;
1. mark channels;
1. CRM flag/note;
1. audit;
1. invalidate scheduled sends.

## Guardrails
Immediate, higher priority than all other workflows.

## Output
suppressionId + affected enrollments

## Failure/retry
must succeed locally even if CRM unavailable; CRM retry later

## Required telemetry
`workflowId`, `executionId`, `correlationId`, entity IDs, duration, retry count, final status.

## Implementation rule
Prefer IDs/references in n8n payloads; fetch sensitive/large objects from backend. All external side effects require a fresh backend policy check immediately before execution.
