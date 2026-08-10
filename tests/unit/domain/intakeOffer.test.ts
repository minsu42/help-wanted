import { describe, expect, it } from 'vitest';
import balance from '../../../src/data/balance.json';
import { intakeOfferTerms, resolveIntakeOffer } from '../../../src/domain/intakeOffer';
import type { OccupationBalance } from '../../../src/domain/occupation';
import type { Client, Occupation } from '../../../src/domain/types';

const OCCUPATIONS = balance.intake.occupations as unknown as Readonly<Record<Occupation, OccupationBalance>>;

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client', name: '의뢰인', traits: ['cautious', 'loyal'], goal: 'money',
    trust: 0.3, memories: [], wealth: 0.5, urgency: 0.5, hasAlternative: false,
    knownBy: [], occupation: 'resident', keyLeverage: null, ...overrides,
  };
}

describe('접수 보수 협상', () => {
  it('직업과 재력으로 결정되는 제안·역제시·한도가 항상 순서대로다', () => {
    for (const occupation of ['resident', 'merchant', 'official', 'noble', 'gang'] as const) {
      const terms = intakeOfferTerms(
        makeClient({ occupation }), 100, OCCUPATIONS, balance.intake.wallet,
      );
      expect(terms.easy).toBeGreaterThan(0);
      expect(terms.easy).toBeLessThan(terms.counter);
      expect(terms.counter).toBeLessThanOrEqual(terms.cap);
      expect(terms.proposed).toBeLessThanOrEqual(terms.market);
      expect(terms.premium).toBeGreaterThan(terms.market);
    }
  });

  it('낮은 요구는 수락하고 지불 한도를 넘기면 역제시한다', () => {
    const terms = intakeOfferTerms(
      makeClient({ wealth: 0 }), 100, OCCUPATIONS, balance.intake.wallet,
    );
    expect(resolveIntakeOffer(terms.proposed, terms)).toEqual({
      outcome: 'comfortable', agreedReward: terms.proposed,
    });
    expect(resolveIntakeOffer(terms.cap, terms)).toEqual({
      outcome: 'strained', agreedReward: terms.cap,
    });
    expect(resolveIntakeOffer(terms.cap + 1, terms)).toEqual({
      outcome: 'countered', counter: terms.counter,
    });
  });

  it('같은 의뢰인은 같은 보수 조건을 낸다', () => {
    const client = makeClient({ occupation: 'merchant', wealth: 0.73 });
    const first = intakeOfferTerms(client, 137, OCCUPATIONS, balance.intake.wallet);
    const second = intakeOfferTerms(client, 137, OCCUPATIONS, balance.intake.wallet);
    expect(second).toEqual(first);
  });
});
