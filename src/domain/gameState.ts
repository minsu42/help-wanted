/**
 * 게임 상태와 주간 진행 — 8주 캠페인을 담는 그릇.
 *
 * ## 두 세계를 나눠서 보관한다
 *
 * {@link GameState.roster}와 {@link GameState.openContracts}는 **진실**이고,
 * {@link GameState.knowledge}는 **플레이어가 알아낸 것**이다. 이 분리가 이 모듈의
 * 핵심 책임이며, 덕분에 결과 대조 화면(Story 014)은 두 객체를 나란히 렌더링하는
 * 것으로 끝난다. 섞어 두면 "이 정보가 공개됐던가?" 플래그를 필드마다 흩뿌리게 된다.
 *
 * ## rng가 상태 안에 있는 이유
 *
 * 전역 싱글턴을 만들지 않는다. 시드 재현성의 전제이고, 그것이 깨지면 밸런싱 중에 본
 * 현상을 다시 만들 수 없다. `GameState`를 두 개 만들면 두 회차가 서로를 간섭하지
 * 않는다 — 테스트가 그것에 의존한다.
 *
 * ## 이 모듈은 제자리에서 바꾼다
 *
 * 다른 도메인 모듈(`negotiation`, `dispatch`)은 순수 함수지만 여기는 아니다. `rng`가
 * 이미 내부 상태를 들고 있어 `GameState`는 본질적으로 가변이고, 불변인 척하면
 * "복사본을 바꿨는데 원본이 그대로"인 버그만 생긴다. **판정은 순수하게, 적용은
 * 제자리에서** — 그 경계가 `dispatch.ts`와 이 파일 사이에 있다.
 */
import { createContract, type ContractConfig } from './contract';
import { resolveDispatch, type DispatchConfig, type DispatchResult } from './dispatch';
import { resolveWeeklyEconomy, type EconomyConfig } from './economy';
import { resolveHallAttendance, type HallAttendance } from './hall';
import {
  resolveDispatchAftermath,
  resolveForcedAssignment,
  type ReputationConfig,
} from './reputation';
import type { NamePool } from './person';
import { createWorldRoster, type RosterConfig } from './roster';
import { createRng, type Rng } from './rng';
import { openingProgress } from './intake';
import { intakeOfferTerms, type IntakeWalletConfig } from './intakeOffer';
import { scenarioIntro } from './occupation';
import { slotProgressKey } from './slots';
import type { CommissionSheet, IntakeSession } from './types';
import type { Adventurer, Contract, GuildTier, MutableKnowledge, SettledTerms } from './types';

/** 회차가 끝났는지. 끝난 회차는 더 진행할 수 없다. */
export type SessionPhase = 'playing' | 'ended';

/** 파견 나가 있는 계약 하나. `durationWeeks`가 지나면 판정한다. */
export interface ActiveDispatch {
  readonly contract: Contract;
  /** 배정된 모험가들. 참조가 아니라 id다 — 명부가 유일한 사람 저장소여야 한다 */
  readonly partyIds: readonly string[];
  /** 이 주를 마감할 때 판정한다 */
  readonly resolveOnWeek: number;
  /**
   * 타결액. 완수(success/injured)하면 전액 들어오고, 사망이면 무조건 못 받는다.
   *
   * > 2026-08-09 개정 — `remainingReward`에서 `agreedReward`로 개명했다. 선불 축이
   * > 사라지면서 "타결액에서 선불을 뺀 나머지"였던 원래 뜻이 없어졌다 — 이제 이
   * > 값 자체가 타결액 전부다.
   */
  readonly agreedReward: number;
  /**
   * 실제 위험을 알고도 고지하지 않았는가.
   *
   * 사망이 났을 때 `trust` 하락폭을 가르는 값이다(Story 013). 침묵의 대가가 가장
   * 커야 착취가 정보망을 스스로 조인다.
   */
  readonly concealedKnownRisk: boolean;
}

