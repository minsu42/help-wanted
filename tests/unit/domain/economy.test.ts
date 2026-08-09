import { describe, expect, it } from "vitest";
import balance from "../../../src/data/balance.json";
import {
  applyFunds,
  applyReputation,
  resolveDailyEconomy,
  resolveDispatchSettlement,
  type EconomyConfig,
  type EconomyDispatch,
  type EconomyResolvedDispatch,
} from "../../../src/domain/economy";

/** 설정은 balance.json에서 조립한다 — 수치가 파일에서 온다는 것의 증거다. */
const CONFIG: EconomyConfig = {
  repOnSuccess: balance.dispatch.repOnSuccess,
  repOnDeath: balance.dispatch.repOnDeath,
  repInjuryPenalty: balance.dispatch.repInjuryPenalty,
};

function dispatchOf(agreedReward: number): EconomyDispatch {
  return { agreedReward };
}

describe("applyFunds", () => {
  it("test_applyFunds_never_goes_below_zero", () => {
    // Arrange — 큰 폭의 지출을 흉내낸다
    const funds = 50;

    // Act
    const result = applyFunds(funds, -500);

    // Assert
    expect(result).toBe(0);
  });

  it("test_applyFunds_adds_positive_delta_normally", () => {
    expect(applyFunds(100, 40)).toBe(140);
  });
});

describe("applyReputation", () => {
  it("test_applyReputation_clamps_at_zero", () => {
    // Given: 명성 3에서 dead(-6)
    const result = applyReputation(3, -6);

    expect(result).toBe(0);
  });

  it("test_applyReputation_clamps_at_hundred", () => {
    // Edge: 명성 98에서 success(+2.5) → 100
    const result = applyReputation(98, 2.5);

    expect(result).toBe(100);
  });

  it("test_applyReputation_adds_normally_within_range", () => {
    expect(applyReputation(10, 5)).toBe(15);
  });
});

describe("resolveDispatchSettlement — success/injured (AC: 완수하면 전액 지급)", () => {
  it("test_success_increases_reputation_by_repOnSuccess", () => {
    // Arrange
    const dispatch = dispatchOf(140);

    // Act
    const result = resolveDispatchSettlement(dispatch, "success", 0, 10, CONFIG);

    // Assert
    expect(result.reputation).toBeCloseTo(10 + CONFIG.repOnSuccess, 10);
  });

  it("test_injured_applies_repInjuryPenalty_multiplier", () => {
    // Arrange
    const dispatch = dispatchOf(140);

    // Act
    const result = resolveDispatchSettlement(dispatch, "injured", 0, 10, CONFIG);

    // Assert
    expect(result.reputation).toBeCloseTo(10 + CONFIG.repOnSuccess * CONFIG.repInjuryPenalty, 10);
  });

  it("test_success_always_pays_the_agreed_reward_in_full", () => {
    // Arrange — 잔금 미지급이 사라졌으므로 항상 전액이다
    const dispatch = dispatchOf(140);

    // Act
    const result = resolveDispatchSettlement(dispatch, "success", 60, 10, CONFIG);

    // Assert
    expect(result.funds).toBe(200);
  });

  it("test_injured_also_pays_the_agreed_reward_in_full", () => {
    // Arrange — 부상해도 완수는 완수다
    const dispatch = dispatchOf(140);

    // Act
    const result = resolveDispatchSettlement(dispatch, "injured", 60, 10, CONFIG);

    // Assert
    expect(result.funds).toBe(200);
  });

  it("test_negative_agreed_reward_throws", () => {
    // Arrange
    const dispatch = dispatchOf(-10);

    // Act / Assert
    expect(() => resolveDispatchSettlement(dispatch, "success", 0, 10, CONFIG)).toThrow(/타결액/);
  });
});

describe("resolveDispatchSettlement — dead (AC: 실패 시 무지급)", () => {
  it("test_dead_forfeits_the_agreed_reward", () => {
    // Arrange
    const dispatch = dispatchOf(200);

    // Act
    const result = resolveDispatchSettlement(dispatch, "dead", 0, 10, CONFIG);

    // Assert — 협상 타결액은 사망 시 전혀 들어오지 않는다
    expect(result.funds).toBe(0);
  });

  it("test_dead_decreases_reputation_by_repOnDeath", () => {
    // Arrange
    const dispatch = dispatchOf(140);

    // Act
    const result = resolveDispatchSettlement(dispatch, "dead", 0, 10, CONFIG);

    // Assert
    expect(result.reputation).toBeCloseTo(10 - CONFIG.repOnDeath, 10);
  });

  it("test_dead_result_is_deterministic", () => {
    // Arrange
    const dispatch = dispatchOf(140);

    // Act
    const results = Array.from({ length: 20 }, () =>
      resolveDispatchSettlement(dispatch, "dead", 0, 10, CONFIG),
    );

    // Assert
    for (const result of results) {
      expect(result).toEqual(results[0]);
    }
  });
});

describe("resolveDailyEconomy", () => {
  it("test_folds_multiple_dispatches_in_order", () => {
    // Arrange — 두 건: 하나는 성공, 하나는 사망
    const resolved: EconomyResolvedDispatch[] = [
      { dispatch: dispatchOf(50), result: { outcome: "success" } },
      { dispatch: dispatchOf(80), result: { outcome: "dead" } },
    ];

    // Act
    const result = resolveDailyEconomy(resolved, 100, 10, CONFIG);

    // Assert — 성공분(+50G, +repOnSuccess) 그리고 사망은 무지급(-repOnDeath)
    expect(result.funds).toBe(150);
    expect(result.reputation).toBeCloseTo(10 + CONFIG.repOnSuccess - CONFIG.repOnDeath, 10);
  });

  it("test_reputation_accumulates_across_dispatches_and_still_clamps", () => {
    // Arrange — 명성 98에서 성공 두 건이 연달아 와도 100을 넘지 않는다
    const resolved: EconomyResolvedDispatch[] = [
      { dispatch: dispatchOf(0), result: { outcome: "success" } },
      { dispatch: dispatchOf(0), result: { outcome: "success" } },
    ];

    // Act
    const result = resolveDailyEconomy(resolved, 0, 98, CONFIG);

    // Assert
    expect(result.reputation).toBe(100);
  });

  it("test_empty_day_leaves_funds_and_reputation_unchanged", () => {
    // Act
    const result = resolveDailyEconomy([], 120, 20, CONFIG);

    // Assert
    expect(result).toEqual({ funds: 120, reputation: 20 });
  });

  it("test_same_inputs_produce_identical_result", () => {
    // Arrange — 난수가 없으므로 같은 입력이면 항상 같은 결과다
    const resolved: EconomyResolvedDispatch[] = [
      { dispatch: dispatchOf(50), result: { outcome: "success" } },
      { dispatch: dispatchOf(80), result: { outcome: "injured" } },
    ];

    // Act
    const first = resolveDailyEconomy(resolved, 100, 10, CONFIG);
    const second = resolveDailyEconomy(resolved, 100, 10, CONFIG);

    // Assert
    expect(second).toEqual(first);
  });
});
