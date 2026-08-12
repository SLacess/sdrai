# WF-10 — Qualification

**Trigger:** positive reply  
**Input/ref:** `contactId/opportunityId`

## Steps
Load history;
1. invoke Qualification Agent;
1. persist structured qualification;
1. ask one missing question only if allowed;
1. if SQL create/update opportunity and handoff.

## Guardrails
Do not over-interrogate. Price/legal/demo request => handoff.

## Output
qualification + SQL boolean

## Failure/retry
low confidence => human review

## Required telemetry
`workflowId`, `executionId`, `correlationId`, entity IDs, duration, retry count, final status.

## Implementation rule
Prefer IDs/references in n8n payloads; fetch sensitive/large objects from backend. All external side effects require a fresh backend policy check immediately before execution.