/** 세션 전체. 이 객체 하나가 회차의 전부다. */
export interface GameState {
  week: number;
  reputation: number;
  funds: number;
  guildTier: number;
  phase: SessionPhase;
  /** 월드 풀 전체 — 길드원과 외부 모험가를 모두 담는다 */
  readonly roster: Adventurer[];
  openContracts: Contract[];
  activeDispatches: ActiveDispatch[];
  /** 플레이어가 알아낸 것. 진실의 부분집합이다 */
  readonly knowledge: MutableKnowledge;
  readonly rng: Rng;
  /** 이름 충돌 방지용 공유 집합. 모험가와 의뢰인이 함께 쓴다 */
  readonly usedNames: Set<string>;
  /** 다음 의뢰에 붙일 번호. 의뢰 id가 회차 안에서 유일해야 한다 */
  nextContractId: number;
  /**
   * 의뢰별로 이미 내민 제안 횟수.
   *
   * 화면이 아니라 여기 있는 이유: 창구를 나갔다 들어오면 초기화되는 곳에 두면
   * **재진입으로 결렬 규칙을 우회할 수 있다.** `maxOffers`가 2인 것이 흥정을
   * 긴장시키는 전부이므로 세션 상태로 둔다.
   */
  offersMade: Record<string, number>;
  /**
   * 타결됐으나 아직 배정되지 않은 의뢰의 조건. 키는 의뢰 id다.
   *
   * `offersMade`와 같은 이유로 화면이 아니라 여기 있다 — **배정 화면을 나갔다가
   * 창구로 돌아와도 조건이 남아 있어야 하기 때문이다.** 화면에 두면 화면이 파괴될
   * 때 함께 사라지고, 그러면 플레이어는 이미 타결한 의뢰를 처음부터 다시 흥정해야
   * 하는데 `offersMade`가 이미 차 있어 다음 제안이 곧바로 결렬된다.
   *
   * `dispatchParty`가 그 의뢰를 소비할 때 함께 지워진다 — 열린 의뢰에서 빠지는
   * 시점과 같다. 기록: `design/quick-specs/assignment-reluctance-2026-08-09.md` §5.
   */
  settlements: Record<string, SettledTerms>;
  /** 새 청취 화면을 나갔다 돌아와도 유지되는 의뢰인별 상태. */
  intakeSessions: Record<string, IntakeSession>;
  /** 자동 기록과 분리된 플레이어 판단/도장 상태. */
  commissionSheets: Record<string, CommissionSheet>;
  /** 첫 계약 전에 시세권을 자동으로 펼친 적이 있는가. */
  ratesIntroduced: boolean;
  /**
   * 이번 주 길드 홀에 있는 사람들. **한 주에 한 번만 뽑아 여기 고정한다.**
   *
   * 화면이 재렌더될 때마다 `resolveHallAttendance`를 다시 부르면 같은 주인데 출석자가
   * 바뀐다. 결과를 {@link WeekReport}가 아니라 여기 두는 이유도 같다 — `WeekReport`는
   * `advanceWeek` 한 번의 반환값이라 홀을 나갔다 다시 들어오면 다시 읽을 방법이 없고,
   * 화면은 `roster`나 `openContracts`처럼 매 렌더마다 상태를 읽어야 한다.
   */
  hallAttendance: HallAttendance;
  /**
   * 이번 주 이미 대화한 사람의 id.
   *
   * {@link GameState.offersMade}와 정확히 같은 이유로 화면이 아니라 여기 있다 — 화면에
   * 두면 **길드 홀을 나갔다 들어오는 것만으로 재대화 금지를 우회할 수 있다.** 한 주의
   * 정보 획득량 상한이 이 게임의 희소성 자체이므로 세션 상태로 둔다.
   */
  talkedThisWeek: Set<string>;
}

/** 회차 하나를 굴리는 데 필요한 모든 수치. `balance.json`과 `names.json`에서 온다. */
export interface GameConfig {
  readonly totalWeeks: number;
  readonly clientsPerWeek: number;
  readonly startingFunds: number;
  readonly startingReputation: number;
  readonly injuredWeeks: number;
  readonly guildTiers: readonly GuildTier[];
  readonly roster: RosterConfig;
  readonly contract: ContractConfig;
  readonly dispatch: DispatchConfig;
  readonly economy: EconomyConfig;
  readonly reputation: ReputationConfig;
  /**
   * 홀 출석 수치 중 **등급표에서 오지 않는 것들만.**
   *
   * `hallAttendanceMax`가 여기 없는 것이 의도다 — 그 값은 현재 길드 등급
   * (`GuildTier.hallAttendanceMax`)에서 오므로 매일 달라질 수 있고, 설정에 박아 두면
   * 확장을 사도 홀이 넓어지지 않는다. 두 출처를 합치는 일은 호출 지점이 한다.
   */
  readonly hall: {
    readonly hallAttendanceMin: number;
    readonly visitorMin: number;
    readonly visitorMax: number;
  };
  readonly intakeWallet: IntakeWalletConfig;
  readonly names: NamePool;
}

