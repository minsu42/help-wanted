import { describe, expect, it } from "vitest";
import balance from "../../../src/data/balance.json";
import {
  evaluateOffer,
  type NegotiationClient,
  type NegotiationConfig,
  type Offer,
} from "../../../src/domain/negotiation";

/** 설정은 balance.json에서 조립한다 — 테스트가 곧 "수치가 파일에서 온다"의 증거다. */
const CONFIG: NegotiationConfig = {
  wReward: balance.negotiation.wReward,
  wAdvance: balance.negotiation.wAdvance,
  toleranceBase: balance.negotiation.toleranceBase,
  wealthWeight: balance.negotiation.wealthWeight,
  urgencyWeight: balance.negotiation.urgencyWeight,
  alternativePenalty: balance.negotiation.alternativePenalty,
  disclosureBonus: balance.negotiation.disclosureBonus,
  maxOffers: balance.negotiation.maxOffers,
};

/** 숨은 상태가 전부 중간값인 기준 의뢰인. 각 테스트가 필요한 축만 덮어쓴다. */
const BASELINE: NegotiationClient = {
  wealth: 0.5,
  urgency: 0.5,
  hasAlternative: false,
};

/** 부담이 0인 기준 제안 — 기준가, 선불 없음, 고지 없음. */
const NEUTRAL_OFFER: Offer = {
  rewardMultiplier: 1,
  advanceRatio: 0,
  discloseRisk: false,
};

const FIRST_OFFER = 1;
const FINAL_OFFER = balance.negotiation.maxOffers;

function client(overrides: Partial<NegotiationClient> = {}): NegotiationClient {
  return { ...BASELINE, ...overrides };
}

function offer(overrides: Partial<Offer> = {}): Offer {
  return { ...NEUTRAL_OFFER, ...overrides };
}

/**
 * 이 의뢰인이 수락하는 보상배율의 상한을 이분탐색으로 찾는다.
 * "더 큰 burden을 받아준다"를 직접 재는 것이 단조성 테스트의 요점이다.
 */
function maxAcceptedRewardMultiplier(target: NegotiationClient, base: Offer = NEUTRAL_OFFER) {
  let low = 1;
  let high = 100;
  for (let step = 0; step < 60; step += 1) {
    const mid = (low + high) / 2;
    const accepted =
      evaluateOffer({ ...base, rewardMultiplier: mid }, target, CONFIG, FIRST_OFFER).outcome ===
      "accepted";
    if (accepted) low = mid;
    else high = mid;
  }
  return low;
}

