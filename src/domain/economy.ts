/**
 * 명성·자금 경제 — 선불 축이 값을 하는 곳.
 *
 * ## 왜 잔금 미지급이 있어야 하는가
 *
 * 잔금 미지급이 없으면 "계약 타결 = 돈"이 되어 실패 경로가 결렬 하나뿐이 되고,
 * 그러면 흥정의 선불 축을 자를 이유가 생긴다. 선불로 받아둔 몫이 사망·미지급에도
 * 살아남기 때문에 선불 축은 "정보(=wealth를 아는가)를 현금 흐름 방어로 바꾸는" 축이
 * 된다. `dispatch.ts`가 사람이 죽는 곳이라면, 이 모듈은 그 실패가 지갑에 닿는 곳이다.
 *
 * ## 판정은 순수 함수로, 적용은 호출자가
 *
 * `gameState.ts`의 관례를 그대로 따른다 — 이 파일은 "이만큼 변한다"만 계산해 돌려주고
 * `GameState`를 직접 바꾸지 않는다. `advanceDay`가 `DayReport.resolved`를 읽어 이
 * 모듈을 부르고 결과를 제자리에 반영하는 쪽이 호출자의 몫이다.
 *
 * ## dead의 미지급과 success/injured의 미지급은 다르다
 *
 * `dead`는 `wealth`와 무관하게 **무조건** 잔금이 없다(파견 자체가 실패했으므로).
 * `success`/`injured`는 완수는 했으므로 `wealth`로 지급 여부를 판정한다. **wealth
 * 영구 공개는 후자, 즉 "판정에서 진 경우"에만 한다** — wealth가 관여하지 않은 사망의
 * 미지급까지 공개하면 "이 사람은 원래 못 준다"는 틀린 신호가 된다.
 *
 * 출처: `design/quick-specs/dispatch-resolution-2026-08-08.md` §4,
 * `design/quick-specs/contract-negotiation-2026-08-08.md` §5
 */
import type { DispatchOutcome, DispatchResult } from './dispatch';
import type { Rng } from './rng';
import type { Client } from './types';

/**
 * 경제 판정이 실제로 보는 의뢰인의 부분.
 *
 * `id`는 미지급 시 {@link WealthReveal}의 키가 되고, `wealth`는 잔금 지급 확률 그
 * 자체다. 나머지(`urgency`, `trust`, 성격 등)는 이 판정에 관여하지 않는다.
 */
export type EconomyClient = Pick<Client, 'id' | 'wealth'>;

/**
 * 경제 판정이 실제로 보는 파견 한 건의 부분.
 *
 * **`ActiveDispatch`에서 `Pick`으로 뽑지 않았다.** `remainingReward`는 지금
 * `ActiveDispatch`에 없는 필드다(선불만 실어 나르고 있다) — 통합 시 그 필드가
 * 추가되면 이 타입이 구조적으로 그대로 맞아떨어지게 설계했다. 지금 이 파일이
 * 독립적으로 컴파일되게 하는 것이 우선이었다.
 */
export interface EconomyDispatch {
  /** 협상 타결액(`agreedReward`)에서 선불(`advancePaid`)을 뺀 나머지. 0 이상이어야 한다 */
  readonly remainingReward: number;
  readonly contract: { readonly client: EconomyClient };
}

/** {@link EconomyDispatch}와 판정 결과를 묶은 것. `DayReport.resolved` 한 원소의 모양과 같다. */
export interface EconomyResolvedDispatch {
  readonly dispatch: EconomyDispatch;
  readonly result: Pick<DispatchResult, 'outcome'>;
}

/** 명성 판정에 필요한 수치. `balance.json`의 `dispatch` 절에서 온다 (파견 판정과 같은 절을 공유한다). */
export interface EconomyConfig {
  /** 성공 시 명성 증가분 */
  readonly repOnSuccess: number;
  /** 사망 시 명성 감소분. 양수로 받아 빼는 방향으로 쓴다 */
  readonly repOnDeath: number;
  /** 부상 시 성공분에 곱하는 배율. 부상해도 의뢰는 완수했다 */
  readonly repInjuryPenalty: number;
}

/**
 * 미지급으로 영구 공개되는 의뢰인의 실제 지불 여력.
 *
 * `clientId`가 키다. `PlayerKnowledge`에 이 쌍이 쌓이면 그 의뢰인은 다시 등장하지
 * 않더라도(MVP는 단골 계약을 넣지 않는다) **결과 대조 화면의 영구 기록**으로
 * 남아 "한 번 떼인 값"을 플레이어가 다시 확인할 수 있게 한다.
 */
export interface WealthReveal {
  readonly clientId: string;
  readonly wealth: number;
}

/** 파견 1건 판정의 결과. */
export interface DispatchSettlementResult {
  readonly funds: number;
  readonly reputation: number;
  /** 미지급이 발생했을 때만 존재한다 */
  readonly wealthRevealed?: WealthReveal;
}

/** 하루치 판정을 접은 결과. */
export interface DailyEconomyResult {
  readonly funds: number;
  readonly reputation: number;
  readonly wealthReveals: readonly WealthReveal[];
}

/**
 * 명성 스케일의 하한·상한. `balance.json`의 `scales.reputation`(0~100)을 코드로
 * 고정한 값이다. 튜닝 노브가 아니라 축 자체의 정의이므로 설정으로 받지 않는다 —
 * `negotiation.ts`가 `advanceRatio`의 0~1을 리터럴로 검사하는 것과 같은 종류다.
 */