/** 판정이 끝난 파견 하나. */
export interface ResolvedDispatch {
  readonly dispatch: ActiveDispatch;
  readonly result: DispatchResult;
}

/**
 * 한 주를 넘긴 결과 요약.
 *
 * 자금·명성 반영(Story 012)과 `trust`·`Memory` 기록(Story 013)이 이것을 읽는다.
 * 그 둘을 여기서 하지 않는 이유는 각자의 규칙이 따로 있고, 섞으면 이 함수가 회차의
 * 모든 규칙을 아는 신 함수가 되기 때문이다.
 */
export interface WeekReport {
  /** 넘어간 뒤의 주차 */
  readonly week: number;
  readonly resolved: readonly ResolvedDispatch[];
  /** 이번 주 부상에서 회복한 모험가 id */
  readonly recovered: readonly string[];
  readonly newContracts: readonly Contract[];
  readonly phase: SessionPhase;
}

/**
 * 새 회차를 시작한다.
 *
 * 같은 `seed`와 같은 `config`면 언제나 같은 회차가 나온다 — 첫 주 의뢰까지 동일하다.
 */
export function createGameState(seed: number, config: GameConfig): GameState {
  const rng = createRng(seed);
  const usedNames = new Set<string>();

  const state: GameState = {
    week: 1,
    reputation: config.startingReputation,
    funds: config.startingFunds,
    guildTier: 1,
    phase: 'playing',
    roster: createWorldRoster(rng, config.roster, config.names, usedNames),
    openContracts: [],
    activeDispatches: [],
    knowledge: {
      discoveredContacts: new Set(),
      revealedFacts: new Set(),
      heardFacts: new Map(),
      slotProgress: new Map(),
    },
    rng,
    usedNames,
    nextContractId: 0,
    offersMade: {},
    settlements: {},
    intakeSessions: {},
    commissionSheets: {},
    ratesIntroduced: false,
    // 1주차 홀은 여기서 채운다. `advanceWeek`는 2주차부터 도는 함수이므로 거기에만
    // 출석 판정을 두면 첫 주 홀이 비어 있고, 플레이어가 정보를 캘 창이 없는 상태로
    // 첫 흥정을 하게 된다.
    hallAttendance: { guildMemberIds: [], visitorIds: [] },
    talkedThisWeek: new Set(),
  };

  refillContracts(state, config);
  rollHallAttendance(state, config);
  return state;
}

/**
 * 열린 의뢰에 파티를 배정해 내보낸다.
 *
 * **배정 꺼림 규칙(`goal === 'survival'`, 낮은 `trust`)은 여기 없다** — Story 008의
 * 몫이며, 호출자가 판정해서 {@link options.reluctantIds}로 넘긴다. 이 함수는 상태
 * 전이와 그 대가의 적용만 책임진다.
 *
 * > 2026-08-09 개정 — 이전에는 *"호출자가 이미 걸러서 넘긴다"* 였다. 꺼리는 사람은
 * > 아예 배정될 수 없었기 때문이다. 그 하드 게이트가 **가용한 전원이 꺼리면 게임이
 * > 멈추는** 막다른 길을 만들어 대가로 바뀌었고, 그래서 이제 꺼리는 사람도 넘어온다.
 * > 기록: `design/quick-specs/assignment-reluctance-2026-08-09.md`.
 *
 * @throws 의뢰가 열려 있지 않을 때, 파티가 비었거나 정원을 넘을 때,
 *   배정 대상이 명부에 없거나 `available`이 아닐 때
 */
