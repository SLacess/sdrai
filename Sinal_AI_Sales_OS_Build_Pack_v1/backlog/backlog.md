# Backlog v1

## BP-001 — Bootstrap pnpm monorepo (P0)
**Epic:** Foundation

Create apps/web, apps/worker and packages; strict TS, lint, test runner.

**Aceite:** pnpm lint/typecheck/test run successfully; CI skeleton exists.

## BP-002 — PostgreSQL + Prisma baseline (P0)
**Epic:** Foundation

Apply schema.prisma and initial migration.

**Aceite:** DB boots; migration applies/rolls back in dev; Prisma client generated.

## BP-003 — Auth + RBAC (P0)
**Epic:** Foundation

Supervisor, closer and admin roles.

**Aceite:** Protected routes; unauthorized Red action rejected.

## BP-004 — Structured logging/correlation (P0)
**Epic:** Foundation

Correlation IDs across API/job/n8n callbacks.

**Aceite:** Trace a request end-to-end in logs.

## BP-005 — Redis/BullMQ worker foundation (P0)
**Epic:** Foundation

Idempotent queues and retry policy.

**Aceite:** Job retry/backoff and DLQ test pass.

## BP-006 — AI Gateway abstraction (P0)
**Epic:** AI

Provider-neutral invoke() with model metadata/cost.

**Aceite:** Stub + one provider adapter; timeouts/fallback covered.

## BP-007 — Zod agent contract validation (P0)
**Epic:** AI

Load AgentSchemas and reject invalid outputs.

**Aceite:** Contract tests for all 16 schemas.

## BP-008 — Policy engine v1 (P0)
**Epic:** Policy

Implement Green/Yellow/Red, confidence, evidence, suppression, inbound/caps.

**Aceite:** Table-driven unit tests including every blocking rule.

## BP-009 — State machine service (P0)
**Epic:** Domain

Persist append-only state events and optimistic concurrency.

**Aceite:** Invalid transitions rejected; event created atomically.

## BP-010 — Accounts CRUD + listing (P0)
**Epic:** Accounts

Account endpoints and filters.

**Aceite:** OpenAPI contract satisfied; pagination cursor.

## BP-011 — WF-01 Account Discovery backend contract (P0)
**Epic:** Accounts

Discovery job + dedupe/upsert.

**Aceite:** Duplicate domain creates one account; job trace exists.

## BP-012 — Evidence service (P0)
**Epic:** Research

Create/expire/query evidence.

**Aceite:** Expired evidence excluded from external claim check.

## BP-013 — WF-02 Research Agent pipeline (P0)
**Epic:** Research

Research refs -> agent -> evidence/signals.

**Aceite:** Facts always bind evidence; injection fixture ignored.

## BP-014 — WF-03 Accessibility Signal Scan (P0)
**Epic:** Research

Adapter + indicator semantics.

**Aceite:** No scan result can set compliance/legal status.

## BP-015 — WF-04 Buying Committee (P0)
**Epic:** Contacts

Upsert professional contacts/channels.

**Aceite:** Unverified guessed channels rejected.

## BP-016 — Deterministic account score (P0)
**Epic:** Scoring

Implement weights and versioning.

**Aceite:** Known fixture produces expected total and band.

## BP-017 — Campaign config + guardrails (P0)
**Epic:** Campaigns

CRUD campaign, ICP, offer, caps.

**Aceite:** Invalid caps/language rejected.

## BP-018 — Enrollment service (P0)
**Epic:** Campaigns

One active enrollment/contact and state management.

**Aceite:** Conflict produces 409; pause/resume audited.

## BP-019 — WF-06 First Touch generation (P0)
**Epic:** Messaging

Angle + writer + supervisor + policy + Yellow approval.

**Aceite:** No first touch can send without approved Approval.

## BP-020 — Approval Center v1 (P0)
**Epic:** UI

Approve/edit/reject with evidence/risk/confidence.

**Aceite:** Decision is auditable and cannot be repeated.

## BP-021 — Email provider adapter + sandbox (P0)
**Epic:** Sending

Protected send with idempotency.

**Aceite:** Retry does not duplicate provider send.

## BP-022 — WF-07 Send Approved (P0)
**Epic:** Sending

Fresh policy recheck immediately before provider call.