const REPUTATION_FLOOR = 0;
const REPUTATION_CEILING = 100;

/** 자금 스케일의 하한. 위와 같은 이유로 리터럴이다. */
const FUNDS_FLOOR = 0;

/**
 * 계약 타결 시 선불액을 즉시 자금에 반영한다.
 *
 * 판정이 없다 — **선불로 받은 몫은 무조건 확정이다.** 이것이 선불 축이 정보 축으로
 * 성립하는 이유다: 사망해도, 잔금을 떼여도 선불만은 이미 지갑에 있다.
 *
 * @throws `advancePaid`가 음수일 때 — 선불은 지급이지 회수가 아니다
 */
export function receiveAdvance(funds: number, advancePaid: number): number {
  if (advancePaid < 0) {
    throw new Error(`선불액은 음수일 수 없다 (받은 값: ${advancePaid})`);
  }
  return applyFunds(funds, advancePaid);
}

/**
 * 파견 판정 결과 한 건을 경제에 반영한다.
 *
 * `dead`는 `wealth`를 묻지 않고 무조건 잔금 없음이다 — rng를 소비하지 않으므로
 * 같은 시드에서 앞뒤 판정 순서가 흔들리지 않는다. `success`/`injured`는
 * `rng.chance(client.wealth)`로 지급 여부를 굴린다: wealth가 낮을수록 자주 떼인다.
 *
 * @throws `client.wealth`가 0~1 밖일 때, `dispatch.remainingReward`가 음수일 때
 */
export function resolveDispatchSettlement(
  dispatch: EconomyDispatch,
  outcome: DispatchOutcome,
  funds: number,
  reputation: number,
  rng: Rng,
  config: EconomyConfig,
): DispatchSettlementResult {
  const newReputation = applyReputation(reputation, reputationDeltaFor(outcome, config));

  if (outcome === 'dead') {
    // 잔금은 없고, wealth는 이 판정에 관여하지 않았으므로 공개하지도 않는다.
    return { funds, reputation: newReputation };
  }

  const { client } = dispatch.contract;
  if (!(client.wealth >= 0 && client.wealth <= 1)) {
    throw new Error(`client.wealth는 0~1이어야 한다 (받은 값: ${client.wealth})`);
  }
  if (dispatch.remainingReward < 0) {
    throw new Error(`잔금은 음수일 수 없다 (받은 값: ${dispatch.remainingReward})`);
  }

  const paid = rng.chance(client.wealth);
  if (paid) {
    return { funds: applyFunds(funds, dispatch.remainingReward), reputation: newReputation };
  }

  // 여기서 진 것 — wealth를 판정의 근거로 실제로 썼으므로 영구 공개할 값이 있다.
  return {
    funds,
    reputation: newReputation,
    wealthRevealed: { clientId: client.id, wealth: client.wealth },
  };
}

/**
 * 하루치 `DayReport.resolved`를 접어서 자금·명성·미지급 공개를 한 번에 계산한다.
 *
 * `resolveDispatchSettlement`를 배열 순서대로 반복 적용한다 — 한 건의 결과가 다음
 * 건의 입력(누적된 자금·명성)이 된다. **호출 순서가 rng 소비 순서와 같아야
 * 재현성이 보장되므로, 배열 순서는 판정이 일어난 순서와 같아야 한다.**
 */
export function resolveDailyEconomy(
  resolved: readonly EconomyResolvedDispatch[],
  funds: number,
  reputation: number,
  rng: Rng,
  config: EconomyConfig,
): DailyEconomyResult {
  let currentFunds = funds;
  let currentReputation = reputation;
  const wealthReveals: WealthReveal[] = [];

  for (const { dispatch, result } of resolved) {
    const settled = resolveDispatchSettlement(
      dispatch,
      result.outcome,
      currentFunds,
      currentReputation,
      rng,
      config,
    );
    currentFunds = settled.funds;
    currentReputation = settled.reputation;
    if (settled.wealthRevealed !== undefined) {
      wealthReveals.push(settled.wealthRevealed);
    }
  }

  return { funds: currentFunds, reputation: currentReputation, wealthReveals };
}

/** 결과별 명성 증감. `success`는 +, `injured`는 완수 보정이 곱해진 +, `dead`는 -. */
function reputationDeltaFor(outcome: DispatchOutcome, config: EconomyConfig): number {
  switch (outcome) {
    case 'success':
      return config.repOnSuccess;
    case 'injured':
      return config.repOnSuccess * config.repInjuryPenalty;
    case 'dead':
      return -config.repOnDeath;
  }
}

/**
 * 자금에 증감을 적용하고 0 미만으로 내려가지 않게 한다.
 *
 * Story 015(영입비·확장비 지출)가 재사용할 것을 염두에 뒀다 — "지출은 잔액 확인 후에만
 * 가능"이 요구하는 하한이 바로 이 함수다.
 */
export function applyFunds(funds: number, delta: number): number {
  return Math.max(FUNDS_FLOOR, funds + delta);
}

/** 명성에 증감을 적용하고 0~100으로 클램프한다. */
export function applyReputation(reputation: number, delta: number): number {
  return Math.min(REPUTATION_CEILING, Math.max(REPUTATION_FLOOR, reputation + delta));
}
