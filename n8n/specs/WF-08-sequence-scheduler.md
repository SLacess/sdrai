# WF-08 — Sequence Scheduler

**Trigger:** hourly  
**Input/ref:** `none`

## Steps
Query due enrollments by cursor;
1. for each load fresh state;
1. validate caps/policies;
1. create follow-up draft or use approved step;
1. send Green if eligible else approval/block;
1. update nextActionAt.

## Guardrails
Any inbound/paused/suppression stops action. One active sequence/contact.

## Output
per-enrollment outcome

## Failure/retry
individual failure isolated; no batch-wide duplicate retry

## Required telemetry
`workflowId`, `executionId`, `correlationId`, entity IDs, duration, retry count, final status.

## Implementation rule
Prefer IDs/references in n8n payloads; fetch sensitive/large objects from backend. All external side effects require a fresh backend policy check immediately before execution.
