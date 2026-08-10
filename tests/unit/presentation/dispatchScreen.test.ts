/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState } from '../../../src/domain/gameState';
import { createRng } from '../../../src/domain/rng';
import type { Adventurer, Client, Contract, GradeThresholds } from '../../../src/domain/types';
import type { Settlement } from '../../../src/presentation/ui/CounterScreen';
import {
  mountDispatchScreen,
  type AssignmentRules,
} from '../../../src/presentation/ui/DispatchScreen';

const RULES: AssignmentRules = {
  survivalRefusalRisk: 90,
  assignmentTrustThreshold: 0.15,
  gloryVolunteerRisk: 70,
  forcedAssignmentTrustPenalty: -0.1,
  maxConcurrentDispatches: 2,
};
const GRADES: GradeThresholds = { steady: 25, skilled: 50, veteran: 75 };

function client(): Client {
  return {
    id: 'client-1', name: '의뢰인', traits: ['cautious', 'loyal'], goal: 'money',
    trust: 0.5, memories: [], wealth: 0.5, urgency: 0.5, hasAlternative: false,
    knownBy: [], occupation: 'resident', keyLeverage: null,
  };
}

function contract(): Contract {
  return {
    id: 'contract-1', client: client(), questKind: 'escort', scenarioId: 'test',
    slots: new Map(), statedRisk: 40, realRisk: 45, concealment: 0,
    baseReward: 80, maxPartySize: 2, durationWeeks: 1, isTemptation: false, facts: [],
  };
}

function adventurer(id: string, overrides: Partial<Adventurer> = {}): Adventurer {
  return {
    id, name: id, traits: ['loyal', 'cautious'], goal: 'money', trust: 0.5,
    memories: [], capability: 50, status: 'available', inGuild: true, tenureYears: 2,
    ...overrides,
  };
}

function state(item: Contract, roster: Adventurer[]): GameState {
  return {
    week: 1, reputation: 10, funds: 200, guildTier: 1, phase: 'playing', roster,
    openContracts: [item], activeDispatches: [],
    knowledge: { discoveredContacts: new Set(), revealedFacts: new Set(), heardFacts: new Map(), slotProgress: new Map() },
    rng: createRng(1), usedNames: new Set(), nextContractId: 2, offersMade: {},
    settlements: {}, intakeSessions: {}, commissionSheets: {}, ratesIntroduced: true,
    hallAttendance: { guildMemberIds: [], visitorIds: [] }, talkedThisWeek: new Set(),
  };
}

function settlement(item: Contract): Settlement {
  return { contract: item, offer: { rewardMultiplier: 1, discloseRisk: false }, agreedReward: 80 };
}

describe('파견 화면', () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    root = document.createElement('main');
    document.body.appendChild(root);
  });

  it('길드 소속이며 대기 중인 인원만 보여준다', () => {
    const item = contract();
    const game = state(item, [
      adventurer('ready'),
      adventurer('away', { status: 'onMission' }),
      adventurer('visitor', { inGuild: false }),
    ]);
    mountDispatchScreen(root, {
      state: game, settlement: settlement(item), gradeThresholds: GRADES,
      assignmentRules: RULES, onReturnToHall: vi.fn(),
    });
    expect(root.querySelectorAll('.roster-row')).toHaveLength(1);
    expect(root.textContent).toContain('ready');
  });

  it('인원을 고르면 즉시 파견하고 시간은 진행하지 않는다', () => {
    const item = contract();
    const member = adventurer('ready');
    const game = state(item, [member]);
    mountDispatchScreen(root, {
      state: game, settlement: settlement(item), gradeThresholds: GRADES,
      assignmentRules: RULES, onReturnToHall: vi.fn(),
    });
    const checkbox = root.querySelector<HTMLInputElement>('[data-field="member"]')!;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('input', { bubbles: true }));
    root.querySelector<HTMLButtonElement>('[data-action="confirm"]')!.click();

    expect(game.week).toBe(1);
    expect(game.activeDispatches).toHaveLength(1);
    expect(game.activeDispatches[0].resolveOnWeek).toBe(2);
    expect(member.status).toBe('onMission');
    expect(root.textContent).toContain('주 마감 뒤');
    expect(root.querySelector('[data-action="advance-week"]')).toBeNull();
  });

  it('동시 파견 한도에 도달하면 확정을 막는다', () => {
    const item = contract();
    const game = state(item, [adventurer('ready')]);
    game.activeDispatches.push({
      contract: { ...item, id: 'active-1' }, partyIds: [], resolveOnWeek: 3,
      agreedReward: 10, concealedKnownRisk: false,
    }, {
      contract: { ...item, id: 'active-2' }, partyIds: [], resolveOnWeek: 3,
      agreedReward: 10, concealedKnownRisk: false,
    });
    mountDispatchScreen(root, {
      state: game, settlement: settlement(item), gradeThresholds: GRADES,
      assignmentRules: RULES, onReturnToHall: vi.fn(),
    });
    expect(root.querySelector<HTMLButtonElement>('[data-action="confirm"]')?.disabled).toBe(true);
    expect(root.textContent).toContain('동시 파견 한도');
  });

  it('미배정 또는 파견 뒤 길드 홀로 돌아갈 수 있다', () => {
    const item = contract();
    const onReturnToHall = vi.fn();
    const game = state(item, [adventurer('ready')]);
    mountDispatchScreen(root, {
      state: game, settlement: settlement(item), gradeThresholds: GRADES,
      assignmentRules: RULES, onReturnToHall,
    });
    root.querySelector<HTMLButtonElement>('[data-action="return"]')!.click();
    expect(onReturnToHall).toHaveBeenCalledOnce();
  });
});
