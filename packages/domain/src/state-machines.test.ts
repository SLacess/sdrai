import { describe, expect, it } from 'vitest';
import {
  accountStates,
  ACCOUNT_TRANSITIONS,
  assertAccountTransition,
  assertLeadTransition,
  assertOpportunityTransition,
  canTransition,
  InvalidTransitionError,
  leadStates,
  LEAD_TRANSITIONS,
  opportunityStates,
  OPPORTUNITY_TRANSITIONS,
  type AccountState,
  type LeadState,
  type OpportunityState,
} from './state-machines';

function allPairs<S extends string>(states: readonly S[]): Array<[S, S]> {
  const pairs: Array<[S, S]> = [];
  for (const from of states) for (const to of states) pairs.push([from, to]);
  return pairs;
}

describe('ACCOUNT_TRANSITIONS', () => {
  it.each(allPairs(accountStates))('canTransition(%s -> %s) matches the declared map', (from, to) => {
    const expected = ACCOUNT_TRANSITIONS[from].includes(to);
    expect(canTransition(ACCOUNT_TRANSITIONS, from, to)).toBe(expected);
  });

  it('SUPPRESSED is a terminal state with no generic reactivation path', () => {
    for (const to of accountStates) {
      expect(canTransition(ACCOUNT_TRANSITIONS, 'SUPPRESSED', to)).toBe(false);
    }
  });

  it('allows the canonical discovery -> research -> qualification path', () => {
    expect(canTransition(ACCOUNT_TRANSITIONS, 'DISCOVERED', 'RESEARCHING')).toBe(true);
    expect(canTransition(ACCOUNT_TRANSITIONS, 'RESEARCHING', 'QUALIFIED_ACCOUNT')).toBe(true);
  });

  it('rejects skipping straight from DISCOVERED to QUALIFIED_ACCOUNT', () => {
    expect(canTransition(ACCOUNT_TRANSITIONS, 'DISCOVERED', 'QUALIFIED_ACCOUNT')).toBe(false);
  });
});

describe('LEAD_TRANSITIONS', () => {
  it.each(allPairs(leadStates))('canTransition(%s -> %s) matches the declared map', (from, to) => {
    const expected = LEAD_TRANSITIONS[from].includes(to);
    expect(canTransition(LEAD_TRANSITIONS, from, to)).toBe(expected);
  });

  it('DO_NOT_CONTACT is terminal', () => {
    for (const to of leadStates) {
      expect(canTransition(LEAD_TRANSITIONS, 'DO_NOT_CONTACT', to)).toBe(false);
    }
  });

  it('every non-terminal state can reach DO_NOT_CONTACT (opt-out must always be reachable)', () => {
    for (const from of leadStates) {
      if (from === 'DO_NOT_CONTACT') continue;
      expect(canTransition(LEAD_TRANSITIONS, from, 'DO_NOT_CONTACT')).toBe(true);
    }
  });
});

describe('OPPORTUNITY_TRANSITIONS', () => {
  it.each(allPairs(opportunityStates))('canTransition(%s -> %s) matches the declared map', (from, to) => {
    const expected = OPPORTUNITY_TRANSITIONS[from].includes(to);
    expect(canTransition(OPPORTUNITY_TRANSITIONS, from, to)).toBe(expected);
  });

  it('WON is terminal', () => {
    for (const to of opportunityStates) {
      expect(canTransition(OPPORTUNITY_TRANSITIONS, 'WON', to)).toBe(false);
    }
  });

  it('LOST can only be reopened via ON_HOLD', () => {
    expect(OPPORTUNITY_TRANSITIONS.LOST).toEqual(['ON_HOLD']);
  });
});

describe('assert*Transition', () => {
  it('does not throw for a valid account transition', () => {
    expect(() => assertAccountTransition('DISCOVERED', 'RESEARCHING')).not.toThrow();
  });

  it('throws InvalidTransitionError with entity/from/to for an invalid account transition', () => {
    let caught: unknown;
    try {
      assertAccountTransition('SUPPRESSED' as AccountState, 'DISCOVERED' as AccountState);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(InvalidTransitionError);
    const error = caught as InvalidTransitionError;
    expect(error.entity).toBe('account');
    expect(error.from).toBe('SUPPRESSED');
    expect(error.to).toBe('DISCOVERED');
    expect(error.message).toBe('Invalid account transition: SUPPRESSED -> DISCOVERED');
  });

  it('throws for an invalid lead transition', () => {
    expect(() => assertLeadTransition('DO_NOT_CONTACT' as LeadState, 'IDENTIFIED' as LeadState)).toThrow(
      InvalidTransitionError,
    );
  });

  it('throws for an invalid opportunity transition', () => {
    expect(() =>
      assertOpportunityTransition('WON' as OpportunityState, 'NEGOTIATION' as OpportunityState),
    ).toThrow(InvalidTransitionError);
  });
});
