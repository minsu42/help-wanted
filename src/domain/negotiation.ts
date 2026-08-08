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
import type { Client, Contract, PlayerKnowledge } from './types';

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

// ─────────────────────────────────────────────────────────────────────────
// 위험 고지 축의 개폐 (Story 011)
//
// 이 축만 예외적이다 — 보상·선불은 정보 없이도 부를 수 있지만(불리할 뿐), 위험 고지는
// 정보 없이는 축 자체가 존재하지 않는다. "정보 = 흥정력"이 여기서 코드가 된다.
// ─────────────────────────────────────────────────────────────────────────

/**
 * 위험 고지 축의 개폐 판정에 필요한 계약의 부분.
 *
 * {@link Contract} 전체를 받지 않는 이유는 {@link NegotiationClient}와 같다 — 판정이
 * 실제로 읽는 값이 이 세 필드뿐이라는 사실을 타입으로 못박는다.
 */
export type DisclosureContract = Pick<Contract, 'id' | 'statedRisk' | 'realRisk'>;

/** 위험 고지 축의 개폐 판정에 필요한 플레이어 지식의 부분. */
export type DisclosureKnowledge = Pick<PlayerKnowledge, 'revealedFacts'>;

/**
 * 축이 닫혀 있을 때의 사유. **두 사유는 게임적으로 전혀 다른 신호다**:
 *
 * - `'unknownRisk'` — 정보가 없다. 소문을 캐러 가라는 신호.
 * - `'noGap'` — 사실은 알아냈지만 실제 위험도가 공개 위험도를 넘지 않는다. *"들은 그대로다,
 *   정직한 의뢰인이다"* — 이것도 정보다. 안심하고 진행해도 된다는 뜻이며, 세상에 정직한
 *   의뢰인이 섞여 있다는 것을 플레이어에게 가르친다.
 *
 * **표시 문구는 여기서 결정하지 않는다.** 도메인 계층은 한국어 UI 문구를 소유하지
 * 않는다 — 이 사유 코드를 받은 프레젠테이션 계층이 문구를 붙인다.
 */
export type DisclosureReason = 'unknownRisk' | 'noGap';

/**
 * {@link canDisclose}의 판정 결과. 판별 유니온이다 — `allowed`로 좁히면 `false` 분기에서만
 * `reason`이 존재한다.
 */
export type DisclosureGate =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: DisclosureReason };

/**
 * 위험 고지 축을 열 수 있는가.
 *
 * 두 조건이 **모두** 참이어야 연다:
 * ① 실제 위험도 사실(`` `${contract.id}:realRisk` ``)을 소문으로 얻었다
 * ② 실제 위험도가 공개 위험도보다 크다 — 숨긴 것이 있어야 고지할 것도 있다
 *
 * 게이트는 사실을 **얻었는지**만 보고 **어떤 값을 들었는지**는 보지 않는다 — `boastful`
 * 의뢰인이 왜곡해서 실제보다 낮은 값을 흘렸어도, 사실 자체는 얻었으므로 축은 열린다.
 * 왜곡은 흥정에서 플레이어가 무엇을 믿고 베팅하는지의 문제이지, 게이트가 열리고
 * 닫히는 문제가 아니다.
 *
 * `concealment`가 0인 정직한 의뢰인은 애초에 `realRisk === statedRisk`이므로, 사실을
 * 알아냈어도 이 함수는 `'noGap'`을 돌려준다 — 축은 열리지 않는다.
 */
export function canDisclose(
  contract: DisclosureContract,
  knowledge: DisclosureKnowledge,
): DisclosureGate {
  if (!knowledge.revealedFacts.has(`${contract.id}:realRisk`)) {
    return { allowed: false, reason: 'unknownRisk' };
  }
  if (contract.realRisk <= contract.statedRisk) {
    return { allowed: false, reason: 'noGap' };
  }
  return { allowed: true };
}

/**
 * 실제 위험을 알고도 고지하지 않은 채 타결했는가 — 침묵 표식.
 *
 * `ActiveDispatch.concealedKnownRisk`(Story 013이 trust 하락폭을 가르는 데 쓴다)에
 * 들어갈 값을 계산한다. **축이 열려 있지 않았다면 플레이어는 몰랐다는 뜻이므로 무조건
 * `false`다** — 몰라서 못 알려준 것과 알고도 숨긴 것은 다른 죄다.
 */
export function concealedKnownRisk(
  contract: DisclosureContract,
  knowledge: DisclosureKnowledge,
  disclosed: boolean,
): boolean {
  return canDisclose(contract, knowledge).allowed && !disclosed;
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
