/**
 * 계약 협상 판정 — 보상 / 선불 / 위험 고지 세 축의 수용 여부.
 *
 * ## 왜 난수가 한 톨도 없는가
 *
 * **이 파일에 `Rng`가 등장하지 않는 것이 설계다.** 판정에 난수가 개입하면 아는 만큼
 * 정확히 예측할 수 없게 되고, 그러면 정보가 흥정력이 되지 못한다 — 이 게임의 핵심
 * 원리가 무너진다. 무작위는 "무엇이 오는가"와 "숨은 값이 무엇인가"에만 있고
 * (`contract.ts`), 그것을 읽어내는 판정은 완전히 결정론이다.
 *
 * 그래서 순수 함수다. 상태도 시간도 받지 않으므로 **결정론이 타입 수준에서 보장된다.**
 *
 * ## 세 축이 전부 정보 축이다
 *
 * | 축 | 어떤 숨은 정보가 답을 바꾸나 |
 * |---|---|
 * | 보상 | `wealth`, `urgency`, `hasAlternative` 셋 다 |
 * | 선불 | `wealth` — 떼일 것인가 |
 * | 위험 고지 | 실제 위험도 — **정보가 없으면 축 자체가 안 열린다** |
 *
 * 출처: `design/quick-specs/contract-negotiation-2026-08-08.md` §3–4
 */
import type { Client } from './types';

/**
 * 협상 판정이 실제로 보는 의뢰인의 부분.
 *
 * {@link Client} 전체를 받지 않는다. 판정은 숨은 상태 세 개만 읽으므로, 좁은 타입이
 * **"이름이나 성격은 흥정에 영향을 주지 않는다"는 사실을 타입으로 못박는다.** 덤으로
 * 테스트가 의뢰인 한 명을 통째로 조립하지 않아도 된다.
 */
export type NegotiationClient = Pick<Client, 'wealth' | 'urgency' | 'hasAlternative'>;

/** 거부당했을 때 의뢰인이 지목할 수 있는 축. 위험 고지는 부담이 아니므로 없다. */
export type NegotiationAxis = 'reward' | 'advance';

/** 플레이어가 내미는 조건. 세 축이 곧 세 필드다. */
export interface Offer {
  /** 기준 보상 대비 배율. `1.0`이 기준가이며 그 이하는 부담을 주지 않는다 */
  readonly rewardMultiplier: number;
  /** 보상의 몇 할을 선지급받을지. 0~1 */
  readonly advanceRatio: number;
  /**
   * 실제 위험을 계약서에 명시했는가.
   *
   * **켤 수 있는지 여부는 이 모듈이 판정하지 않는다** — 소문으로 실제 위험도를
   * 알아냈고 실제 > 공개일 때만 열린다는 규칙은 Story 011의 몫이다. 여기서는
   * 이미 정해진 값을 받기만 한다.
   */
  readonly discloseRisk: boolean;
}

/** 협상 판정에 필요한 수치. 전부 `balance.json`의 `negotiation` 절에서 온다. */
export interface NegotiationConfig {
  /** 보상 축의 가중치. 기준축이며 나머지 가중치는 이것 대비로 읽는다 */
  readonly wReward: number;
  /** 선불 축의 가중치. 현금 흐름은 총액보다 아프다 */
  readonly wAdvance: number;
  /** 정보 없이도 약간은 흥정되게 하는 하한 */
  readonly toleranceBase: number;
  readonly wealthWeight: number;
  readonly urgencyWeight: number;
  readonly alternativePenalty: number;
  /** 정보 1개의 현금 가치. **밸런싱 1순위 노브다** */
  readonly disclosureBonus: number;
  /** 결렬까지 허용되는 제안 횟수 */
  readonly maxOffers: number;
}

export type NegotiationOutcome =
  | 'accepted' // 타결
  | 'countered' // 거부하되 축 하나를 지목해 반박한다
  | 'broken'; // 결렬. 숨겨져 있던 진실은 영원히 밝혀지지 않는다

