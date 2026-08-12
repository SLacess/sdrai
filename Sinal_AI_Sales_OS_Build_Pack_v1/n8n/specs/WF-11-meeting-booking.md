# WF-11 — Meeting Booking

**Trigger:** SQL/meeting request  
**Input/ref:** `opportunityId,contactId`

## Steps
Read calendar preferences;
1. query free/busy via adapter;
1. agent proposes slots;
1. Yellow initially;
1. upon approval create event;
1. sync CRM;
1. set MEETING_BOOKED.

## Guardrails
Timezone required; multiple participants/special condition => approval/escalation.

## Output
meetingId + calendar event id

## Failure/retry
calendar race => recheck before create

## Required telemetry
`workflowId`, `executionId`, `correlationId`, entity IDs, duration, retry count, final status.

## Implementation rule
Prefer IDs/references in n8n payloads; fetch sensitive/large objects from backend. All external side effects require a fresh backend policy check immediately before execution.