export function dispatchParty(
  state: GameState,
  contractId: string,
  partyIds: readonly string[],
  options: {
    readonly agreedReward?: number;
    readonly concealedKnownRisk?: boolean;
    /**
     * 내키지 않는다고 했는데도 강행 배정된 사람들. `partyIds`의 부분집합이어야 한다 —
     * 여기 없는 사람은 순순히 간 것이다.
     */
    readonly reluctantIds?: readonly string[];
    /** 강행 한 명당 신뢰 감소분(음수). `balance.json`의 `dispatch.forcedAssignmentTrustPenalty` */
    readonly forcedAssignmentTrustPenalty?: number;
    readonly maxConcurrentDispatches?: number;
  } = {},
): ActiveDispatch {
  const contractIndex = state.openContracts.findIndex((contract) => contract.id === contractId);
  if (contractIndex === -1) {
    throw new Error(`열려 있지 않은 의뢰에는 배정할 수 없다 (${contractId})`);
  }
  const contract = state.openContracts[contractIndex];

  if (options.maxConcurrentDispatches !== undefined && state.activeDispatches.length >= options.maxConcurrentDispatches) {
    throw new Error(`동시 파견 한도에 도달했다 (${options.maxConcurrentDispatches}건)`);
  }

  if (partyIds.length === 0) {
    throw new Error('빈 파티는 배정할 수 없다');
  }
  if (partyIds.length > contract.maxPartySize) {
    throw new Error(
      `파티 정원 초과 (${partyIds.length}명 > ${contract.maxPartySize}명, ${contractId})`,
    );
  }
  if (new Set(partyIds).size !== partyIds.length) {
    throw new Error('같은 사람을 두 번 배정할 수 없다');
  }

  const party = partyIds.map((id) => requireMember(state, id));
  for (const member of party) {
    if (member.status !== 'available') {
      throw new Error(`${member.id}는 지금 배정할 수 없다 (상태: ${member.status})`);
    }
  }

  // 강행의 대가를 상태 전이 **전에** 적용한다. `resolveForcedAssignment`가 현재
  // trust를 읽어 최종값을 계산하므로 순서 자체는 무관하지만, 여기 두면 "이 사람들을
  // 억지로 보냈다"가 보내는 동작 바로 옆에 붙어 읽힌다.
  const reluctantIds = new Set(options.reluctantIds ?? []);
  if (reluctantIds.size > 0) {
    const forced = resolveForcedAssignment(
      party.filter((member) => reluctantIds.has(member.id)),
      state.week,
      options.forcedAssignmentTrustPenalty ?? 0,
    );
    for (const update of forced.trustUpdates) {
      requireMember(state, update.personId).trust = update.trust;
    }
    for (const update of forced.memoryUpdates) {
      requireMember(state, update.personId).memories.push(update.memory);
    }
  }

  for (const member of party) {
    member.status = 'onMission';
  }
  state.openContracts.splice(contractIndex, 1);
  // 타결 조건은 의뢰가 열린 목록에서 빠지는 것과 같은 시점에 지운다. 안 지우면
  // 회차가 끝날 때까지 죽은 의뢰의 조건이 쌓인다.
  delete state.settlements[contractId];
  delete state.intakeSessions[contractId];
  delete state.commissionSheets[contractId];

  const dispatch: ActiveDispatch = {
    contract,
    partyIds: [...partyIds],
    resolveOnWeek: state.week + contract.durationWeeks,
    agreedReward: options.agreedReward ?? 0,
    concealedKnownRisk: options.concealedKnownRisk ?? false,
  };
  state.activeDispatches.push(dispatch);

  return dispatch;
}

/**
 * 한 주를 넘긴다.
 *
 * 순서가 중요하다 — **① 파견 만료 판정 → ② 부상 회복 → ③ 새 의뢰 생성**. 판정을
 * 먼저 해야 그 주 돌아온 사람이 그 주의 홀 출석 후보가 된다. 홀 출석 결정 자체는
 * Story 010의 몫이며 이 함수는 그 앞까지만 한다.
 *
 * @throws 이미 끝난 회차일 때
 */
export function advanceWeek(state: GameState, config: GameConfig): WeekReport {
  if (state.phase === 'ended') {
    throw new Error(`이미 끝난 회차다 (${config.totalWeeks}주 종료)`);
  }

  state.week += 1;

  const resolved = resolveDueDispatches(state, config);
  applyReputationEffects(state, resolved, config);
  const recovered = recoverInjured(state);

  // 파견 판정과 부상 회복 **뒤**에 뽑는다. 이번 주 돌아온 사람과 이번 주 회복한 사람이
  // 이번 주의 홀 출석 후보가 되어야 하기 때문이다. 등급 상한을 이 시점에 읽는 것이
  // "확장은 다음 주부터 반영된다"를 공짜로 만든다 — 등급을 올린 주의 advanceWeek는
  // 이미 지나갔으므로 다음 호출에서야 새 상한이 적용된다.
  rollHallAttendance(state, config);

  // 의뢰 생성보다 **먼저** 정산한다. 의뢰 난이도가 명성에서 나오므로, 이번 주의 성과가
  // 이번 주 도착하는 의뢰에 반영되어야 "성공이 곧 위험 상승"이 한 주 단위로 성립한다.
  applyEconomy(state, resolved, config);

  let newContracts: Contract[] = [];
  if (state.week > config.totalWeeks) {
    state.phase = 'ended';
  } else {
    newContracts = refillContracts(state, config);
  }

  return { week: state.week, resolved, recovered, newContracts, phase: state.phase };
}

