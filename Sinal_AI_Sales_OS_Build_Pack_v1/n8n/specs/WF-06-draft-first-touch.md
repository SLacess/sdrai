# WF-06 — Draft First Touch

**Trigger:** lead READY_FOR_OUTREACH  
**Input/ref:** `contactId,campaignId`

## Steps
Load dossier/evidence/persona/approved knowledge;
1. Message Angle Agent;
1. Writer;
1. Zod validation;
1. AI Supervisor;
1. backend policy decision;
1. create Yellow Approval.

## Guardrails
First touch Yellow; evidence binding required; technical/legal claim unsupported => block.

## Output
messageDraftId + approvalId

## Failure/retry
failed eval => blocked draft, no send

## Required telemetry
`workflowId`, `executionId`, `correlationId`, entity IDs, duration, retry count, final status.

## Implementation rule
Prefer IDs/references in n8n payloads; fetch sensitive/large objects from backend. All external side effects require a fresh backend policy check immediately before execution.