**Aceite:** Stale approval blocked after suppression/inbound.

## BP-023 — WF-08 Scheduler (P0)
**Epic:** Sequences

Due enrollment worker + caps.

**Aceite:** Paused/replied contacts never send.

## BP-024 — Webhook signing + replay protection (P0)
**Epic:** Inbound

Verify signature, timestamp and event id.

**Aceite:** Replay returns noop/conflict; invalid signature 401.

## BP-025 — WF-09 Reply handling (P0)
**Epic:** Inbound

Pause first, persist, classify, route.

**Aceite:** Race test proves scheduler cannot send after inbound acceptance.

## BP-026 — WF-14 opt-out/hard bounce (P0)
**Epic:** Suppression

Immediate local suppression, cancel sequences.

**Aceite:** Suppressed target cannot pass Policy Engine.

## BP-027 — WF-10 Qualification Agent (P0)
**Epic:** Qualification

Structured SQL criteria + opportunity.

**Aceite:** Fixture with missing need is not SQL; meeting request handoff works.

## BP-028 — CRM adapter + field precedence (P0)
**Epic:** HubSpot

Company/contact/deal upsert and conflict handling.

**Aceite:** Manual authoritative field remains unchanged.

## BP-029 — WF-13 reconciliation (P0)
**Epic:** HubSpot

Incremental bidirectional reconciliation.

**Aceite:** Conflicts reported, retries safe.

## BP-030 — Calendar free/busy adapter (P0)
**Epic:** Meeting

Read availability and create event.

**Aceite:** Recheck race before create; timezone validated.

## BP-031 — WF-11 meeting booking (P0)
**Epic:** Meeting

Yellow scheduling flow.

**Aceite:** Multi-participant path requires approval.

## BP-032 — WF-12 meeting brief (P0)
**Epic:** Meeting

Brief with facts/hypotheses separation.

**Aceite:** Every verified fact has evidence id.

## BP-033 — Command Center (P0)
**Epic:** UI

KPIs, SQLs, meetings, approvals, failures.

**Aceite:** Dashboard reads metrics endpoint and handles empty states.

## BP-034 — Account 360 (P0)
**Epic:** UI

Evidence, contacts, timeline, score, HubSpot link.

**Aceite:** Evidence freshness/status visible.

## BP-035 — Inbox AI (P0)
**Epic:** UI

Reply thread, classification, proposed action/escalation.

**Aceite:** Red reply cannot expose auto-send action.

## BP-036 — Agent Activity + costs (P0)
**Epic:** Observability

Run traces, latency, model, tokens, cost.

**Aceite:** p50/p95 and failed runs visible.

## BP-037 — Eval harness (P0)
**Epic:** Evals

Read JSONL, call/stub agent, calculate pass metrics.

**Aceite:** Runs locally/CI with deterministic fixtures.

## BP-038 — Prompt injection tests (P0)
**Epic:** Security

Adversarial retrieved-content fixtures.

**Aceite:** No tool/policy instruction from page is followed.

## BP-039 — Cross-account authorization tests (P0)
**Epic:** Security

Prevent data leakage between logical tenants/users.

**Aceite:** Unauthorized entity access rejected.

## BP-040 — Daily supervisor digest (P0)
**Epic:** Operations

WF-15 metrics/approval/failure digest.

**Aceite:** Digest generated without unnecessary PII.

## BP-041 — WF-16 Learning Loop (P1)
**Epic:** Learning

Generate change proposals only.

**Aceite:** No production config mutated by workflow.

## BP-042 — Sales Brain CRUD/versioning (P1)
**Epic:** Knowledge

Approved/deprecated collections and validity.

**Aceite:** Only APPROVED+valid items usable externally.

## BP-043 — Policies UI (P1)
**Epic:** Policies

Thresholds/VIP/caps/forbidden claims.

**Aceite:** Changes versioned and audited.

## BP-044 — E2E canonical journey (P1)
**Epic:** Testing

Discover -> research -> approval -> send -> reply -> SQL -> meeting.

**Aceite:** Passes with provider stubs and no duplicate sends.

## BP-045 — Docker/EasyPanel manifests (P1)
**Epic:** Deploy

App, worker, Postgres/managed, Redis and n8n env boundaries.

**Aceite:** Staging deploy reproducible; secrets outside Git.
