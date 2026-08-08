import { describe, expect, it } from "vitest";
import balance from "../../../src/data/balance.json";
import {
  resolveDispatch,
  type DispatchConfig,
  type DispatchOutcome,
  type DispatchTarget,
} from "../../../src/domain/dispatch";
import { createRng } from "../../../src/domain/rng";
import type { Adventurer } from "../../../src/domain/types";

/** 설정은 balance.json에서 조립한다 — 테스트가 곧 "수치가 파일에서 온다"의 증거다. */
const CONFIG: DispatchConfig = {
  successRatio: balance.dispatch.successRatio,
  injuryRatio: balance.dispatch.injuryRatio,
  maxUncertainty: balance.dispatch.maxUncertainty,
  certaintyBand: balance.dispatch.certaintyBand,
  casualtyBias: balance.dispatch.casualtyBias,
};

/** 위험도를 100으로 고정하면 역량 합이 곧 ratio × 100이 되어 시나리오를 읽기 쉽다. */
const RISK = 100;
const TARGET: DispatchTarget = { realRisk: RISK };

function adventurer(id: string, capability: number): Adventurer {
  return {
    id,
    name: id,
    traits: ["talkative", "cautious"],
    goal: "money",
    trust: 0.5,
    memories: [],
    capability,
    status: "available",
    inGuild: true,
    tenureYears: 3,
  };
}

/** 원하는 ratio가 나오도록 역량을 역산한 1인 파티. */
function partyForRatio(ratio: number): Adventurer[] {
  return [adventurer("adv-solo", ratio * RISK)];
}

/** 시드를 바꿔가며 결과만 모은다. */
function outcomesAcrossSeeds(party: Adventurer[], trials: number): DispatchOutcome[] {
  return Array.from(
    { length: trials },
    (_, seed) => resolveDispatch(party, TARGET, createRng(seed), CONFIG).outcome,
  );
}

