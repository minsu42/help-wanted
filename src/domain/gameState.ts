/**
 * 게임 상태와 일일 진행 — 15일 회차를 담는 그릇.
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
import { receiveAdvance, resolveDailyEconomy, type EconomyConfig } from './economy';
import type { NamePool } from './person';
import { createWorldRoster, type RosterConfig } from './roster';
import { createRng, type Rng } from './rng';
import type { Adventurer, Contract, GuildTier, MutableKnowledge } from './types';

/** 회차가 끝났는지. 끝난 회차는 더 진행할 수 없다. */
export type SessionPhase = 'playing' | 'ended';

/** 파견 나가 있는 계약 하나. `durationDays`가 지나면 판정한다. */
export interface ActiveDispatch {
  readonly contract: Contract;
  /** 배정된 모험가들. 참조가 아니라 id다 — 명부가 유일한 사람 저장소여야 한다 */
  readonly partyIds: readonly string[];
  /** 이 날 아침에 판정한다 */
  readonly resolveOnDay: number;
  /**
   * 협상에서 미리 받아둔 금액. **사망해도 남는다** — 선불 축의 존재 이유다.
   * 파견 시점에 이미 자금에 들어간다.
   */
  readonly advancePaid: number;
  /**
   * 타결액에서 선불을 뺀 나머지. 의뢰를 완수해야 받고, 그때도 `wealth` 판정을 통과해야 한다.
   *
   * 사망이면 무조건 못 받는다. **선불로 받아둔 몫과 이것의 차이가 흥정에서 선불 축을
   * 미는 이유 전부다.**
   */
  readonly remainingReward: number;
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
  day: number;
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
}

/** 회차 하나를 굴리는 데 필요한 모든 수치. `balance.json`과 `names.json`에서 온다. */
export interface GameConfig {
  readonly totalDays: number;
  readonly startingFunds: number;
  readonly startingReputation: number;
  readonly injuredDays: number;
  readonly guildTiers: readonly GuildTier[];
  readonly roster: RosterConfig;
  readonly contract: ContractConfig;
  readonly dispatch: DispatchConfig;
  readonly economy: EconomyConfig;
  readonly names: NamePool;
}

/** 판정이 끝난 파견 하나. */
export interface ResolvedDispatch {
  readonly dispatch: ActiveDispatch;
  readonly result: DispatchResult;
}

/**
 * 하루를 넘긴 결과 요약.
 *
 * 자금·명성 반영(Story 012)과 `trust`·`Memory` 기록(Story 013)이 이것을 읽는다.
 * 그 둘을 여기서 하지 않는 이유는 각자의 규칙이 따로 있고, 섞으면 이 함수가 회차의
 * 모든 규칙을 아는 신 함수가 되기 때문이다.
 */
export interface DayReport {
  /** 넘어간 뒤의 날짜 */
  readonly day: number;
  readonly resolved: readonly ResolvedDispatch[];
  /** 오늘 부상에서 회복한 모험가 id */
  readonly recovered: readonly string[];
  readonly newContracts: readonly Contract[];
  readonly phase: SessionPhase;
}

/**
 * 새 회차를 시작한다.
 *
 * 같은 `seed`와 같은 `config`면 언제나 같은 회차가 나온다 — 첫날 의뢰까지 동일하다.
 */
export function createGameState(seed: number, config: GameConfig): GameState {
  const rng = createRng(seed);
  const usedNames = new Set<string>();

  const state: GameState = {
    day: 1,
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
      knownWealth: new Map(),
    },
    rng,
    usedNames,
    nextContractId: 0,
    offersMade: {},
  };

  refillContracts(state, config);
  return state;
}

/**
 * 열린 의뢰에 파티를 배정해 내보낸다.
 *
 * **배정 거부 규칙(`goal === 'survival'`, 낮은 `trust`)은 여기 없다** — Story 008의
 * 몫이며, 호출자가 이미 걸러서 넘긴다고 본다. 이 함수는 상태 전이만 책임진다.
 *
 * @throws 의뢰가 열려 있지 않을 때, 파티가 비었거나 정원을 넘을 때,
 *   배정 대상이 명부에 없거나 `available`이 아닐 때
 */
