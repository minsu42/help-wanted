import { describe, expect, it } from "vitest";
import balance from "../../../src/data/balance.json";
import {
  discoveredContactKey,
  resolveTalk,
  type RevealedFact,
  type RumorConfig,
  type RumorContract,
  type RumorTalker,
} from "../../../src/domain/rumor";
import { createRng } from "../../../src/domain/rng";
import type { Trait } from "../../../src/domain/types";

/** 설정은 balance.json에서 조립한다 — 테스트가 곧 "수치가 파일에서 온다"의 증거다. */
const CONFIG: RumorConfig = {
  trustThresholdDefault: balance.rumor.trustThresholdDefault,
  trustThresholdCautious: balance.rumor.trustThresholdCautious,
  trustThresholdLoyal: balance.rumor.trustThresholdLoyal,
  traitDistortion: balance.rumor.traitDistortion,
  greedyPrice: balance.rumor.greedyPrice,
};

/** 신뢰가 항상 모든 임계값을 넘는 값. "이 사람이 알기만 하면 무조건 말한다"를 만들 때 쓴다. */
const HIGH_TRUST = 1.0;

function talker(id: string, traits: readonly [Trait, Trait], trust: number): RumorTalker {
  return { id, traits, trust };
}

/** 사실 2개(realRisk, realWealth)가 심긴, 특정 사람들이 아는 의뢰. */
function contractKnownBy(knownBy: readonly string[], realRisk = 100, wealth = 0.5): RumorContract {
  return {
    realRisk,
    client: { id: "client-a", knownBy, wealth },
    facts: [
      { id: "ct-0:realRisk", contractId: "ct-0", kind: "realRisk" },
      { id: "ct-0:realWealth", contractId: "ct-0", kind: "realWealth" },
    ],
  };
}

function factIdsOf(revealed: readonly RevealedFact[]): string[] {
  return revealed.map((fact) => fact.factId);
}

