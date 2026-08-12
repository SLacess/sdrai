export const accountStates = [
  'DISCOVERED','RESEARCHING','QUALIFIED_ACCOUNT','NURTURE_ACCOUNT','DISQUALIFIED_ACCOUNT','SUPPRESSED'
] as const;
export type AccountState = typeof accountStates[number];

export const leadStates = [
  'IDENTIFIED','VERIFIED','READY_FOR_OUTREACH','IN_SEQUENCE','ENGAGED','POSITIVE_REPLY','QUALIFYING','SQL','MEETING_BOOKED','NURTURE','NOT_INTERESTED','DO_NOT_CONTACT','INVALID'
] as const;
export type LeadState = typeof leadStates[number];

export const opportunityStates = [
  'PRE_OPPORTUNITY','QUALIFIED_OPPORTUNITY','DEMO_SCHEDULED','DISCOVERY_COMPLETE','PROPOSAL_REQUIRED','PROPOSAL_SENT','NEGOTIATION','WON','LOST','ON_HOLD'
] as const;
export type OpportunityState = typeof opportunityStates[number];

type TransitionMap<S extends string> = Readonly<Record<S, readonly S[]>>;

export const ACCOUNT_TRANSITIONS: TransitionMap<AccountState> = {
  DISCOVERED: ['RESEARCHING','DISQUALIFIED_ACCOUNT','SUPPRESSED'],
  RESEARCHING: ['QUALIFIED_ACCOUNT','NURTURE_ACCOUNT','DISQUALIFIED_ACCOUNT','SUPPRESSED'],
  QUALIFIED_ACCOUNT: ['NURTURE_ACCOUNT','DISQUALIFIED_ACCOUNT','SUPPRESSED'],
  NURTURE_ACCOUNT: ['RESEARCHING','QUALIFIED_ACCOUNT','DISQUALIFIED_ACCOUNT','SUPPRESSED'],
  DISQUALIFIED_ACCOUNT: ['RESEARCHING','SUPPRESSED'],
  SUPPRESSED: [], // reactivation only through explicit governance service, never generic state transition
};

export const LEAD_TRANSITIONS: TransitionMap<LeadState> = {
  IDENTIFIED: ['VERIFIED','INVALID','DO_NOT_CONTACT'],
  VERIFIED: ['READY_FOR_OUTREACH','NURTURE','INVALID','DO_NOT_CONTACT'],
  READY_FOR_OUTREACH: ['IN_SEQUENCE','NURTURE','DO_NOT_CONTACT','INVALID'],
  IN_SEQUENCE: ['ENGAGED','POSITIVE_REPLY','NURTURE','NOT_INTERESTED','DO_NOT_CONTACT','INVALID'],
  ENGAGED: ['POSITIVE_REPLY','QUALIFYING','NURTURE','NOT_INTERESTED','DO_NOT_CONTACT'],
  POSITIVE_REPLY: ['QUALIFYING','SQL','NURTURE','NOT_INTERESTED','DO_NOT_CONTACT'],
  QUALIFYING: ['SQL','NURTURE','NOT_INTERESTED','DO_NOT_CONTACT'],
  SQL: ['MEETING_BOOKED','NURTURE','NOT_INTERESTED','DO_NOT_CONTACT'],
  MEETING_BOOKED: ['SQL','NURTURE','NOT_INTERESTED','DO_NOT_CONTACT'],
  NURTURE: ['READY_FOR_OUTREACH','POSITIVE_REPLY','QUALIFYING','DO_NOT_CONTACT','INVALID'],
  NOT_INTERESTED: ['NURTURE','DO_NOT_CONTACT'],
  DO_NOT_CONTACT: [],
  INVALID: ['IDENTIFIED','DO_NOT_CONTACT'],
};

export const OPPORTUNITY_TRANSITIONS: TransitionMap<OpportunityState> = {
  PRE_OPPORTUNITY: ['QUALIFIED_OPPORTUNITY','ON_HOLD','LOST'],
  QUALIFIED_OPPORTUNITY: ['DEMO_SCHEDULED','DISCOVERY_COMPLETE','PROPOSAL_REQUIRED','ON_HOLD','LOST'],
  DEMO_SCHEDULED: ['DISCOVERY_COMPLETE','ON_HOLD','LOST'],
  DISCOVERY_COMPLETE: ['PROPOSAL_REQUIRED','ON_HOLD','LOST'],
  PROPOSAL_REQUIRED: ['PROPOSAL_SENT','ON_HOLD','LOST'],
  PROPOSAL_SENT: ['NEGOTIATION','WON','ON_HOLD','LOST'],
  NEGOTIATION: ['WON','ON_HOLD','LOST'],
  WON: [],
  LOST: ['ON_HOLD'], // only explicit reopen workflow may use this transition
  ON_HOLD: ['QUALIFIED_OPPORTUNITY','DEMO_SCHEDULED','PROPOSAL_REQUIRED','NEGOTIATION','LOST'],
};

export function canTransition<S extends string>(map: TransitionMap<S>, from: S, to: S): boolean {
  return map[from]?.includes(to) ?? false;
}

export class InvalidTransitionError extends Error {
  constructor(public entity: string, public from: string, public to: string) {
    super(`Invalid ${entity} transition: ${from} -> ${to}`);
  }
}

export function assertAccountTransition(from: AccountState, to: AccountState) {
  if (!canTransition(ACCOUNT_TRANSITIONS, from, to)) throw new InvalidTransitionError('account', from, to);
}
export function assertLeadTransition(from: LeadState, to: LeadState) {
  if (!canTransition(LEAD_TRANSITIONS, from, to)) throw new InvalidTransitionError('lead', from, to);
}
export function assertOpportunityTransition(from: OpportunityState, to: OpportunityState) {
  if (!canTransition(OPPORTUNITY_TRANSITIONS, from, to)) throw new InvalidTransitionError('opportunity', from, to);
}