export function dispatchParty(
  state: GameState,
  contractId: string,
  partyIds: readonly string[],
  options: {
    readonly advancePaid?: number;
    readonly remainingReward?: number;
    readonly concealedKnownRisk?: boolean;
  } = {},
): ActiveDispatch {
  const contractIndex = state.openContracts.findIndex((contract) => contract.id === contractId);
  if (contractIndex === -1) {
    throw new Error(`열려 있지 않은 의뢰에는 배정할 수 없다 (${contractId})`);
  }
  const contract = state.openContracts[contractIndex];

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

  for (const member of party) {
    member.status = 'onMission';
  }
  state.openContracts.splice(contractIndex, 1);

  const advancePaid = options.advancePaid ?? 0;
  const dispatch: ActiveDispatch = {
    contract,
    partyIds: [...partyIds],
    resolveOnDay: state.day + contract.durationDays,
    advancePaid,
    remainingReward: options.remainingReward ?? 0,
    concealedKnownRisk: options.concealedKnownRisk ?? false,
  };
  state.activeDispatches.push(dispatch);

  // 선불은 파견과 동시에 지갑에 들어온다. 판정이 없다 — 그것이 선불 축의 존재 이유다.
  state.funds = receiveAdvance(state.funds, advancePaid);

  return dispatch;
}

/**
 * 하루를 넘긴다.
 *
 * 순서가 중요하다 — **① 파견 만료 판정 → ② 부상 회복 → ③ 새 의뢰 생성**. 판정을
 * 먼저 해야 그날 돌아온 사람이 그날의 홀 출석 후보가 된다. 홀 출석 결정 자체는
 * Story 010의 몫이며 이 함수는 그 앞까지만 한다.
 *
 * @throws 이미 끝난 회차일 때
 */
export function advanceDay(state: GameState, config: GameConfig): DayReport {
  if (state.phase === 'ended') {
    throw new Error(`이미 끝난 회차다 (${config.totalDays}일 종료)`);
  }

  state.day += 1;

  const resolved = resolveDueDispatches(state, config);
  const recovered = recoverInjured(state);

  // 의뢰 생성보다 **먼저** 정산한다. 의뢰 난이도가 명성에서 나오므로, 오늘의 성과가
  // 오늘 도착하는 의뢰에 반영되어야 "성공이 곧 위험 상승"이 하루 단위로 성립한다.
  applyEconomy(state, resolved, config);

  const newContracts = refillContracts(state, config);

  if (state.day > config.totalDays) {
    state.phase = 'ended';
  }

  return { day: state.day, resolved, recovered, newContracts, phase: state.phase };
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
 * 오늘 만기가 된 파견을 판정하고 상태를 적용한다.
 *
 * 판정 자체는 `resolveDispatch`(순수 함수)가 하고, 여기서는 그 결과를 명부에 반영만
 * 한다. 자금·명성은 건드리지 않는다 — Story 012가 {@link DayReport}를 읽어서 한다.
 */
function resolveDueDispatches(state: GameState, config: GameConfig): ResolvedDispatch[] {
  const resolved: ResolvedDispatch[] = [];
  const stillRunning: ActiveDispatch[] = [];

  for (const dispatch of state.activeDispatches) {
    if (dispatch.resolveOnDay > state.day) {
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
  casualty.recoversOnDay = state.day + config.injuredDays;
}

/**
 * 오늘 판정된 파견들의 자금·명성을 반영하고, 떼인 의뢰인의 지불 여력을 영구 기록한다.
 *
 * 계산은 `economy.ts`(순수 함수)가 하고 여기서는 제자리에 적기만 한다 — 이 파일의
 * "판정은 순수하게, 적용은 제자리에서" 경계를 그대로 따른다.
 */
function applyEconomy(
  state: GameState,
  resolved: readonly ResolvedDispatch[],
  config: GameConfig,
): void {
  const settled = resolveDailyEconomy(
    resolved,
    state.funds,
    state.reputation,
    state.rng,
    config.economy,
  );

  state.funds = settled.funds;
  state.reputation = settled.reputation;

  for (const reveal of settled.wealthReveals) {
    state.knowledge.knownWealth.set(reveal.clientId, reveal.wealth);
  }
}

/** 회복일이 된 부상자를 복귀시킨다. */
function recoverInjured(state: GameState): string[] {
  const recovered: string[] = [];

  for (const member of state.roster) {
    if (member.status !== 'injured') continue;
    if (member.recoversOnDay === undefined || member.recoversOnDay > state.day) continue;

    member.status = 'available';
    member.recoversOnDay = undefined;
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
  const capacity = currentTier(state, config).concurrentContracts;

  while (state.openContracts.length < capacity) {
    const contract = createContract(state.rng, config.contract, {
      id: `ct-${state.nextContractId}`,
      reputation: state.reputation,
      roster: state.roster,
      names: config.names,
      usedNames: state.usedNames,
    });
    state.nextContractId += 1;
    state.openContracts.push(contract);
    created.push(contract);
  }

  return created;
}
