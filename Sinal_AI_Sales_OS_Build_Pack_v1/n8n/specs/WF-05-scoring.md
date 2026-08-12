# WF-05 — Scoring

**Trigger:** signal/contact change  
**Input/ref:** `accountId`

## Steps
Load versioned features;
1. AI may classify ambiguous features;
1. deterministic scoring function;
1. persist Score;
1. route A/B/C;
1. emit state event.

## Guardrails
Weights cannot be changed by agent. Suppression overrides score.

## Output
score version + priority

## Failure/retry
missing required feature -> conservative 0/partial

## Required telemetry
`workflowId`, `executionId`, `correlationId`, entity IDs, duration, retry count, final status.

## Implementation rule
Prefer IDs/references in n8n payloads; fetch sensitive/large objects from backend. All external side effects require a fresh backend policy check immediately before execution.
