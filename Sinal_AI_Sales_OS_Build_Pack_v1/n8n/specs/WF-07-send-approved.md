# WF-07 — Send Approved

**Trigger:** approval approved  
**Input/ref:** `approvalId`

## Steps
Backend revalidates fresh state, suppression, caps, inbound, channel;
1. acquire idempotency key;
1. provider send;
1. persist touchpoint;
1. CRM activity;
1. schedule next step.

## Guardrails
Provider call only after PolicyDecision ALLOW. Never reuse stale approval if context invalidated.

## Output
providerId + touchpointId

## Failure/retry
idempotent retry; provider error => retry/backoff

## Required telemetry
`workflowId`, `executionId`, `correlationId`, entity IDs, duration, retry count, final status.

## Implementation rule
Prefer IDs/references in n8n payloads; fetch sensitive/large objects from backend. All external side effects require a fresh backend policy check immediately before execution.
