# WF-01 — Account Discovery

**Trigger:** schedule/manual  
**Input/ref:** `Campaign + ICP id`

## Steps
Load active campaign;
1. call discovery adapter/Apify;
1. normalize domains/names;
1. backend dedupe/upsert;
1. enqueue research;
1. record run.

## Guardrails
No direct outreach. Reject forbidden sources. Batch <= configured limit.

## Output
accounts created/updated; jobs queued

## Failure/retry
retry source 429/5xx; DLQ malformed data

## Required telemetry
`workflowId`, `executionId`, `correlationId`, entity IDs, duration, retry count, final status.

## Implementation rule
Prefer IDs/references in n8n payloads; fetch sensitive/large objects from backend. All external side effects require a fresh backend policy check immediately before execution.
