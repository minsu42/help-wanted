/**
 * 파견 판정 — 사람이 죽는 곳.
 *
 * 이 게임에서 감정적으로 가장 무거운 시스템이고, MVP 핵심 가설
 * (*"플레이어는 모험가의 죽음을 자기 판단의 결과로 받아들인다"*)이 검증되는 곳이다.
 * "받아들인다"가 성립하려면 **죽음이 납득 가능해야 하고**, 그것이 아래 모든 결정을
 * 지배한다.
 *
 * ## 양 끝에 확정 구간이 있고 가운데만 도박이다
 *
 * 무작위 폭이 마진에 **반비례**한다. 여유 있게 보내면 확정 성공, 아슬아슬하면 도박,
 * 턱없이 모자라면 확정 사망이다.
 *
 * 완전 결정론이면 정보가 완벽할 때 아무도 죽지 않아 게임이 사라지고, 완전 무작위면
 * 판단이 무의미해진다. 마진에 연동하면 **플레이어는 자기가 아슬아슬하게 보냈다는 것을
 * 알고 있었으므로 죽어도 납득한다.**
 *
 * ## 실제 위험도만 본다
 *
 * 입력 타입이 {@link DispatchTarget}으로 좁혀져 있어 `statedRisk`에 손댈 수 없다.
 * 파견은 세상의 실제와 부딪히는 일이고, 의뢰인이 뭐라고 주장했는지는 결과를 바꾸지
 * 않는다. 그 비대칭이 "내가 알고도 보냈다"는 문장을 성립시킨다.
 *
 * ## 상태 전이는 여기서 하지 않는다
 *
 * 순수 함수로 남기기 위해 `onMission` / `injured` / `dead` 전이도, `trust`·`Memory`
 * 갱신도 하지 않는다. 호출자가 결과를 보고 적용한다.
 *
 * 출처: `design/quick-specs/dispatch-resolution-2026-08-08.md` §2–3
 */
import type { Rng } from './rng';
import type { Adventurer, Contract } from './types';
import { rollWeightedIndex } from './weighted';

/**
 * 파견 판정이 실제로 보는 의뢰의 부분.
 *
 * `statedRisk`가 **의도적으로 빠져 있다.** 공개 위험도는 배정 거부 판정(Story 008)이
 * 쓰는 값이지 결과 판정이 쓰는 값이 아니다. 타입이 그 경계를 지킨다.
 */
export type DispatchTarget = Pick<Contract, 'realRisk'>;

/** 파견 판정에 필요한 수치. 전부 `balance.json`의 `dispatch` 절에서 온다. */
export interface DispatchConfig {
  /** 성공 기준점 */
  readonly successRatio: number;
  /** 이 아래로 떨어지면 사망. **사망률 조절 1순위 노브다** */
  readonly injuryRatio: number;
  /** 도박 구간의 최대 폭 */
  readonly maxUncertainty: number;
  /** 확정 구간이 시작되는 거리. 마진이 이만큼 벌어지면 무작위가 사라진다 */
  readonly certaintyBand: number;
  /** 높을수록 약한 사람이 죽는다 */
  readonly casualtyBias: number;
}

export type DispatchOutcome = 'success' | 'injured' | 'dead';

export interface DispatchResult {
  readonly outcome: DispatchOutcome;
  /** 파티 역량 합 ÷ 실제 위험도. 1.0이 팽팽한 지점이다 */
  readonly ratio: number;
  /**
   * 이번 판정에 적용된 무작위 폭. 0이면 확정 구간이었다.
   *
   * **결과 대조 화면(Story 014)이 "얼마나 아슬아슬했는지"를 보여주는 유일한 근거다.**
   * 컨셉의 1순위 설계 리스크("창발이 무작위처럼 느껴짐")에 대한 최종 방어선이므로
   * 결과에서 빼지 말 것.
   */
  readonly uncertainty: number;
  /** 무작위가 적용된 뒤의 최종 비율. 이 값이 임계선과 비교됐다 */
  readonly effective: number;
  readonly partyCapability: number;
  readonly realRisk: number;
  /** 사상자의 id. `'injured'` / `'dead'`일 때만 존재한다 */
  readonly casualtyId?: string;
}

/**
 * 파견 결과를 판정한다.
 *
 * 같은 `rng` 시드 + 같은 파티 + 같은 의뢰면 언제나 같은 결과다.
 *
 * @throws 파티가 비었을 때, 실제 위험도가 0 이하일 때, 역량이 0 이하인 파티원이 있을 때
 */
export function resolveDispatch(
  party: readonly Adventurer[],
  contract: DispatchTarget,
  rng: Rng,
  config: DispatchConfig,
): DispatchResult {
  if (party.length === 0) {
    throw new Error('빈 파티는 파견할 수 없다');
  }
  if (!(contract.realRisk > 0)) {
    throw new Error(`실제 위험도는 0보다 커야 한다 (받은 값: ${contract.realRisk})`);
  }
  for (const member of party) {
    // 사상자 가중치가 1/역량^bias이므로 0 이하는 계산 자체가 성립하지 않는다.
    // balance.json이 15~90을 보장하므로, 0이 왔다면 다른 곳의 버그다. 크게 터뜨린다.
    if (!(member.capability > 0)) {
      throw new Error(`역량이 0 이하인 모험가는 파견할 수 없다 (${member.id}: ${member.capability})`);
    }
  }

  const partyCapability = party.reduce((sum, member) => sum + member.capability, 0);
  const ratio = partyCapability / contract.realRisk;

  // 마진이 벌어질수록 무작위가 줄고, certaintyBand에서 정확히 0이 된다.
  const distance = Math.abs(ratio - 1);
  const uncertainty = Math.max(0, config.maxUncertainty * (1 - distance / config.certaintyBand));

  // range는 반열린 구간이라 effective ∈ [ratio − u, ratio + u) 이다.
  // ratio == 1일 때 하한이 정확히 injuryRatio(0.75)에 닿고 그 값은 부상이므로,
  // "동률에서는 죽지 않는다"가 부등호 하나로 보장된다.
  const effective = uncertainty === 0 ? ratio : ratio + rng.range(-uncertainty, uncertainty);

  const outcome = outcomeOf(effective, config);
  const measured = { ratio, uncertainty, effective, partyCapability, realRisk: contract.realRisk };

  if (outcome === 'success') {
    return { outcome, ...measured };
  }

  return { outcome, ...measured, casualtyId: pickCasualty(rng, party, config.casualtyBias) };
}

function outcomeOf(effective: number, config: DispatchConfig): DispatchOutcome {
  if (effective >= config.successRatio) return 'success';
  if (effective >= config.injuryRatio) return 'injured';
  return 'dead';
}

/**
 * 사상자 한 명을 고른다. 역량이 낮을수록 뽑힐 확률이 높다 (`1 / 역량^casualtyBias`).
 *
 * *"보상이 좋아서 신입을 보냈다. 안 돌아왔다."* — MVP가 목표로 삼은 문장이 여기서
 * 나온다. 동시에 베테랑을 섞으면 그가 방패가 되므로 **아끼는 사람을 지키려면 그를
 * 보내야 하는** 뒤틀린 선택이 생기고, 베테랑을 보내면 정보망 전체를 거는 셈이 된다.
 *
 * MVP는 사상자를 1명만 낸다.
 */
function pickCasualty(rng: Rng, party: readonly Adventurer[], bias: number): string {
  const weights = party.map((member) => 1 / Math.pow(member.capability, bias));
  return party[rollWeightedIndex(rng, weights)].id;
}
