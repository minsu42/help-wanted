import { describe, expect, it } from "vitest";
import balance from "../../../src/data/balance.json";
import {
  applyFunds,
  applyReputation,
  receiveAdvance,
  resolveDailyEconomy,
  resolveDispatchSettlement,
  type EconomyClient,
  type EconomyConfig,
  type EconomyDispatch,
  type EconomyResolvedDispatch,
} from "../../../src/domain/economy";
import { createRng } from "../../../src/domain/rng";

/** 설정은 balance.json에서 조립한다 — 수치가 파일에서 온다는 것의 증거다. */
const CONFIG: EconomyConfig = {
  repOnSuccess: balance.dispatch.repOnSuccess,
  repOnDeath: balance.dispatch.repOnDeath,
  repInjuryPenalty: balance.dispatch.repInjuryPenalty,
};

function client(wealth: number, id = "ct-0-client"): EconomyClient {
  return { id, wealth };
}

function dispatchOf(remainingReward: number, wealth: number, id = "ct-0-client"): EconomyDispatch {
  return { remainingReward, contract: { client: client(wealth, id) } };
}

describe("receiveAdvance", () => {
  it("test_receiveAdvance_adds_advance_immediately", () => {
    // Arrange
    const funds = 200;

    // Act
    const result = receiveAdvance(funds, 60);

    // Assert
    expect(result).toBe(260);
  });

  it("test_receiveAdvance_negative_advance_throws", () => {
    expect(() => receiveAdvance(200, -1)).toThrow(/선불/);
  });
});

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

describe("resolveDispatchSettlement — success/injured", () => {
  it("test_success_increases_reputation_by_repOnSuccess", () => {
    // Arrange — wealth 1.0이면 rng.chance(1)이 항상 true라 지급이 결정적이다
    const dispatch = dispatchOf(140, 1.0);

    // Act
    const result = resolveDispatchSettlement(dispatch, "success", 0, 10, createRng(1), CONFIG);

    // Assert
    expect(result.reputation).toBeCloseTo(10 + CONFIG.repOnSuccess, 10);
  });

  it("test_injured_applies_repInjuryPenalty_multiplier", () => {
    const dispatch = dispatchOf(140, 1.0);

    const result = resolveDispatchSettlement(dispatch, "injured", 0, 10, createRng(1), CONFIG);

    expect(result.reputation).toBeCloseTo(10 + CONFIG.repOnSuccess * CONFIG.repInjuryPenalty, 10);
  });

  it("test_success_with_wealthy_client_pays_remainder", () => {
    // wealth 1.0 → rng.chance(1)은 언제나 참
    const dispatch = dispatchOf(140, 1.0);

    const result = resolveDispatchSettlement(dispatch, "success", 60, 10, createRng(42), CONFIG);

    expect(result.funds).toBe(200);
    expect(result.wealthRevealed).toBeUndefined();
  });

  it("test_success_with_penniless_client_withholds_remainder_and_reveals_wealth", () => {
    // wealth 0 → rng.chance(0)은 언제나 거짓
    const dispatch = dispatchOf(140, 0, "ct-9-client");

    const result = resolveDispatchSettlement(dispatch, "success", 60, 10, createRng(42), CONFIG);

    expect(result.funds).toBe(60);
    expect(result.wealthRevealed).toEqual({ clientId: "ct-9-client", wealth: 0 });
  });

  it("test_payment_probability_tracks_wealth_across_many_trials", () => {
    // Given: wealth 0.1인 의뢰인, 다수 시행
    const dispatch = dispatchOf(140, 0.1);
    const trials = 500;

    // Act
    let paidCount = 0;
    for (let seed = 0; seed < trials; seed += 1) {
      const result = resolveDispatchSettlement(dispatch, "success", 0, 10, createRng(seed), CONFIG);
      if (result.wealthRevealed === undefined) paidCount += 1;
    }

    // Assert — 대부분의 경우 총 획득 0G(=미지급)이어야 하므로 지급 비율이 낮아야 한다
    expect(paidCount / trials).toBeLessThan(0.25);
  });

  it("test_out_of_range_wealth_throws", () => {
    const dispatch = dispatchOf(100, 1.5);

    expect(() =>
      resolveDispatchSettlement(dispatch, "success", 0, 10, createRng(1), CONFIG),
    ).toThrow(/wealth/);
  });

  it("test_negative_remaining_reward_throws", () => {
    const dispatch = dispatchOf(-10, 0.5);

    expect(() =>
      resolveDispatchSettlement(dispatch, "success", 0, 10, createRng(1), CONFIG),
    ).toThrow(/잔금/);
  });
});