/**
 * 이번 주의 홀 출석자를 뽑아 상태에 고정하고, "이번 주 대화한 사람"을 비운다.
 *
 * 두 일이 한 함수에 있는 이유: 새 출석자 명단과 빈 대화 기록은 **같은 사건**이다.
 * 따로 두면 한쪽만 부르는 실수가 나고, 그러면 어제 대화한 사람과 이번 주 온 사람이
 * 어긋난 상태로 화면에 나간다.
 *
 * `hallAttendanceMax`만 등급표에서 오고 나머지는 `balance.json`에서 온다 — 두 출처를
 * 합치는 일이 `hall.ts`가 아니라 여기 있는 이유는, 그 파일이 어느 쪽이 설정이고 어느
 * 쪽이 등급표인지 몰라도 되게 하기 위해서다.
 */
function rollHallAttendance(state: GameState, config: GameConfig): void {
  state.hallAttendance = resolveHallAttendance(state.roster, state.rng, {
    hallAttendanceMin: config.hall.hallAttendanceMin,
    hallAttendanceMax: currentTier(state, config).hallAttendanceMax,
    visitorMin: config.hall.visitorMin,
    visitorMax: config.hall.visitorMax,
  });
  state.talkedThisWeek = new Set();
}

/** 현재 등급의 룩업 테이블 행. */
export function currentTier(state: GameState, config: GameConfig): GuildTier {
  const tier = config.guildTiers.find((entry) => entry.tier === state.guildTier);
  if (tier === undefined) {
    throw new Error(`정의되지 않은 길드 등급이다 (${state.guildTier})`);
  }
  return tier;
}

/** 명부에서 사람을 찾는다. 없으면 던진다 — 조용히 undefined를 흘리지 않는다. */
function requireMember(state: GameState, id: string): Adventurer {
  const member = state.roster.find((person) => person.id === id);
  if (member === undefined) {
    throw new Error(`명부에 없는 모험가다 (${id})`);
  }
  return member;
}

/**
 * 이번 주 만기가 된 파견을 판정하고 상태를 적용한다.
 *
 * 판정 자체는 `resolveDispatch`(순수 함수)가 하고, 여기서는 그 결과를 명부에 반영만
 * 한다. 자금·명성은 건드리지 않는다 — Story 012가 {@link WeekReport}를 읽어서 한다.
 */
function resolveDueDispatches(state: GameState, config: GameConfig): ResolvedDispatch[] {
  const resolved: ResolvedDispatch[] = [];
  const stillRunning: ActiveDispatch[] = [];

  for (const dispatch of state.activeDispatches) {
    if (dispatch.resolveOnWeek > state.week) {
      stillRunning.push(dispatch);
      continue;
    }

    const party = dispatch.partyIds.map((id) => requireMember(state, id));
    const result = resolveDispatch(party, dispatch.contract, state.rng, config.dispatch);
    applyOutcome(state, party, result, config);
    resolved.push({ dispatch, result });
  }

  state.activeDispatches = stillRunning;
  return resolved;
}

/**
 * 판정 결과를 파티원의 상태에 반영한다.
 *
 * 사상자를 제외한 전원은 돌아온다. 사망은 영구다 — 어떤 경로로도 `available`로
 * 되돌리지 않는다.
 */
function applyOutcome(
  state: GameState,
  party: readonly Adventurer[],
  result: DispatchResult,
  config: GameConfig,
): void {
  for (const member of party) {
    if (member.id === result.casualtyId) continue;
    member.status = 'available';
  }

  if (result.casualtyId === undefined) return;

  const casualty = requireMember(state, result.casualtyId);
  if (result.outcome === 'dead') {
    casualty.status = 'dead';
    return;
  }

  casualty.status = 'injured';
  casualty.recoversOnWeek = state.week + config.injuredWeeks;
}

/**
 * 이번 주 판정된 파견들의 자금·명성을 반영한다.
 *
 * 계산은 `economy.ts`(순수 함수)가 하고 여기서는 제자리에 적기만 한다 — 이 파일의
 * "판정은 순수하게, 적용은 제자리에서" 경계를 그대로 따른다.
 *
 * > 2026-08-09 개정 — 잔금 미지급 제거로 `resolveWeeklyEconomy`가 더 이상 rng를
 * > 받지 않는다. 떼인 의뢰인의 지불 여력을 영구 기록하던 절차(`knownWealth`)도
 * > 함께 사라졌다.
 */
