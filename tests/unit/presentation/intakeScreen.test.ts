/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import textBank from '../../../src/data/text.json';
import type { GameState } from '../../../src/domain/gameState';
import type { IntakeMaterial } from '../../../src/domain/intake';
import { createRng } from '../../../src/domain/rng';
import type { Contract, SlotName, SlotTruth } from '../../../src/domain/types';
import {
  mountIntakeScreen,
  type IntakeCopy,
} from '../../../src/presentation/ui/IntakeScreen';

const COPY = textBank.ui.intake as IntakeCopy;
const contract: Contract = {
  id: 'contract-art',
  client: {
    id: 'client-art', name: '카린', traits: ['cautious', 'loyal'], goal: 'survival',
    trust: 0.5, memories: [], occupation: 'resident', keyLeverage: null,
    wealth: 0.5, urgency: 0.5, hasAlternative: false, knownBy: [],
  },
  questKind: 'investigation', scenarioId: 'test',
  slots: new Map([['kind', { knows: 'certain', tells: 'certain', valueKey: 'test:kind', weight: 0 }]]),
  statedRisk: 40, realRisk: 50, concealment: 0.2, baseReward: 60,
  maxPartySize: 1, durationWeeks: 1, isTemptation: false, facts: [],
};

function makeState(): GameState {
  return {
    week: 1, reputation: 10, funds: 200, guildTier: 1, phase: 'playing', roster: [],
    openContracts: [contract], activeDispatches: [],
    knowledge: {
      discoveredContacts: new Set(), revealedFacts: new Set(), heardFacts: new Map(),
      slotProgress: new Map([['contract-art:kind', { state: 'vague' }]]),
    },
    rng: createRng(1), usedNames: new Set(), nextContractId: 1, offersMade: {}, settlements: {},
    intakeSessions: {
      'contract-art': {
        patience: 3, clientPresent: true, expression: 'neutral',
        dialogue: [{ speaker: 'client', text: '숲에서 이상한 일이 벌어졌습니다.' }],
        askCounts: {},
        reward: {
          proposed: 40, market: 60, premium: 81, easy: 40, counter: 50, cap: 55,
          status: 'offered',
        },
      },
    },
    commissionSheets: { 'contract-art': { contractId: 'contract-art', sealed: false } },
    ratesIntroduced: true,
    hallAttendance: { guildMemberIds: [], visitorIds: [] }, talkedThisWeek: new Set(),
  };
}

function mount(
  root: HTMLElement,
  state: GameState,
  onSealed = vi.fn(),
  handbook: readonly IntakeMaterial[] = [],
) {
  return mountIntakeScreen(root, {
    state, contract,
    slotContent: { 'test:kind': { topic: '종류', vague: '조사', certain: '현장 조사', weight: 0, hintTags: [] } },
    handbook, statedGrade: 'C', copy: COPY, onSealed,
  });
}

describe('의뢰 접수 대화', () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    root = document.createElement('main');
    document.body.appendChild(root);
  });

  it('질문을 고르면 내 질문과 의뢰인의 답이 대화로 남는다', () => {
    const state = makeState();
    mount(root, state);
    root.querySelector<HTMLButtonElement>('[data-slot="kind"]')!.click();

    const lines = [...root.querySelectorAll('.intake__line')].map((node) => node.textContent ?? '');
    expect(lines.some((line) => line.includes(COPY.questions.kind))).toBe(true);
    expect(lines.some((line) => line.includes('현장 조사'))).toBe(true);
    expect(state.knowledge.slotProgress.get('contract-art:kind')).toEqual({ state: 'certain' });
  });

  it('첫 방문에도 책이 의뢰서를 가리지 않으며 막힌 질문은 즉시 후속 재료를 연다', () => {
    const state = makeState();
    state.ratesIntroduced = false;
    const original = contract.slots.get('kind')!;
    const slots = contract.slots as Map<SlotName, SlotTruth>;
    slots.set('kind', { ...original, knows: 'vague' });
    mount(root, state, vi.fn(), [{
      id: 'clue', book: 'bestiary', title: '현장 기록', body: '기록',
      hintTags: ['test'], leverageTag: null,
    }]);

    expect(root.querySelector<HTMLButtonElement>('[data-action="toggle-handbook"]')?.getAttribute('aria-expanded')).toBe('false');
    root.querySelector<HTMLButtonElement>('[data-slot="kind"]')!.click();
    expect(root.querySelector('.intake__materials')).not.toBeNull();
    slots.set('kind', original);
  });

  it('이미 확인한 사실을 되묻더라도 같은 정보가 무한 반복되지 않는다', () => {
    const state = makeState();
    mount(root, state);
    root.querySelector<HTMLButtonElement>('[data-slot="kind"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-slot="kind"]')!.click();

    expect(state.intakeSessions[contract.id].askCounts.kind).toBe(2);
    expect(root.textContent).toContain(COPY.repeatAnswers[1]);
  });

  it('보수에 합의하기 전에는 날인할 수 없고 합의 뒤 위험도를 날인한다', () => {
    const state = makeState();
    const onSealed = vi.fn();
    mount(root, state, onSealed);

    expect(root.querySelector<HTMLButtonElement>('[data-action="toggle-stamp"]')?.disabled).toBe(true);
    root.querySelector<HTMLButtonElement>('[data-kind="proposal"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-action="toggle-stamp"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-grade="B"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-action="seal"]')!.click();

    expect(state.intakeSessions[contract.id].reward.agreedReward).toBe(40);
    expect(state.commissionSheets[contract.id]).toMatchObject({ sealed: true, playerGrade: 'B' });
    expect(onSealed).toHaveBeenCalledWith(contract);
  });

  it('지불 여력을 넘긴 요구에는 역제시를 받고 수락할 수 있다', () => {
    const state = makeState();
    mount(root, state);
    root.querySelector<HTMLButtonElement>('[data-kind="market"]')!.click();
    expect(state.intakeSessions[contract.id].reward.status).toBe('countered');
    root.querySelector<HTMLButtonElement>('[data-action="accept-counter"]')!.click();
    expect(state.intakeSessions[contract.id].reward).toMatchObject({ status: 'agreed', agreedReward: 50 });
  });
});