describe("resolveDispatchSettlement — dead (AC: 실패 시 선불만)", () => {
  it("test_dead_forfeits_remainder_regardless_of_wealth", () => {
    // Given: 보상 200G, 선불 비율 0.3 (선불 60G), 결과 dead
    let funds = 0;
    funds = receiveAdvance(funds, 60); // 선불은 협상 타결 시점에 이미 확정되어 있다

    const dispatch = dispatchOf(140, 0.9); // wealth가 높아도 사망이면 소용없다
    const result = resolveDispatchSettlement(dispatch, "dead", funds, 10, createRng(1), CONFIG);

    // Then: 총 획득이 60G — 잔금 140G는 들어오지 않는다
    expect(result.funds).toBe(60);
  });

  it("test_dead_never_reveals_wealth", () => {
    // wealth는 이 판정에 관여하지 않았으므로 공개 대상이 아니다
    const dispatch = dispatchOf(140, 0.05);

    for (let seed = 0; seed < 50; seed += 1) {
      const result = resolveDispatchSettlement(dispatch, "dead", 0, 10, createRng(seed), CONFIG);
      expect(result.wealthRevealed).toBeUndefined();
    }
  });

  it("test_dead_decreases_reputation_by_repOnDeath", () => {
    const dispatch = dispatchOf(140, 0.9);

    const result = resolveDispatchSettlement(dispatch, "dead", 0, 10, createRng(1), CONFIG);

    expect(result.reputation).toBeCloseTo(10 - CONFIG.repOnDeath, 10);
  });

  it("test_dead_result_is_deterministic_regardless_of_seed", () => {
    // rng를 소비하지 않으므로 시드가 바뀌어도 결과가 흔들리지 않는다
    const dispatch = dispatchOf(140, 0.9);
    const results = Array.from({ length: 20 }, (_, seed) =>
      resolveDispatchSettlement(dispatch, "dead", 0, 10, createRng(seed), CONFIG),
    );

    for (const result of results) {
      expect(result).toEqual(results[0]);
    }
  });
});

describe("resolveDailyEconomy", () => {
  it("test_folds_multiple_dispatches_in_order", () => {
    // Arrange — 두 건: 하나는 확정 성공(wealth 1), 하나는 확정 사망
    const resolved: EconomyResolvedDispatch[] = [
      { dispatch: dispatchOf(50, 1.0, "ct-1-client"), result: { outcome: "success" } },
      { dispatch: dispatchOf(80, 1.0, "ct-2-client"), result: { outcome: "dead" } },
    ];

    // Act
    const result = resolveDailyEconomy(resolved, 100, 10, createRng(1), CONFIG);

    // Assert — 성공분(+50G, +repOnSuccess) 그리고 사망은 잔금 없음(-repOnDeath)
    expect(result.funds).toBe(150);
    expect(result.reputation).toBeCloseTo(10 + CONFIG.repOnSuccess - CONFIG.repOnDeath, 10);
    expect(result.wealthReveals).toEqual([]);
  });

  it("test_collects_wealth_reveals_from_every_nonpayment", () => {
    const resolved: EconomyResolvedDispatch[] = [
      { dispatch: dispatchOf(50, 0, "ct-1-client"), result: { outcome: "success" } },
      { dispatch: dispatchOf(80, 0, "ct-2-client"), result: { outcome: "injured" } },
    ];

    const result = resolveDailyEconomy(resolved, 0, 10, createRng(1), CONFIG);

    expect(result.wealthReveals).toEqual([
      { clientId: "ct-1-client", wealth: 0 },
      { clientId: "ct-2-client", wealth: 0 },
    ]);
    expect(result.funds).toBe(0);
  });

  it("test_reputation_accumulates_across_dispatches_and_still_clamps", () => {
    // 명성 98에서 성공 두 건이 연달아 와도 100을 넘지 않는다
    const resolved: EconomyResolvedDispatch[] = [
      { dispatch: dispatchOf(0, 1.0, "ct-1-client"), result: { outcome: "success" } },
      { dispatch: dispatchOf(0, 1.0, "ct-2-client"), result: { outcome: "success" } },
    ];

    const result = resolveDailyEconomy(resolved, 0, 98, createRng(1), CONFIG);

    expect(result.reputation).toBe(100);
  });

  it("test_empty_day_leaves_funds_and_reputation_unchanged", () => {
    const result = resolveDailyEconomy([], 120, 20, createRng(1), CONFIG);

    expect(result).toEqual({ funds: 120, reputation: 20, wealthReveals: [] });
  });

  it("test_same_seed_and_inputs_produce_identical_result", () => {
    const resolved: EconomyResolvedDispatch[] = [
      { dispatch: dispatchOf(50, 0.4, "ct-1-client"), result: { outcome: "success" } },
      { dispatch: dispatchOf(80, 0.6, "ct-2-client"), result: { outcome: "injured" } },
    ];

    const first = resolveDailyEconomy(resolved, 100, 10, createRng(7), CONFIG);
    const second = resolveDailyEconomy(resolved, 100, 10, createRng(7), CONFIG);

    expect(second).toEqual(first);
  });
});