function applyEconomy(
  state: GameState,
  resolved: readonly ResolvedDispatch[],
  config: GameConfig,
): void {
  const settled = resolveWeeklyEconomy(resolved, state.funds, state.reputation, config.economy);

  state.funds = settled.funds;
  state.reputation = settled.reputation;
}

/**
 * 이번 주 판정된 파견들의 `trust`·`Memory`를 명부에 적는다.
 *
 * `applyEconomy`와 나란히 두는 것이 이 파일의 관례다 — 계산은 `reputation.ts`(순수
 * 함수)가 하고 여기서는 제자리에 적기만 한다. `resolveDueDispatches` 안에 넣지 않은
 * 이유: 그 함수는 "누가 어떤 상태가 되었는가"만 책임지고, 신뢰가 어떻게 번지는지는
 * 완전히 다른 규칙이다. 섞으면 파견 판정을 읽는 사람이 신뢰 공식까지 알아야 한다.
 */
function applyReputationEffects(
  state: GameState,
  resolved: readonly ResolvedDispatch[],
  config: GameConfig,
): void {
  for (const { dispatch, result } of resolved) {
    const party = dispatch.partyIds.map((id) => requireMember(state, id));
    const partyIds = new Set(dispatch.partyIds);

    // 사망 소식을 듣는 사람들 — 살아 있는 길드원 중 이번 파견에 나가지 않은 이들.
    // 외부 모험가는 제외한다(길드 소식이 도는 곳은 홀이고, 그들은 소속이 아니다).
    // 거르는 일이 여기 있는 이유: `reputation.ts`는 누가 길드원인지 몰라야 한다.
    const bystanders = state.roster.filter(
      (person) =>
        person.inGuild && person.status !== 'dead' && !partyIds.has(person.id),
    );

    const aftermath = resolveDispatchAftermath(
      party,
      bystanders,
      result,
      dispatch.contract.statedRisk,
      dispatch.concealedKnownRisk,
      state.week,
      config.reputation,
    );

    for (const update of aftermath.trustUpdates) {
      requireMember(state, update.personId).trust = update.trust;
    }
    for (const update of aftermath.memoryUpdates) {
      requireMember(state, update.personId).memories.push(update.memory);
    }
  }
}

/** 회복일이 된 부상자를 복귀시킨다. */
function recoverInjured(state: GameState): string[] {
  const recovered: string[] = [];

  for (const member of state.roster) {
    if (member.status !== 'injured') continue;
    if (member.recoversOnWeek === undefined || member.recoversOnWeek > state.week) continue;

    member.status = 'available';
    member.recoversOnWeek = undefined;
    recovered.push(member.id);
  }

  return recovered;
}

/**
 * 열린 의뢰를 등급별 상한까지 채운다.
 *
 * 명성이 압력을 만든다 — 의뢰 생성이 현재 명성을 읽으므로, 성공할수록 감당 못 할
 * 것이 온다.
 */
function refillContracts(state: GameState, config: GameConfig): Contract[] {
  const created: Contract[] = [];
  for (let index = 0; index < config.clientsPerWeek; index += 1) {
    const contract = createContract(state.rng, config.contract, {
      id: `ct-${state.nextContractId}`,
      reputation: state.reputation,
      roster: state.roster,
      names: config.names,
      usedNames: state.usedNames,
    });
    state.nextContractId += 1;
    state.openContracts.push(contract);
    initializeIntake(state, contract, config);
    created.push(contract);
  }

  return created;
}

function initializeIntake(state: GameState, contract: Contract, config: GameConfig): void {
  const intake = config.contract.intake;
  if (intake === undefined || contract.questKind === 'legacy') return;

  state.intakeSessions[contract.id] = {
    patience: intake.patience,
    clientPresent: true,
    dialogue: [{
      speaker: 'client',
      text: scenarioIntro(intake.questTypes, contract.questKind, contract.scenarioId),
    }],
    expression: 'neutral',
    askCounts: {},
    reward: {
      ...intakeOfferTerms(contract.client, contract.baseReward, intake.occupations, config.intakeWallet),
      status: 'offered',
    },
  };
  state.commissionSheets[contract.id] = { contractId: contract.id, sealed: false };
  for (const [slot, truth] of contract.slots) {
    const progress = openingProgress(truth, intake.openingStatementDepth);
    if (progress !== undefined) state.knowledge.slotProgress.set(slotProgressKey(contract.id, slot), progress);
  }
}
