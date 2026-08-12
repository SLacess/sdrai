# WF-09 — Inbound Reply

**Trigger:** provider webhook/poll  
**Input/ref:** `normalized inbound event`

## Steps
Deduplicate event;
1. resolve contact;
1. transactionally pause enrollment first;
1. persist inbound;
1. classify reply;
1. create state event;
1. policy route to simple draft/Yellow/Red handoff.

## Guardrails
OPT_OUT suppression immediate. Red classes human. No outbound before classification completes.

## Output
intent, state, next action

## Failure/retry
unresolved contact -> quarantine queue; duplicate => noop

## Required telemetry
`workflowId`, `executionId`, `correlationId`, entity IDs, duration, retry count, final status.

## Implementation rule
Prefer IDs/references in n8n payloads; fetch sensitive/large objects from backend. All external side effects require a fresh backend policy check immediately before execution.