export interface NegotiationResult {
  readonly outcome: NegotiationOutcome;
  /** 제안이 의뢰인에게 지운 총 부담 */
  readonly burden: number;
  /** 이 의뢰인이 감내할 수 있는 한도 */
  readonly tolerance: number;
  /** 보상 축이 부담에 기여한 몫 */
  readonly rewardBurden: number;
  /** 선불 축이 부담에 기여한 몫 */
  readonly advanceBurden: number;
  /**
   * 의뢰인이 지목한 축. `'countered'`일 때만 존재한다.
   *
   * **이 반박 자체가 숨은 상태에 대한 정보다** ("선불은 도저히 안 되겠소" → 이 사람은
   * 자금이 없다). `urgency`와 `hasAlternative`를 소문으로 얻을 수 없게 만든 대신,
   * 흥정 과정이 그 정보 채널이 된다.
   */
  readonly contestedAxis?: NegotiationAxis;
}

/**
 * 제안 하나를 판정한다.
 *
 * 같은 인자면 언제나 같은 결과다 — 100번을 부르든 다른 날에 부르든 같다.
 *
 * @param offerNumber 이번이 몇 번째 제안인가 (1부터). `maxOffers`째 거부는 결렬이다
 * @throws `offerNumber`가 1 미만이거나 `advanceRatio`가 0~1 밖일 때
 */
export function evaluateOffer(
  offer: Offer,
  client: NegotiationClient,
  config: NegotiationConfig,
  offerNumber: number,
): NegotiationResult {
  if (!Number.isInteger(offerNumber) || offerNumber < 1) {
    throw new Error(`offerNumber는 1 이상의 정수여야 한다 (받은 값: ${offerNumber})`);
  }
  if (offer.advanceRatio < 0 || offer.advanceRatio > 1) {
    throw new Error(`선불 비율은 0~1이어야 한다 (받은 값: ${offer.advanceRatio})`);
  }

  // 기준가 이하를 부르는 것은 부담이 아니다. max(0, ...)이 그 뜻이다 —
  // 싸게 해준다고 의뢰인이 더 관대해지지는 않는다.
  const rewardBurden = config.wReward * Math.max(0, offer.rewardMultiplier - 1);
  const advanceBurden = config.wAdvance * offer.advanceRatio;
  const burden = rewardBurden + advanceBurden;

  const tolerance =
    config.toleranceBase +
    config.wealthWeight * client.wealth +
    config.urgencyWeight * client.urgency -
    (client.hasAlternative ? config.alternativePenalty : 0) +
    (offer.discloseRisk ? config.disclosureBonus : 0);

  const measured = { burden, tolerance, rewardBurden, advanceBurden };

  if (burden <= tolerance) {
    return { outcome: 'accepted', ...measured };
  }

  // 대안이 있는 의뢰인에게 위험을 알려주면 그냥 떠난다. 정직의 대가다 —
  // 고지가 허용치를 올려주고도 거부됐다면, 그는 이 위험한 일을 다른 길드에 맡긴다.
  if (client.hasAlternative && offer.discloseRisk) {
    return { outcome: 'broken', ...measured };
  }

  if (offerNumber >= config.maxOffers) {
    return { outcome: 'broken', ...measured };
  }

  return {
    outcome: 'countered',
    ...measured,
    contestedAxis: contestedAxisOf(rewardBurden, advanceBurden),
  };
}

/**
 * 기여도가 가장 큰 축을 고른다.
 *
 * 동점이면 보상 축을 지목한다. 자의적 선택이지만 **결정론이 요구사항이므로 어느 쪽이든
 * 고정되어야 한다.** 보상을 택한 이유는 그것이 기준축이고, 플레이어가 가장 먼저 손대는
 * 축이라 반박이 덜 뜬금없기 때문이다.
 */
function contestedAxisOf(rewardBurden: number, advanceBurden: number): NegotiationAxis {
  return rewardBurden >= advanceBurden ? 'reward' : 'advance';
}
