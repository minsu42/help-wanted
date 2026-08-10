/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState } from '../../../src/domain/gameState';
import { createRng } from '../../../src/domain/rng';
import type { Contract } from '../../../src/domain/types';
import { mountIntakeScreen } from '../../../src/presentation/ui/IntakeScreen';

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
  maxPartySize: 1, durationDays: 1, isTemptation: false, facts: [],
};

function makeState(): GameState {
  return {
    day: 1, reputation: 10, funds: 200, guildTier: 1, phase: 'playing', roster: [],
    openContracts: [contract], activeDispatches: [],
    knowledge: {
      discoveredContacts: new Set(), revealedFacts: new Set(), heardFacts: new Map(),
      slotProgress: new Map([['contract-art:kind', { state: 'vague' }]]),
    },
    rng: createRng(1), usedNames: new Set(), nextContractId: 1, offersMade: {}, settlements: {},
    intakeSessions: {
      'contract-art': { patience: 3, clientPresent: true, message: '의뢰서를 내밀었다.', expression: 'neutral' },
    },
    commissionSheets: { 'contract-art': { contractId: 'contract-art', sealed: false } },
    ratesIntroduced: true,
    hallAttendance: { guildMemberIds: [], visitorIds: [] }, talkedToday: new Set(),
  };
}

describe('청취 의뢰서 아트 인터랙션', () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    root = document.createElement('main');
    document.body.appendChild(root);
  });

  it('도장 도구 하나만 보이고 펼쳤을 때만 다섯 등급을 노출한다', () => {
    const state = makeState();
    const onSealed = vi.fn();
    mountIntakeScreen(root, {
      state, contract,
      slotContent: { 'test:kind': { topic: '종류', vague: '조사', certain: '현장 조사', weight: 0, hintTags: [] } },
      handbook: [], statedGrade: 'C', onSealed,
      copy: { firstAction: '칸을 눌러 묻는다.' },
      onVisitHall: vi.fn(), onEndDay: vi.fn(),
    });

    expect(root.querySelectorAll('.slot')).toHaveLength(7);
    expect(root.querySelectorAll('[data-action="grade"]')).toHaveLength(0);
    const stamp = root.querySelector<HTMLButtonElement>('[data-action="toggle-stamp"]');
    expect(stamp?.getAttribute('aria-expanded')).toBe('false');

    stamp?.click();
    expect(root.querySelectorAll('[data-action="grade"]')).toHaveLength(5);
    root.querySelector<HTMLButtonElement>('[data-grade="B"]')?.click();
    expect(state.commissionSheets[contract.id].playerGrade).toBe('B');

    const seal = root.querySelector<HTMLButtonElement>('[data-action="seal"]');
    expect(seal?.textContent).toContain('B 날인');
    seal?.click();
    expect(state.commissionSheets[contract.id].sealed).toBe(true);
    expect(onSealed).toHaveBeenCalledOnce();
    expect(root.querySelector('.intake__guide')).toBeNull();
  });

  it('첫 방문에만 핵심 행동 안내를 보여준다', () => {
    const state = makeState();
    state.ratesIntroduced = false;
    mountIntakeScreen(root, {
      state, contract,
      slotContent: { 'test:kind': { topic: '종류', vague: '조사', certain: '현장 조사', weight: 0, hintTags: [] } },
      handbook: [], statedGrade: 'C', copy: { firstAction: '칸을 눌러 묻는다.' },
      onSealed: vi.fn(), onVisitHall: vi.fn(), onEndDay: vi.fn(),
    });

    expect(root.querySelector('.intake__guide')?.textContent).toContain('칸을 눌러');
    expect(state.ratesIntroduced).toBe(true);
  });

  it('사용할 재료가 없으면 빈 재료 상자를 그리지 않는다', () => {
    const state = makeState();
    state.intakeSessions[contract.id].selectedSlot = 'kind';
    state.intakeSessions[contract.id].materialMode = 'insight';
    mountIntakeScreen(root, {
      state, contract,
      slotContent: { 'test:kind': { topic: '종류', vague: '조사', certain: '현장 조사', weight: 0, hintTags: [] } },
      handbook: [], statedGrade: 'C', copy: { firstAction: '칸을 눌러 묻는다.' },
      onSealed: vi.fn(), onVisitHall: vi.fn(), onEndDay: vi.fn(),
    });
    expect(root.querySelector('.intake__materials')).toBeNull();
  });
});