describe("resolveDispatch", () => {
  it("test_same_seed_and_party_produces_identical_result", () => {
    // Arrange
    const party = partyForRatio(0.95);

    // Act
    const first = resolveDispatch(party, TARGET, createRng(7), CONFIG);
    const second = resolveDispatch(party, TARGET, createRng(7), CONFIG);

    // Assert — ratio·uncertainty·사상자까지 전부 같아야 한다
    expect(second).toEqual(first);
  });

  it("test_ratio_is_party_capability_over_real_risk", () => {
    const party = [adventurer("a", 40), adventurer("b", 35)];

    const result = resolveDispatch(party, TARGET, createRng(1), CONFIG);

    expect(result.partyCapability).toBe(75);
    expect(result.realRisk).toBe(RISK);
    expect(result.ratio).toBeCloseTo(0.75, 10);
  });

  it("test_uncertainty_matches_the_specified_formula", () => {
    const party = partyForRatio(0.9);

    const result = resolveDispatch(party, TARGET, createRng(1), CONFIG);

    const distance = Math.abs(result.ratio - 1);
    expect(result.uncertainty).toBeCloseTo(
      CONFIG.maxUncertainty * (1 - distance / CONFIG.certaintyBand),
      10,
    );
  });

  it("test_uncertainty_shrinks_as_margin_widens", () => {
    // 마진에 반비례하는 무작위 — 이 공식의 전부다
    const uncertaintyAt = (ratio: number): number =>
      resolveDispatch(partyForRatio(ratio), TARGET, createRng(1), CONFIG).uncertainty;

    expect(uncertaintyAt(1.0)).toBeGreaterThan(uncertaintyAt(1.1));
    expect(uncertaintyAt(1.1)).toBeGreaterThan(uncertaintyAt(1.3));
    expect(uncertaintyAt(1.3)).toBeGreaterThan(0);
  });

  it("test_uncertainty_is_maximal_at_the_knife_edge", () => {
    const result = resolveDispatch(partyForRatio(1), TARGET, createRng(1), CONFIG);

    expect(result.uncertainty).toBeCloseTo(CONFIG.maxUncertainty, 10);
  });

  it("test_upper_certainty_band_is_always_success", () => {
    // Given: ratio = 1.5 (certaintyBand 0.4를 넘김)
    const outcomes = outcomesAcrossSeeds(partyForRatio(1.5), 100);

    expect(outcomes.every((outcome) => outcome === "success")).toBe(true);
  });

  it("test_exact_upper_band_boundary_is_always_success", () => {
    // 경계에서 무작위 폭이 사라진다. 부동소수 잔차(~1e-17)는 남을 수 있으나
    // AC가 보장하는 것은 폭이 비트 단위로 0인 것이 아니라 결과가 항상 성공인 것이다.
    const party = partyForRatio(1 + CONFIG.certaintyBand);

    for (let seed = 0; seed < 100; seed += 1) {
      const result = resolveDispatch(party, TARGET, createRng(seed), CONFIG);
      expect(result.uncertainty).toBeCloseTo(0, 12);
      expect(result.outcome).toBe("success");
    }
  });

  it("test_lower_certainty_band_is_always_dead", () => {
    // Given: ratio = 0.55
    const outcomes = outcomesAcrossSeeds(partyForRatio(0.55), 100);

    expect(outcomes.every((outcome) => outcome === "dead")).toBe(true);
  });

  it("test_exact_lower_band_boundary_is_always_dead", () => {
    const party = partyForRatio(1 - CONFIG.certaintyBand);

    for (let seed = 0; seed < 100; seed += 1) {
      const result = resolveDispatch(party, TARGET, createRng(seed), CONFIG);
      expect(result.uncertainty).toBeCloseTo(0, 12);
      expect(result.outcome).toBe("dead");
    }
  });

  it("test_even_odds_never_kills", () => {
    // ratio == 1.0에서 사망이 나오면 "아슬아슬했지만 공평했다"가 깨진다
    const outcomes = outcomesAcrossSeeds(partyForRatio(1), 1000);

    expect(outcomes).not.toContain("dead");
  });

  it("test_even_odds_produces_both_success_and_injury", () => {
    // 도박 구간이 실제로 도박이어야 한다 — 한쪽으로만 쏠리면 무작위가 장식이다
    const outcomes = outcomesAcrossSeeds(partyForRatio(1), 200);

    expect(outcomes).toContain("success");
    expect(outcomes).toContain("injured");
  });

  it("test_gamble_zone_can_still_kill", () => {
    // 아슬아슬한 아래쪽에서는 죽을 수 있어야 한다. 안 그러면 사망이 영영 안 나온다.
    const outcomes = outcomesAcrossSeeds(partyForRatio(0.8), 200);

    expect(outcomes).toContain("dead");
  });

  it("test_effective_stays_within_the_uncertainty_window", () => {
    for (const ratio of [0.7, 0.85, 1, 1.15, 1.3]) {
      const party = partyForRatio(ratio);
      for (let seed = 0; seed < 50; seed += 1) {
        const result = resolveDispatch(party, TARGET, createRng(seed), CONFIG);
        expect(result.effective).toBeGreaterThanOrEqual(result.ratio - result.uncertainty);
        expect(result.effective).toBeLessThan(
          result.ratio + Math.max(result.uncertainty, Number.MIN_VALUE),
        );
      }
    }
  });

  it("test_outcome_thresholds_follow_the_effective_value", () => {
    for (const ratio of [0.6, 0.8, 0.95, 1.1, 1.5]) {
      const party = partyForRatio(ratio);
      for (let seed = 0; seed < 30; seed += 1) {
        const result = resolveDispatch(party, TARGET, createRng(seed), CONFIG);
        const expected =
          result.effective >= CONFIG.successRatio
            ? "success"
            : result.effective >= CONFIG.injuryRatio
              ? "injured"
              : "dead";
        expect(result.outcome).toBe(expected);
      }
    }
  });

  it("test_casualty_is_biased_toward_the_weakest", () => {
    // Arrange — 신입(20)과 베테랑(80). 균등이면 신입 비율이 50%다.
    const rookie = adventurer("adv-rookie", 20);
    const veteran = adventurer("adv-veteran", 80);
    const party = [rookie, veteran];
    // 두 사람 합이 100이므로 ratio 0.8 → 부상·사망 구간
    const target: DispatchTarget = { realRisk: 125 };

    // Act
    let rookieFalls = 0;
    let casualties = 0;
    for (let seed = 0; seed < 1000; seed += 1) {
      const result = resolveDispatch(party, target, createRng(seed), CONFIG);
      if (result.casualtyId === undefined) continue;
      casualties += 1;
      if (result.casualtyId === rookie.id) rookieFalls += 1;
    }

    // Assert — 가중치 1/20^1.5 vs 1/80^1.5 → 신입이 8배 자주 뽑힌다
    expect(casualties).toBeGreaterThan(0);
    expect(rookieFalls / casualties).toBeGreaterThan(0.5);
  });

  it("test_veteran_shields_the_party_by_raising_capability", () => {
    // 아끼는 사람을 지키려면 그를 보내야 하는 뒤틀린 선택의 근거
    const rookieAlone = [adventurer("adv-rookie", 20)];
    const withVeteran = [adventurer("adv-rookie", 20), adventurer("adv-veteran", 80)];
    const target: DispatchTarget = { realRisk: 90 };

    const alone = resolveDispatch(rookieAlone, target, createRng(3), CONFIG);
    const shielded = resolveDispatch(withVeteran, target, createRng(3), CONFIG);

    expect(shielded.ratio).toBeGreaterThan(alone.ratio);
    expect(alone.outcome).toBe("dead");
    expect(shielded.outcome).toBe("success");
  });

  it("test_success_names_no_casualty", () => {
    const result = resolveDispatch(partyForRatio(1.5), TARGET, createRng(1), CONFIG);

    expect(result.outcome).toBe("success");
    expect(result.casualtyId).toBeUndefined();
  });

  it("test_casualty_is_always_a_party_member", () => {
    const party = [adventurer("a", 20), adventurer("b", 30), adventurer("c", 25)];
    const ids = new Set(party.map((member) => member.id));
    const target: DispatchTarget = { realRisk: 100 };

    for (let seed = 0; seed < 200; seed += 1) {
      const result = resolveDispatch(party, target, createRng(seed), CONFIG);
      if (result.casualtyId !== undefined) {
        expect(ids.has(result.casualtyId)).toBe(true);
      }
    }
  });

  it("test_only_one_casualty_is_produced", () => {
    // MVP는 사상자를 1명만 낸다 — 결과 객체에 id가 하나뿐인 것이 그 표현이다
    const party = [adventurer("a", 20), adventurer("b", 20), adventurer("c", 20)];
    const target: DispatchTarget = { realRisk: 75 };

    const result = resolveDispatch(party, target, createRng(11), CONFIG);

    expect(typeof result.casualtyId).toBe("string");
  });

  it("test_result_carries_the_evidence_for_the_reveal_screen", () => {
    // ratio와 uncertainty가 빠지면 "얼마나 아슬아슬했는지"를 보여줄 수 없고,
    // 그것이 창발을 무작위로 느끼게 하는 1순위 리스크에 대한 방어선이다
    const result = resolveDispatch(partyForRatio(0.9), TARGET, createRng(1), CONFIG);

    expect(result.ratio).toBeGreaterThan(0);
    expect(result.uncertainty).toBeGreaterThan(0);
    expect(result.partyCapability).toBe(90);
    expect(result.realRisk).toBe(RISK);
    expect(Number.isFinite(result.effective)).toBe(true);
  });

  it("test_injury_ratio_knob_controls_the_death_floor", () => {
    // 사망률 조절 1순위 노브가 실제로 사망률을 움직여야 한다
    const party = partyForRatio(0.85);
    const lenient: DispatchConfig = { ...CONFIG, injuryRatio: 0.5 };

    const deathsAt = (config: DispatchConfig): number =>
      Array.from({ length: 200 }, (_, seed) => resolveDispatch(party, TARGET, createRng(seed), config))
        .filter((result) => result.outcome === "dead").length;

    expect(deathsAt(lenient)).toBeLessThan(deathsAt(CONFIG));
  });

  it("test_empty_party_throws", () => {
    expect(() => resolveDispatch([], TARGET, createRng(1), CONFIG)).toThrow(/파티/);
  });

  it("test_non_positive_risk_throws", () => {
    const party = partyForRatio(1);

    expect(() => resolveDispatch(party, { realRisk: 0 }, createRng(1), CONFIG)).toThrow(/위험도/);
    expect(() => resolveDispatch(party, { realRisk: -5 }, createRng(1), CONFIG)).toThrow(/위험도/);
  });

  it("test_non_positive_capability_throws", () => {
    // 사상자 가중치가 1/역량^bias라 0은 계산이 성립하지 않는다. 조용히 넘기지 않는다.
    const party = [adventurer("adv-broken", 0)];

    expect(() => resolveDispatch(party, TARGET, createRng(1), CONFIG)).toThrow(/역량/);
  });
});
