/**
 * 명성·자금 경제.
 *
 * ## 왜 잔금 미지급이 있어야 하는가
 *
 * > 2026-08-09 개정 — 근거 소멸. 선불 축이 폐기되면서 "정보(=wealth를 아는가)를
 * > 현금 흐름 방어로 바꾼다"는 선불 축의 존재 이유가 사라졌다. `rng.chance(client.wealth)`
 * > 판정 경로를 통째로 제거했다 — 이제 `success`/`injured`는 무조건 전액 지급이고,
 * > 실패 경로는 결렬과 사망 둘로 정리됐다.
 * >
 * > 원문: 잔금 미지급이 없으면 "계약 타결 = 돈"이 되어 실패 경로가 결렬 하나뿐이 되고,
 * > 그러면 흥정의 선불 축을 자를 이유가 생긴다. 선불로 받아둔 몫이 사망·미지급에도
 * > 살아남기 때문에 선불 축은 "정보(=wealth를 아는가)를 현금 흐름 방어로 바꾸는" 축이
 * > 된다. `dispatch.ts`가 사람이 죽는 곳이라면, 이 모듈은 그 실패가 지갑에 닿는 곳이다.
 *
 * ## 판정은 순수 함수로, 적용은 호출자가
 *
 * `gameState.ts`의 관례를 그대로 따른다 — 이 파일은 "이만큼 변한다"만 계산해 돌려주고
 * `GameState`를 직접 바꾸지 않는다. `advanceDay`가 `DayReport.resolved`를 읽어 이
 * 모듈을 부르고 결과를 제자리에 반영하는 쪽이 호출자의 몫이다.
 *
 * ## dead의 미지급과 success/injured의 미지급은 다르다
 *
 * > 2026-08-09 개정 — 근거 소멸. `success`/`injured`에 더 이상 미지급 경로가 없으므로
 * > (전액 지급으로 고정) 이 절이 구분하던 두 종류의 "미지급"은 이제 하나(사망의
 * > 무지급)뿐이다.
 * >
 * > 원문: `dead`는 `wealth`와 무관하게 **무조건** 잔금이 없다(파견 자체가 실패했으므로).
 * > `success`/`injured`는 완수는 했으므로 `wealth`로 지급 여부를 판정한다. **wealth
 * > 영구 공개는 후자, 즉 "판정에서 진 경우"에만 한다** — wealth가 관여하지 않은 사망의
 * > 미지급까지 공개하면 "이 사람은 원래 못 준다"는 틀린 신호가 된다.
 *
 * 출처: `design/quick-specs/dispatch-resolution-2026-08-08.md` §4,
 * `design/quick-specs/contract-negotiation-2026-08-08.md` §5
 */
import type { DispatchOutcome, DispatchResult } from './dispatch';

/**
 * 경제 판정이 실제로 보는 파견 한 건의 부분.
 *
 * `agreedReward` 하나뿐이다. 잔금 미지급 판정이 사라지면서 경제 판정이 더 이상
 * 의뢰인을 보지 않는다 — `EconomyClient`가 사라진 이유이기도 하다. `ActiveDispatch`의
 * `agreedReward`와 이름이 같으므로 구조적으로 그대로 들어맞는다.
 */
export interface EconomyDispatch {
  /** 협상 타결액. `success`/`injured`면 전액 들어오고, `dead`면 무조건 못 받는다 */
  readonly agreedReward: number;
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

/** 파견 1건 판정의 결과. */
export interface DispatchSettlementResult {
  readonly funds: number;
  readonly reputation: number;
}

/** 하루치 판정을 접은 결과. */
export interface DailyEconomyResult {
  readonly funds: number;
  readonly reputation: number;
}

/**
 * 명성 스케일의 하한·상한. `balance.json`의 `scales.reputation`(0~100)을 코드로
 * 고정한 값이다. 튜닝 노브가 아니라 축 자체의 정의이므로 설정으로 받지 않는다.
 */
const REPUTATION_FLOOR = 0;
const REPUTATION_CEILING = 100;

/** 자금 스케일의 하한. 위와 같은 이유로 리터럴이다. */
const FUNDS_FLOOR = 0;

/**
 * 파견 판정 결과 한 건을 경제에 반영한다.
 *
 * `dead`는 무조건 무지급이다. `success`/`injured`는 무조건 전액 지급이다 — 잔금
 * 미지급 판정이 제거되면서 이 함수에 확률이 남지 않았으므로 `Rng`를 받지 않는다.
 *
 * @throws `dispatch.agreedReward`가 음수일 때
 */
export function resolveDispatchSettlement(
  dispatch: EconomyDispatch,
  outcome: DispatchOutcome,
  funds: number,
  reputation: number,
  config: EconomyConfig,
): DispatchSettlementResult {
  const newReputation = applyReputation(reputation, reputationDeltaFor(outcome, config));

  if (outcome === 'dead') {
    return { funds, reputation: newReputation };
  }

  if (dispatch.agreedReward < 0) {
    throw new Error(`타결액은 음수일 수 없다 (받은 값: ${dispatch.agreedReward})`);
  }

  return { funds: applyFunds(funds, dispatch.agreedReward), reputation: newReputation };
}

/**
 * 하루치 `DayReport.resolved`를 접어서 자금·명성을 한 번에 계산한다.
 *
 * `resolveDispatchSettlement`를 배열 순서대로 반복 적용한다 — 한 건의 결과가 다음
 * 건의 입력(누적된 자금·명성)이 된다.
 */
export function resolveDailyEconomy(
  resolved: readonly EconomyResolvedDispatch[],
  funds: number,
  reputation: number,
  config: EconomyConfig,
): DailyEconomyResult {
  let currentFunds = funds;
  let currentReputation = reputation;

  for (const { dispatch, result } of resolved) {
    const settled = resolveDispatchSettlement(
      dispatch,
      result.outcome,
      currentFunds,
      currentReputation,
      config,
    );
    currentFunds = settled.funds;
    currentReputation = settled.reputation;
  }

  return { funds: currentFunds, reputation: currentReputation };
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
