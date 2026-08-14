import { randomUUID } from 'node:crypto';
import {
  applyReplyClassification,
  confirmMeetingBooking,
  createFirstTouchDraft,
  decideApproval,
  handleInboundMessage,
  persistQualification,
  persistResearchFacts,
  prisma,
  processSendApproved,
  recordAccountScore,
  requestMeetingBooking,
  transitionEntityState,
  upsertBuyingCommittee,
  upsertDiscoveredAccounts,
} from '@sinal/db';
import { MockCalendarAdapter, MockLeadProvider, SandboxEmailProvider } from '@sinal/integrations';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * BP-044: the canonical SDR journey — discover, research, approval, send,
 * reply, SQL, meeting — chained through the REAL backend service functions
 * (not per-function mocks) against a real database, with only the external
 * side of the world stubbed (lead provider, email, calendar), exactly like
 * production would run against sandbox/mock adapters. This needs a real
 * Postgres to exercise real constraints/transactions/CAS updates, which
 * this sandbox does not have — it runs for real in any environment with
 * DATABASE_URL configured (CI, staging) and is skipped here rather than
 * faked, the same honesty convention the eval runner uses for AI calls.
 */
describe.skipIf(!process.env.DATABASE_URL)('canonical SDR journey (E2E)', () => {
  const domain = `e2e-${randomUUID()}.example.com`;
  const evidenceId = randomUUID();
  const contactEmail = `jane-${randomUUID()}@e2e-fixture.example.com`;
  const createdAccountIds: string[] = [];
  const createdApprovalIds: string[] = [];

  afterAll(async () => {
    // Approval has no FK to Account (entityId is a loose string) and
    // Evidence.account uses onDelete:SetNull, so both need explicit,
    // id-scoped cleanup — never a blanket `where: { entityType: ... }`,
    // which would delete every other MESSAGE/MEETING approval in the
    // database, including real ones, whenever this test runs for real.
    if (createdApprovalIds.length > 0) {
      await prisma.approval.deleteMany({ where: { id: { in: createdApprovalIds } } });
    }
    if (createdAccountIds.length > 0) {
      await prisma.evidence.deleteMany({ where: { id: evidenceId } });
      await prisma.account.deleteMany({ where: { id: { in: createdAccountIds } } });
    }
    await prisma.$disconnect();
  });

  it('runs discover -> research -> approval -> send -> reply -> SQL -> meeting with no duplicate sends', async () => {
    // 1. Discover — stubbed lead provider, persisted via the real discovery service.
    const leadProvider = new MockLeadProvider();
    const [candidate] = await leadProvider.discoverAccounts({ limit: 1 });
    expect(candidate).toBeDefined();

    const discovery = await upsertDiscoveredAccounts(prisma, {
      correlationId: `e2e-${randomUUID()}`,
      campaignId: 'e2e-campaign',
      candidates: [{ brandName: 'E2E Fixture Co', domain, country: 'BR', sector: 'Retail' }],
    });
    expect(discovery.createdCount).toBe(1);
    const accountId = discovery.accountIds[0] as string;
    createdAccountIds.push(accountId);

    // 2. Research — persists evidence tied to a pre-allocated evidence id.
    const research = await persistResearchFacts(prisma, {
      accountId,
      correlationId: `e2e-${randomUUID()}`,
      allocatedSources: [{ evidenceId, sourceUri: `https://${domain}/accessibility`, rawContent: 'Checkout flow lacks keyboard focus states.' }],
      facts: [{ claim: 'Checkout flow lacks keyboard focus states.', evidenceId }],
      agentVersion: '1.0.0',
      agentOutput: { summary: 'e2e fixture' },
      confidence: 0.9,
      provider: 'stub',
      model: 'stub-model',
      tokensInput: 100,
      tokensOutput: 50,
      durationMs: 500,
    });
    expect(research.persistedEvidenceIds).toEqual([evidenceId]);

    await recordAccountScore(prisma, accountId, {
      companyFit: 80,
      digitalExposure: 70,
      accessibilityOpportunity: 90,
      inclusionEsgSignal: 60,
      commercialTriggerTiming: 70,
      buyingCommitteeQuality: 60,
      engagement: 50,
    });

    const buyingCommittee = await upsertBuyingCommittee(prisma, {
      accountId,
      contacts: [
        {
          name: 'Jane Doe',
          title: 'VP Engineering',
          role: 'DECISION_MAKER',
          confidence: 0.9,
          channel: { type: 'EMAIL', address: contactEmail, verified: true },
        },
      ],
    });
    const contactId = buyingCommittee.contactIds[0] as string;

    // 3. Approval — a first-touch draft is always at least YELLOW, so this
    // always creates an Approval; nothing can send before a human decides.
    const draftResult = await createFirstTouchDraft(prisma, {
      contactId,
      angle: 'Accessibility risk',
      subject: 'Quick question about your checkout flow',
      body: 'Hi Jane, we noticed a keyboard-navigation issue on your checkout page...',
      language: 'en',
      promptVersion: '1.0.0',
      evidenceIds: [evidenceId],
      knowledgeItemIds: [],
      claims: [{ text: 'Checkout flow lacks keyboard focus states.', support: [{ evidenceId }] }],
      confidence: 0.9,
      supervisorVerdict: 'PASS',
      unsupportedClaims: [],
      supervisorReasons: [],
      accountVip: false,
      hasSuppression: false,
      frequencyCapOk: true,
      verifiedChannel: true,
      inboundPending: false,
    });
    expect(draftResult.policyDecision.outcome).toBe('REQUIRE_APPROVAL');
    expect(draftResult.approval).not.toBeNull();
    createdApprovalIds.push(draftResult.approval!.id);

    const decision = await decideApproval(prisma, {
      approvalId: draftResult.approval!.id,
      reviewerUserId: 'e2e-reviewer',
      decision: 'APPROVE',
    });
    expect(decision.kind).toBe('DECIDED');

    // 4. Send — idempotent; calling this twice must produce exactly one Touchpoint.
    const emailProvider = new SandboxEmailProvider();
    const firstSend = await processSendApproved(prisma, emailProvider, {
      approvalId: draftResult.approval!.id,
      channel: 'EMAIL',
      toAddress: contactEmail,
    });
    expect(firstSend.kind).toBe('SENT');

    const secondSend = await processSendApproved(prisma, emailProvider, {
      approvalId: draftResult.approval!.id,
      channel: 'EMAIL',
      toAddress: contactEmail,
    });
    expect(secondSend.kind).toBe('ALREADY_SENT');
    expect(emailProvider.getSentEmails()).toHaveLength(1);

    const touchpoints = await prisma.touchpoint.findMany({ where: { contactId } });
    expect(touchpoints).toHaveLength(1);

    // 5. Reply — inbound pauses any active sequence and is classified as a positive reply.
    const inbound = await handleInboundMessage(prisma, {
      contactId,
      channel: 'EMAIL',
      rawContent: 'Thanks for reaching out — can we set up a call this week?',
      receivedAt: new Date(),
    });
    const classification = await applyReplyClassification(prisma, {
      inboundMessageId: inbound.inboundMessage.id,
      contactId,
      intent: 'REQUEST_MEETING',
      sentiment: 'POSITIVE',
      confidence: 0.92,
      requiresHuman: false,
    });
    expect(classification.suppressed).toBe(false);

    // Progress the lead state to POSITIVE_REPLY so qualification's SQL
    // transition (POSITIVE_REPLY -> SQL) is a valid domain transition —
    // via the real transitionEntityState (CAS + append-only audit trail),
    // not a raw write.
    for (const [from, to] of [
      ['IDENTIFIED', 'VERIFIED'],
      ['VERIFIED', 'READY_FOR_OUTREACH'],
      ['READY_FOR_OUTREACH', 'IN_SEQUENCE'],
      ['IN_SEQUENCE', 'POSITIVE_REPLY'],
    ] as const) {
      await transitionEntityState(prisma, {
        entity: 'CONTACT',
        id: contactId,
        from,
        to,
        reason: 'e2e fixture setup',
        actorType: 'SYSTEM',
      });
    }

    // 6. SQL — determineIsSql recomputes qualification deterministically.
    const qualification = await persistQualification(prisma, {
      contactId,
      accountId,
      currentLeadState: 'POSITIVE_REPLY',
      qualification: {
        fit: true,
        relevantPerson: true,
        need: 'Accessibility remediation before Q4 audit',
        scope: { domains: 1, channels: ['web'], description: 'checkout flow' },
        engagement: 'positive',
        blockers: [],
        timing: 'Q4 2026',
        handoffReason: null,
      },
      correlationId: `e2e-${randomUUID()}`,
    });
    expect(qualification.isSql).toBe(true);
    expect(qualification.opportunityId).not.toBeNull();

    const contactAfterQualification = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
    expect(contactAfterQualification.leadState).toBe('SQL');

    // 7. Meeting — request creates a Yellow-tier approval, then confirm
    // re-checks free/busy immediately before booking (no stale-state race).
    const calendar = new MockCalendarAdapter();
    const proposedStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const proposedEnd = new Date(proposedStart.getTime() + 30 * 60 * 1000);

    const meetingRequest = await requestMeetingBooking(prisma, {
      opportunityId: qualification.opportunityId!,
      contactId,
      proposedStart,
      proposedEnd,
      timezone: 'America/Sao_Paulo',
      meetingTitle: 'Discovery call',
      participantEmails: [contactEmail],
      confidence: 0.9,
    });
    expect(meetingRequest.approval).not.toBeNull();
    createdApprovalIds.push(meetingRequest.approval!.id);

    const meetingApprovalDecision = await decideApproval(prisma, {
      approvalId: meetingRequest.approval!.id,
      reviewerUserId: 'e2e-reviewer',
      decision: 'APPROVE',
    });
    expect(meetingApprovalDecision.kind).toBe('DECIDED');

    const meetingOutcome = await confirmMeetingBooking(prisma, calendar, {
      approvalId: meetingRequest.approval!.id,
      calendarId: 'e2e-calendar',
    });
    expect(meetingOutcome.kind).toBe('BOOKED');

    const contactAfterMeeting = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
    expect(contactAfterMeeting.leadState).toBe('MEETING_BOOKED');
  });
});