describe("evaluateOffer", () => {
  it("test_identical_inputs_always_produce_identical_result", () => {
    // Arrange — 결정론이 이 시스템의 존재 이유다. 난수가 들어가면 정보가 흥정력을 잃는다.
    const proposal = offer({ rewardMultiplier: 1.4, advanceRatio: 0.3 });
    const target = client({ wealth: 0.7, urgency: 0.2, hasAlternative: true });

    // Act
    const first = evaluateOffer(proposal, target, CONFIG, FIRST_OFFER);

    // Assert
    for (let call = 0; call < 100; call += 1) {
      expect(evaluateOffer(proposal, target, CONFIG, FIRST_OFFER)).toEqual(first);
    }
  });

  it("test_burden_matches_the_specified_formula", () => {
    const proposal = offer({ rewardMultiplier: 1.5, advanceRatio: 0.4 });

    const result = evaluateOffer(proposal, client(), CONFIG, FIRST_OFFER);

    expect(result.rewardBurden).toBeCloseTo(CONFIG.wReward * 0.5, 10);
    expect(result.advanceBurden).toBeCloseTo(CONFIG.wAdvance * 0.4, 10);
    expect(result.burden).toBeCloseTo(result.rewardBurden + result.advanceBurden, 10);
  });

  it("test_tolerance_matches_the_specified_formula", () => {
    const target = client({ wealth: 0.3, urgency: 0.8 });

    const result = evaluateOffer(offer(), target, CONFIG, FIRST_OFFER);

    expect(result.tolerance).toBeCloseTo(
      CONFIG.toleranceBase + CONFIG.wealthWeight * 0.3 + CONFIG.urgencyWeight * 0.8,
      10,
    );
  });

  it("test_reward_below_base_price_adds_no_burden", () => {
    // 싸게 해준다고 의뢰인이 더 관대해지지는 않는다 — max(0, ...)의 뜻
    const generous = evaluateOffer(offer({ rewardMultiplier: 0.5 }), client(), CONFIG, FIRST_OFFER);
    const neutral = evaluateOffer(offer({ rewardMultiplier: 1 }), client(), CONFIG, FIRST_OFFER);

    expect(generous.rewardBurden).toBe(0);
    expect(generous.burden).toBe(neutral.burden);
  });

  it("test_offer_within_tolerance_is_accepted", () => {
    const target = client({ wealth: 1, urgency: 1 });

    const result = evaluateOffer(offer(), target, CONFIG, FIRST_OFFER);

    expect(result.outcome).toBe("accepted");
    expect(result.burden).toBeLessThanOrEqual(result.tolerance);
  });

  it("test_offer_exactly_at_tolerance_is_accepted", () => {
    // 경계는 수락 쪽이다 (burden ≤ tolerance). 부등호가 뒤집히면 밸런싱 감각이 달라진다.
    const target = client({ wealth: 0, urgency: 0 });
    const exact = CONFIG.toleranceBase / CONFIG.wAdvance;

    const result = evaluateOffer(offer({ advanceRatio: exact }), target, CONFIG, FIRST_OFFER);

    expect(result.burden).toBeCloseTo(result.tolerance, 10);
    expect(result.outcome).toBe("accepted");
  });

  it("test_higher_urgency_accepts_a_larger_burden", () => {
    // 급박함이 가장 큰 지렛대여야 흥정이 재밌다
    const calm = maxAcceptedRewardMultiplier(client({ urgency: 0.2 }));
    const hurried = maxAcceptedRewardMultiplier(client({ urgency: 0.8 }));

    expect(hurried).toBeGreaterThan(calm);
  });

  it("test_urgency_extremes_differ_by_exactly_the_configured_weight", () => {
    const none = evaluateOffer(offer(), client({ urgency: 0 }), CONFIG, FIRST_OFFER);
    const full = evaluateOffer(offer(), client({ urgency: 1 }), CONFIG, FIRST_OFFER);

    expect(full.tolerance - none.tolerance).toBeCloseTo(CONFIG.urgencyWeight, 10);
  });

  it("test_higher_wealth_accepts_a_larger_burden", () => {
    const poor = maxAcceptedRewardMultiplier(client({ wealth: 0.1 }));
    const rich = maxAcceptedRewardMultiplier(client({ wealth: 0.9 }));

    expect(rich).toBeGreaterThan(poor);
  });

  it("test_client_with_alternative_accepts_less", () => {
    const captive = maxAcceptedRewardMultiplier(client({ hasAlternative: false }));
    const free = maxAcceptedRewardMultiplier(client({ hasAlternative: true }));

    expect(free).toBeLessThan(captive);
  });

  it("test_alternative_penalty_is_exactly_the_configured_amount", () => {
    const captive = evaluateOffer(offer(), client({ hasAlternative: false }), CONFIG, FIRST_OFFER);
    const free = evaluateOffer(offer(), client({ hasAlternative: true }), CONFIG, FIRST_OFFER);

    expect(captive.tolerance - free.tolerance).toBeCloseTo(CONFIG.alternativePenalty, 10);
  });

  it("test_disclosure_widens_tolerance_by_exactly_the_bonus", () => {
    // 정보 1개의 현금 가치 — 밸런싱 1순위 노브
    const silent = evaluateOffer(offer({ discloseRisk: false }), client(), CONFIG, FIRST_OFFER);
    const disclosed = evaluateOffer(offer({ discloseRisk: true }), client(), CONFIG, FIRST_OFFER);

    expect(disclosed.tolerance - silent.tolerance).toBeCloseTo(CONFIG.disclosureBonus, 10);
  });

  it("test_disclosure_can_turn_a_rejection_into_a_deal", () => {
    // Arrange — 고지 없이는 거부되지만 보너스를 얹으면 통과하는 지점
    const target = client({ wealth: 0.2, urgency: 0.2 });
    const base = CONFIG.toleranceBase + CONFIG.wealthWeight * 0.2 + CONFIG.urgencyWeight * 0.2;
    const justOver = (base + CONFIG.disclosureBonus / 2) / CONFIG.wAdvance;
    const proposal = offer({ advanceRatio: Math.min(1, justOver) });

    // Act
    const silent = evaluateOffer(proposal, target, CONFIG, FIRST_OFFER);
    const disclosed = evaluateOffer({ ...proposal, discloseRisk: true }, target, CONFIG, FIRST_OFFER);

    // Assert — 이것이 "정보 = 흥정력"의 가장 직접적인 발현이다
    expect(silent.outcome).not.toBe("accepted");
    expect(disclosed.outcome).toBe("accepted");
  });

  it("test_rejected_first_offer_contests_the_dominant_axis", () => {
    // Given: 보상배율 1.0 + 선불 0.9 → 선불 기여도가 압도적
    const proposal = offer({ rewardMultiplier: 1, advanceRatio: 0.9 });
    const target = client({ wealth: 0, urgency: 0 });

    const result = evaluateOffer(proposal, target, CONFIG, FIRST_OFFER);

    expect(result.outcome).toBe("countered");
    expect(result.contestedAxis).toBe("advance");
  });

  it("test_rejected_first_offer_contests_reward_when_reward_dominates", () => {
    const proposal = offer({ rewardMultiplier: 4, advanceRatio: 0.05 });
    const target = client({ wealth: 0, urgency: 0 });

    const result = evaluateOffer(proposal, target, CONFIG, FIRST_OFFER);

    expect(result.outcome).toBe("countered");
    expect(result.contestedAxis).toBe("reward");
  });

  it("test_contested_axis_is_stable_when_contributions_tie", () => {
    // 동점에서 흔들리면 결정론이 깨진다. 어느 쪽이든 고정이어야 한다.
    // 선불을 최대로 밀고, 보상 축이 그와 같은 기여를 내도록 배율을 역산한다.
    const tiedMultiplier = 1 + CONFIG.wAdvance / CONFIG.wReward;
    const proposal = offer({ rewardMultiplier: tiedMultiplier, advanceRatio: 1 });
    const target = client({ wealth: 0, urgency: 0 });

    const result = evaluateOffer(proposal, target, CONFIG, FIRST_OFFER);

    expect(result.rewardBurden).toBeCloseTo(result.advanceBurden, 10);
    expect(result.contestedAxis).toBe("reward");
  });

  it("test_accepted_offer_names_no_contested_axis", () => {
    const result = evaluateOffer(offer(), client({ wealth: 1, urgency: 1 }), CONFIG, FIRST_OFFER);

    expect(result.outcome).toBe("accepted");
    expect(result.contestedAxis).toBeUndefined();
  });

  it("test_rejection_on_the_final_offer_breaks_off", () => {
    const proposal = offer({ rewardMultiplier: 5 });
    const target = client({ wealth: 0, urgency: 0 });

    const result = evaluateOffer(proposal, target, CONFIG, FINAL_OFFER);

    expect(result.outcome).toBe("broken");
    expect(result.contestedAxis).toBeUndefined();
  });

  it("test_client_with_alternative_walks_away_immediately_when_disclosure_is_rejected", () => {
    // 대안이 있는 의뢰인에게 위험을 알려주고 거부당하면 반박 없이 떠난다 — 정직의 대가
    const proposal = offer({ rewardMultiplier: 9, discloseRisk: true });
    const target = client({ wealth: 0, urgency: 0, hasAlternative: true });

    const result = evaluateOffer(proposal, target, CONFIG, FIRST_OFFER);

    expect(result.outcome).toBe("broken");
    expect(result.contestedAxis).toBeUndefined();
  });

  it("test_client_without_alternative_still_counters_when_disclosure_is_rejected", () => {
    // 떠날 곳이 없으면 고지를 듣고도 협상을 이어간다
    const proposal = offer({ rewardMultiplier: 9, discloseRisk: true });
    const target = client({ wealth: 0, urgency: 0, hasAlternative: false });

    const result = evaluateOffer(proposal, target, CONFIG, FIRST_OFFER);

    expect(result.outcome).toBe("countered");
  });

  it("test_client_with_alternative_counters_normally_without_disclosure", () => {
    // 즉시 결렬은 고지를 켰을 때만이다
    const proposal = offer({ rewardMultiplier: 9, discloseRisk: false });
    const target = client({ wealth: 0, urgency: 0, hasAlternative: true });

    const result = evaluateOffer(proposal, target, CONFIG, FIRST_OFFER);

    expect(result.outcome).toBe("countered");
  });

  it("test_disclosure_still_wins_the_deal_for_a_client_with_alternative", () => {
    // 즉시 결렬은 '거부됐을 때'의 규칙이다. 수용 범위 안이면 고지가 계약을 살린다.
    const target = client({ wealth: 0.9, urgency: 0.9, hasAlternative: true });

    const result = evaluateOffer(offer({ discloseRisk: true }), target, CONFIG, FIRST_OFFER);

    expect(result.outcome).toBe("accepted");
  });

  it("test_invalid_offer_number_throws", () => {
    expect(() => evaluateOffer(offer(), client(), CONFIG, 0)).toThrow(/offerNumber/);
    expect(() => evaluateOffer(offer(), client(), CONFIG, -1)).toThrow(/offerNumber/);
    expect(() => evaluateOffer(offer(), client(), CONFIG, 1.5)).toThrow(/offerNumber/);
  });

  it("test_advance_ratio_outside_unit_interval_throws", () => {
    expect(() => evaluateOffer(offer({ advanceRatio: -0.1 }), client(), CONFIG, 1)).toThrow(
      /선불 비율/,
    );
    expect(() => evaluateOffer(offer({ advanceRatio: 1.1 }), client(), CONFIG, 1)).toThrow(
      /선불 비율/,
    );
  });

  it("test_max_offers_is_read_from_config_not_hardcoded", () => {
    // 두 상한을 **테스트 안에서** 만든다. balance.json의 현재 값을 한쪽으로 쓰면
    // 밸런싱으로 그 값이 바뀌는 순간 대비가 사라져 테스트가 아무것도 검증하지 않는다.
    const impatient: NegotiationConfig = { ...CONFIG, maxOffers: 2 };
    const patient: NegotiationConfig = { ...CONFIG, maxOffers: 3 };
    const proposal = offer({ rewardMultiplier: 5 });
    const target = client({ wealth: 0, urgency: 0 });

    expect(evaluateOffer(proposal, target, impatient, 2).outcome).toBe("broken");
    expect(evaluateOffer(proposal, target, patient, 2).outcome).toBe("countered");
  });
});
