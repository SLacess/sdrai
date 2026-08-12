# WF-03 — Accessibility Signal Scan

**Trigger:** after research  
**Input/ref:** `accountId`

## Steps
Call approved scan adapter;
1. normalize findings;
1. invoke Accessibility Intelligence;
1. persist indicators;
1. calculate opportunity feature;
1. attach disclaimer.

## Guardrails
Never claim legal/WCAG compliance. Scan output treated as indicator.

## Output
signals + score feature

## Failure/retry
scan timeout -> partial; no blocking of broader research

## Required telemetry
`workflowId`, `executionId`, `correlationId`, entity IDs, duration, retry count, final status.

## Implementation rule
Prefer IDs/references in n8n payloads; fetch sensitive/large objects from backend. All external side effects require a fresh backend policy check immediately before execution.
