# WF-04 — Buying Committee

**Trigger:** qualified account  
**Input/ref:** `accountId`

## Steps
Query permitted people sources;
1. normalize identity;
1. validate role/channel;
1. invoke mapper;
1. backend upsert contacts;
1. optional CRM sync.

## Guardrails
Professional data only; unverified channels cannot become READY_FOR_OUTREACH.

## Output
contacts + confidence

## Failure/retry
source conflict -> mark partial; no guessed email

## Required telemetry
`workflowId`, `executionId`, `correlationId`, entity IDs, duration, retry count, final status.

## Implementation rule
Prefer IDs/references in n8n payloads; fetch sensitive/large objects from backend. All external side effects require a fresh backend policy check immediately before execution.
