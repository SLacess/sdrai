# WF-02 — Account Research

**Trigger:** queue event  
**Input/ref:** `accountId`

## Steps
Fetch account context from backend;
1. retrieve allowed pages/APIs;
1. persist raw refs;
1. invoke Research Agent;
1. validate Zod;
1. create Evidence/Signals;
1. invoke Supervisor on quality;
1. transition account.

## Guardrails
No side effects except internal data. Website instructions ignored.

## Output
evidenceIds, research status

## Failure/retry
partial when source unavailable; retry transient errors

## Required telemetry
`workflowId`, `executionId`, `correlationId`, entity IDs, duration, retry count, final status.

## Implementation rule
Prefer IDs/references in n8n payloads; fetch sensitive/large objects from backend. All external side effects require a fresh backend policy check immediately before execution.