describe("resolveTalk", () => {
  // --- AC 3 (spec) / story-009 QA "knownBy 밖은 침묵" ---
  it("test_person_outside_known_by_never_reveals_facts_even_with_full_trust", () => {
    // Arrange — 신뢰 1.0이어도 이 의뢰인의 knownBy에는 없다
    const outsider = talker("adv-outsider", ["talkative", "loyal"], HIGH_TRUST);
    const contract = contractKnownBy(["adv-someone-else"]);

    // Act
    const result = resolveTalk(outsider, [contract], createRng(1), CONFIG);

    // Assert — 사실은 물론, 인맥 기록도 없다 (이 사람은 이 의뢰인을 모른다)
    expect(result.revealedFacts).toEqual([]);
    expect(result.discoveredContactKeys).toEqual([]);
  });

  // --- AC 8 (spec) / story-009 "discoveredContacts는 신뢰 무관" ---
  it("test_contact_discovery_is_recorded_regardless_of_trust_or_traits", () => {
    // Arrange — 신뢰 0, cautious(임계값 가장 높음)라 사실은 절대 안 나올 사람
    const stranger = talker("adv-stranger", ["cautious", "bitter"], 0);
    const contract = contractKnownBy(["adv-stranger"]);

    // Act
    const result = resolveTalk(stranger, [contract], createRng(1), CONFIG);

    // Assert — ①은 열렸다, ②는 막혔다
    expect(result.discoveredContactKeys).toEqual([
      discoveredContactKey("adv-stranger", "client-a"),
    ]);
    expect(result.revealedFacts).toEqual([]);
  });

  it("test_discovered_contact_key_matches_the_documented_format", () => {
    expect(discoveredContactKey("adv-1", "client-a")).toBe("adv-1->client-a");
  });

  // --- AC 4 (spec) / story-009 "성격별 임계값" ---
  describe("성격별 신뢰 임계값", () => {
    const TRUST = 0.5; // default(0.4) 통과, cautious(0.6) 미달, loyal(0.2) 통과

    it("test_cautious_stays_silent_below_its_higher_threshold", () => {
      const person = talker("adv-cautious", ["cautious", "talkative"], TRUST);
      const contract = contractKnownBy([person.id]);

      const result = resolveTalk(person, [contract], createRng(1), CONFIG);

      expect(result.revealedFacts).toEqual([]);
    });

    it("test_default_trait_speaks_at_the_same_trust_that_silences_cautious", () => {
      // cautious/loyal 어느 쪽도 아닌 사람 — default(0.4) 임계값만 걸린다.
      // greedy 같은 별도 게이트가 섞이면 이 테스트의 의도가 흐려지므로 피한다.
      const person = talker("adv-default", ["talkative", "talkative"], TRUST);
      const contract = contractKnownBy([person.id]);

      const result = resolveTalk(person, [contract], createRng(1), CONFIG);

      expect(result.revealedFacts.length).toBeGreaterThan(0);
    });

    it("test_loyal_speaks_below_the_default_threshold", () => {
      const person = talker("adv-loyal", ["loyal", "talkative"], TRUST);
      const contract = contractKnownBy([person.id]);

      const result = resolveTalk(person, [contract], createRng(1), CONFIG);

      expect(result.revealedFacts.length).toBeGreaterThan(0);
    });

    it("test_trust_exactly_at_threshold_still_speaks", () => {
      // Edge: 임계값과 정확히 같으면 말한다 (>=)
      const person = talker("adv-exact", ["cautious", "talkative"], CONFIG.trustThresholdCautious);
      const contract = contractKnownBy([person.id]);

      const result = resolveTalk(person, [contract], createRng(1), CONFIG);

      expect(result.revealedFacts.length).toBeGreaterThan(0);
    });

    it("test_trust_just_below_threshold_stays_silent", () => {
      const person = talker(
        "adv-just-under",
        ["cautious", "talkative"],
        CONFIG.trustThresholdCautious - 0.001,
      );
      const contract = contractKnownBy([person.id]);

      const result = resolveTalk(person, [contract], createRng(1), CONFIG);

      expect(result.revealedFacts).toEqual([]);
    });
  });

  // --- AC 6 (spec) / story-009 "왜곡 방향" ---
  it("test_bitter_overstates_and_boastful_understates_real_risk", () => {
    // Arrange — 실제 위험도 100, traitDistortion 0.15
    const bitter = talker("adv-bitter", ["bitter", "talkative"], HIGH_TRUST);
    const boastful = talker("adv-boastful", ["boastful", "talkative"], HIGH_TRUST);
    const contract = (id: string) => contractKnownBy([id], 100);

    // Act
    const bitterResult = resolveTalk(bitter, [contract(bitter.id)], createRng(1), CONFIG);
    const boastfulResult = resolveTalk(boastful, [contract(boastful.id)], createRng(1), CONFIG);

    const bitterRisk = bitterResult.revealedFacts.find((fact) => fact.kind === "realRisk")!;
    const boastfulRisk = boastfulResult.revealedFacts.find((fact) => fact.kind === "realRisk")!;

    // Assert — bitter 115 > 실제 100 > boastful 85
    expect(bitterRisk.statedValue).toBeCloseTo(115, 10);
    expect(boastfulRisk.statedValue).toBeCloseTo(85, 10);
    expect(bitterRisk.statedValue).toBeGreaterThan(100);
    expect(boastfulRisk.statedValue).toBeLessThan(100);
  });

  it("test_distortion_never_touches_the_stored_actual_value", () => {
    const boastful = talker("adv-boastful", ["boastful", "talkative"], HIGH_TRUST);
    const contract = contractKnownBy([boastful.id], 100);

    const result = resolveTalk(boastful, [contract], createRng(1), CONFIG);

    const risk = result.revealedFacts.find((fact) => fact.kind === "realRisk")!;
    expect(risk.actualValue).toBe(100);
  });

  it("test_real_wealth_facts_are_never_distorted", () => {
    // 스펙 §5의 왜곡 규칙은 "위험도"만 가리킨다 — 지불 여력은 항상 진짜 값 그대로다
    const bitter = talker("adv-bitter", ["bitter", "talkative"], HIGH_TRUST);
    const contract = contractKnownBy([bitter.id], 100, 0.7);

    const result = resolveTalk(bitter, [contract], createRng(1), CONFIG);

    const wealth = result.revealedFacts.find((fact) => fact.kind === "realWealth")!;
    expect(wealth.statedValue).toBe(0.7);
    expect(wealth.actualValue).toBe(0.7);
  });

  // --- AC 7 (spec) / story-009 "왜곡이 게이트를 막지 않음" ---
  it("test_boastful_distortion_does_not_block_the_disclosure_gate", () => {
    // boastful에게서 realRisk를 얻으면, 표시값이 낮아도 사실 id는 그대로 들어간다
    const boastful = talker("adv-boastful", ["boastful", "talkative"], HIGH_TRUST);
    const contract = contractKnownBy([boastful.id], 100);

    const result = resolveTalk(boastful, [contract], createRng(1), CONFIG);

    expect(factIdsOf(result.revealedFacts)).toContain("ct-0:realRisk");
  });

  // --- AC 5 (spec) / story-009 "talkative 개수" ---
  it("test_talkative_reveals_two_facts_when_two_are_known", () => {
    const person = talker("adv-talkative", ["talkative", "loyal"], HIGH_TRUST);
    const contract = contractKnownBy([person.id]); // realRisk + realWealth 2개

    const result = resolveTalk(person, [contract], createRng(1), CONFIG);

    expect(result.revealedFacts).toHaveLength(2);
    expect(factIdsOf(result.revealedFacts).sort()).toEqual([
      "ct-0:realRisk",
      "ct-0:realWealth",
    ]);
  });

  it("test_non_talkative_reveals_only_one_fact_even_when_two_are_known", () => {
    const person = talker("adv-quiet", ["loyal", "bitter"], HIGH_TRUST);
    const contract = contractKnownBy([person.id]);

    const result = resolveTalk(person, [contract], createRng(1), CONFIG);

    expect(result.revealedFacts).toHaveLength(1);
  });

  it("test_reveal_count_is_capped_by_available_candidates", () => {
    // talkative라도 아는 사실이 1개뿐이면 1개만 나온다
    const person = talker("adv-talkative", ["talkative", "loyal"], HIGH_TRUST);
    const contract: RumorContract = {
      realRisk: 100,
      client: { id: "client-a", knownBy: [person.id], wealth: 0.5 },
      facts: [{ id: "ct-0:realRisk", contractId: "ct-0", kind: "realRisk" }],
    };

    const result = resolveTalk(person, [contract], createRng(1), CONFIG);

    expect(result.revealedFacts).toHaveLength(1);
  });

  // --- greedy 게이트 ---
  describe("greedy", () => {
    it("test_greedy_stays_silent_when_price_is_refused", () => {
      const person = talker("adv-greedy", ["greedy", "talkative"], HIGH_TRUST);
      const contract = contractKnownBy([person.id]);

      const result = resolveTalk(person, [contract], createRng(1), CONFIG, {
        payGreedyPrice: false,
      });

      expect(result.revealedFacts).toEqual([]);
      expect(result.greedyPriceCharged).toBeUndefined();
    });

    it("test_greedy_speaks_and_charges_when_price_is_paid", () => {
      const person = talker("adv-greedy", ["greedy", "talkative"], HIGH_TRUST);
      const contract = contractKnownBy([person.id]);

      const result = resolveTalk(person, [contract], createRng(1), CONFIG, {
        payGreedyPrice: true,
      });

      expect(result.revealedFacts.length).toBeGreaterThan(0);
      expect(result.greedyPriceCharged).toBe(balance.rumor.greedyPrice);
    });

    it("test_greedy_contact_discovery_is_unaffected_by_refusal", () => {
      // ①은 성격·지불과 무관하다 — greedy가 거절해도 인맥은 밝혀진다
      const person = talker("adv-greedy", ["greedy", "talkative"], HIGH_TRUST);
      const contract = contractKnownBy([person.id]);

      const result = resolveTalk(person, [contract], createRng(1), CONFIG, {
        payGreedyPrice: false,
      });

      expect(result.discoveredContactKeys).toEqual([
        discoveredContactKey(person.id, "client-a"),
      ]);
    });

    it("test_paying_price_does_not_bypass_the_trust_gate", () => {
      // 값을 냈어도 신뢰가 cautious 임계값에 못 미치면 여전히 침묵한다
      const person = talker("adv-greedy-cautious", ["greedy", "cautious"], 0);
      const contract = contractKnownBy([person.id]);

      const result = resolveTalk(person, [contract], createRng(1), CONFIG, {
        payGreedyPrice: true,
      });

      expect(result.revealedFacts).toEqual([]);
    });

    it("test_distrusting_greedy_person_does_not_take_the_money", () => {
      // 신뢰 게이트가 값 게이트보다 **먼저**다. 값을 치르고 침묵을 사는 일은 없어야 한다 —
      // 플레이어는 신뢰 수치를 볼 수 없으므로 그것이 이유 없는 손실로 보인다.
      const person = talker("adv-greedy-cautious", ["greedy", "cautious"], 0);
      const contract = contractKnownBy([person.id]);

      const result = resolveTalk(person, [contract], createRng(1), CONFIG, {
        payGreedyPrice: true,
      });

      expect(result.greedyPriceCharged).toBeUndefined();
    });

    it("test_greedy_person_who_trusts_you_does_take_the_money", () => {
      // 뒤집으면 "값을 요구한다 = 신뢰는 충분하다"가 읽을 수 있는 신호가 된다
      const person = talker("adv-greedy", ["greedy", "talkative"], 1);
      const contract = contractKnownBy([person.id]);

      const result = resolveTalk(person, [contract], createRng(1), CONFIG, {
        payGreedyPrice: true,
      });

      expect(result.greedyPriceCharged).toBe(balance.rumor.greedyPrice);
      expect(result.revealedFacts.length).toBeGreaterThan(0);
    });

    it("test_paying_price_has_no_effect_on_non_greedy_people", () => {
      const person = talker("adv-generous", ["loyal", "talkative"], HIGH_TRUST);
      const contract = contractKnownBy([person.id]);

      const result = resolveTalk(person, [contract], createRng(1), CONFIG, {
        payGreedyPrice: true,
      });

      expect(result.greedyPriceCharged).toBeUndefined();
    });
  });

  // --- 누가 말했는지 ---
  it("test_revealed_fact_records_the_teller_id", () => {
    const person = talker("adv-teller", ["talkative", "loyal"], HIGH_TRUST);
    const contract = contractKnownBy([person.id]);

    const result = resolveTalk(person, [contract], createRng(1), CONFIG);

    expect(result.revealedFacts.every((fact) => fact.tellerId === person.id)).toBe(true);
  });

  // --- 결정론 ---
  it("test_same_seed_and_inputs_reveal_the_same_facts_and_values", () => {
    const person = talker("adv-det", ["bitter", "talkative"], HIGH_TRUST);
    const contracts = [contractKnownBy([person.id], 120), { ...contractKnownBy([], 50) }];

    const first = resolveTalk(person, contracts, createRng(42), CONFIG);
    const second = resolveTalk(person, contracts, createRng(42), CONFIG);

    expect(second).toEqual(first);
  });

  it("test_non_talkative_pick_among_several_candidates_is_deterministic", () => {
    // 후보가 revealCount보다 많을 때 rng로 고른다 — 시드가 같으면 선택도 같아야 한다
    const person = talker("adv-pick", ["loyal", "bitter"], HIGH_TRUST);
    const contractA: RumorContract = {
      realRisk: 80,
      client: { id: "client-a", knownBy: [person.id], wealth: 0.2 },
      facts: [{ id: "ct-a:realRisk", contractId: "ct-a", kind: "realRisk" }],
    };
    const contractB: RumorContract = {
      realRisk: 90,
      client: { id: "client-b", knownBy: [person.id], wealth: 0.3 },
      facts: [{ id: "ct-b:realRisk", contractId: "ct-b", kind: "realRisk" }],
    };

    const first = resolveTalk(person, [contractA, contractB], createRng(9), CONFIG);
    const second = resolveTalk(person, [contractA, contractB], createRng(9), CONFIG);

    expect(first.revealedFacts).toHaveLength(1);
    expect(second.revealedFacts).toEqual(first.revealedFacts);
  });

  // --- 노브가 balance.json에서 읽히는지 (회귀) ---
  it("test_trait_distortion_knob_controls_the_distortion_magnitude", () => {
    const bitter = talker("adv-bitter", ["bitter", "talkative"], HIGH_TRUST);
    const contract = contractKnownBy([bitter.id], 100);
    const strongerConfig: RumorConfig = { ...CONFIG, traitDistortion: 0.3 };

    const mild = resolveTalk(bitter, [contract], createRng(1), CONFIG);
    const strong = resolveTalk(bitter, [contract], createRng(1), strongerConfig);

    const mildRisk = mild.revealedFacts.find((fact) => fact.kind === "realRisk")!;
    const strongRisk = strong.revealedFacts.find((fact) => fact.kind === "realRisk")!;
    expect(strongRisk.statedValue).toBeGreaterThan(mildRisk.statedValue);
  });

  it("test_multiple_known_contracts_are_all_recorded_as_contacts", () => {
    const person = talker("adv-hub", ["talkative", "loyal"], HIGH_TRUST);
    const known = contractKnownBy([person.id]);
    const knownOther: RumorContract = {
      realRisk: 60,
      client: { id: "client-b", knownBy: [person.id], wealth: 0.4 },
      facts: [],
    };
    const notKnown = contractKnownBy(["adv-someone-else"]);

    const result = resolveTalk(person, [known, knownOther, notKnown], createRng(1), CONFIG);

    expect([...result.discoveredContactKeys].sort()).toEqual(
      [
        discoveredContactKey(person.id, "client-a"),
        discoveredContactKey(person.id, "client-b"),
      ].sort(),
    );
  });
});
