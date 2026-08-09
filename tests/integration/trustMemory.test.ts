import { describe, expect, it } from "vitest";
import balance from "../../src/data/balance.json";
import type { DispatchOutcome } from "../../src/domain/dispatch";
import {
  resolveDispatchAftermath,
  resolveForcedAssignment,
  type AftermathOutcome,
  type DispatchAftermath,
  type ReputationConfig,
  type ReputationTarget,
} from "../../src/domain/reputation";
import { createRng } from "../../src/domain/rng";
import { resolveTalk, type RumorConfig, type RumorContract, type RumorTalker } from "../../src/domain/rumor";
import type { Memory } from "../../src/domain/types";

/**
 * story-013: 신뢰·기억 갱신.
 *
 * 마지막 케이스("신뢰 하락이 소문을 막는다")가 이 파일이 unit이 아니라 integration인
 * 이유다 — `reputation.ts`가 낮춘 trust를 `rumor.ts`의 실제 함수(`resolveTalk`)에
 * 흘려 넣어 소문이 막히는지까지 확인한다.
 */

/** 설정은 balance.json에서 조립한다 — 수치가 파일에서 온다는 것의 증거다. */
const CONFIG: ReputationConfig = {
  trustOnSurvive: balance.rumor.trustOnSurvive,
  trustOnWound: balance.rumor.trustOnWound,
  trustOnDeath: balance.rumor.trustOnDeath,
  trustOnDeceit: balance.rumor.trustOnDeceit,
  dangerThreshold: balance.rumor.dangerMemoryThreshold,
};

const RUMOR_CONFIG: RumorConfig = {
  trustThresholdDefault: balance.rumor.trustThresholdDefault,
  trustThresholdCautious: balance.rumor.trustThresholdCautious,
  trustThresholdLoyal: balance.rumor.trustThresholdLoyal,
  traitDistortion: balance.rumor.traitDistortion,
  greedyPrice: balance.rumor.greedyPrice,
};

const DAY = 5;

function member(id: string, trust: number): ReputationTarget {
  return { id, trust };
}

function outcomeOf(outcome: DispatchOutcome, casualtyId?: string): AftermathOutcome {
  return { outcome, casualtyId };
}

function trustOf(aftermath: DispatchAftermath, personId: string): number | undefined {
  return aftermath.trustUpdates.find((update) => update.personId === personId)?.trust;
}

function memoriesOf(aftermath: DispatchAftermath, personId: string): Memory[] {
  return aftermath.memoryUpdates
    .filter((update) => update.personId === personId)
    .map((update) => update.memory);
}

describe("resolveDispatchAftermath — trust", () => {
  it("test_reputation_concealed_death_penalty_exceeds_plain_death_penalty", () => {
    // Arrange — 동일한 사망 사건, concealedKnownRisk만 다르다
    const startingTrust = 0.7;
    const party = [member("adv-survivor", startingTrust), member("adv-victim", startingTrust)];
    const result = outcomeOf("dead", "adv-victim");

    // Act
    const concealed = resolveDispatchAftermath(party, [], result, 50, true, DAY, CONFIG);
    const plain = resolveDispatchAftermath(party, [], result, 50, false, DAY, CONFIG);

    // Assert — -0.50 vs -0.15
    expect(trustOf(concealed, "adv-survivor")).toBeCloseTo(startingTrust - 0.5, 10);
    expect(trustOf(plain, "adv-survivor")).toBeCloseTo(startingTrust - 0.15, 10);
    expect(trustOf(concealed, "adv-survivor")!).toBeLessThan(trustOf(plain, "adv-survivor")!);
  });

  it("test_reputation_clamps_at_floor_zero", () => {
    // Given: trust 0.1에서 침묵 후 사망(-0.50)
    const party = [member("adv-survivor", 0.1), member("adv-victim", 0.5)];
    const result = outcomeOf("dead", "adv-victim");

    const aftermath = resolveDispatchAftermath(party, [], result, 50, true, DAY, CONFIG);

    // Then: 음수로 내려가지 않는다
    expect(trustOf(aftermath, "adv-survivor")).toBe(0);
  });

  it("test_reputation_clamps_at_ceiling_one", () => {
    // Edge: trust 0.98에서 생존(+0.05) → 1.0
    const party = [member("adv-1", 0.98)];
    const result = outcomeOf("success");

    const aftermath = resolveDispatchAftermath(party, [], result, 50, false, DAY, CONFIG);

    expect(trustOf(aftermath, "adv-1")).toBe(1);
  });

  it("test_reputation_wounded_member_receives_trustOnWound", () => {
    const party = [member("adv-wounded", 0.5)];
    const result = outcomeOf("injured", "adv-wounded");

    const aftermath = resolveDispatchAftermath(party, [], result, 50, false, DAY, CONFIG);

    expect(trustOf(aftermath, "adv-wounded")).toBeCloseTo(0.5 + balance.rumor.trustOnWound, 10);
  });
});

describe("resolveDispatchAftermath — memory: 동료 상실", () => {
  it("test_memory_lostComrade_recorded_to_every_survivor_with_victim_subjectId", () => {
    // Given: 3인 파티에서 1명 사망
    const party = [member("adv-1", 0.5), member("adv-2", 0.5), member("adv-victim", 0.5)];
    const result = outcomeOf("dead", "adv-victim");

    // Act
    const aftermath = resolveDispatchAftermath(party, [], result, 50, false, DAY, CONFIG);

    // Then: 생존 2명에게 lostComrade, subjectId는 사망자 id
    for (const survivorId of ["adv-1", "adv-2"]) {
      const lostComrade = memoriesOf(aftermath, survivorId).find(
        (memory) => memory.kind === "lostComrade",
      );
      expect(lostComrade).toBeDefined();
      expect(lostComrade?.subjectId).toBe("adv-victim");
    }
  });

  it("test_memory_lostComrade_absent_for_solo_party_death", () => {
    // Edge: 1인 파티에서 사망 시 lostComrade가 아무에게도 안 남는다
    const party = [member("adv-solo", 0.5)];
    const result = outcomeOf("dead", "adv-solo");

    const aftermath = resolveDispatchAftermath(party, [], result, 50, false, DAY, CONFIG);

    const anyLostComrade = aftermath.memoryUpdates.some(
      (update) => update.memory.kind === "lostComrade",
    );
    expect(anyLostComrade).toBe(false);
  });
});

describe("resolveDispatchAftermath — memory: 사망자 본인", () => {
  it("test_memory_and_trust_absent_for_the_deceased", () => {
    const party = [member("adv-1", 0.5), member("adv-victim", 0.5)];
    const result = outcomeOf("dead", "adv-victim");

    const aftermath = resolveDispatchAftermath(party, [], result, 50, true, DAY, CONFIG);

    expect(trustOf(aftermath, "adv-victim")).toBeUndefined();
    expect(memoriesOf(aftermath, "adv-victim")).toEqual([]);
  });
});

describe("resolveDispatchAftermath — memory: 공개 위험도 / 침묵", () => {
  it("test_memory_sentToDanger_when_statedRisk_meets_threshold", () => {
    const party = [member("adv-1", 0.5)];
    const result = outcomeOf("success");

    const aftermath = resolveDispatchAftermath(
      party,
      [],
      result,
      CONFIG.dangerThreshold,
      false,
      DAY,
      CONFIG,
    );

    expect(memoriesOf(aftermath, "adv-1").map((memory) => memory.kind)).toContain(
      "sentToDanger",
    );
  });

  it("test_memory_sentSafe_when_statedRisk_below_threshold", () => {
    const party = [member("adv-1", 0.5)];
    const result = outcomeOf("success");

    const aftermath = resolveDispatchAftermath(
      party,
      [],
      result,
      CONFIG.dangerThreshold - 1,
      false,
      DAY,
      CONFIG,
    );

    expect(memoriesOf(aftermath, "adv-1").map((memory) => memory.kind)).toContain("sentSafe");
  });

  it("test_memory_wasDeceived_recorded_regardless_of_outcome_when_concealed", () => {
    // 침묵은 생존/부상/사망과 무관하게 항상 기록된다
    const party = [member("adv-1", 0.5)];
    const result = outcomeOf("success");

    const aftermath = resolveDispatchAftermath(party, [], result, 50, true, DAY, CONFIG);

    expect(memoriesOf(aftermath, "adv-1").map((memory) => memory.kind)).toContain("wasDeceived");
  });
});

describe("신뢰 하락이 소문을 막는다 (integration: reputation → rumor)", () => {
  it("test_trust_drop_from_concealed_death_blocks_resolveTalk_disclosure", () => {
    // Given: cautious(임계 0.6)이고 trust 0.65인 정보원이 같은 파견에서 살아 돌아왔고,
    // 그 파견은 실제 위험을 알고도 숨긴 채 보낸 것이었으며 동료가 죽었다.
    const talkerId = "adv-informant";
    const party = [member(talkerId, 0.65), member("adv-victim", 0.65)];
    const result = outcomeOf("dead", "adv-victim");

    // Act — story-013 판정: trust가 0.65 - 0.50 = 0.15로 떨어진다
    const aftermath = resolveDispatchAftermath(party, [], result, 50, true, DAY, CONFIG);
    const newTrust = trustOf(aftermath, talkerId);
    expect(newTrust).toBeCloseTo(0.15, 10);

    // Assert — 그 낮아진 trust로 다음 날 대화하면 알고 있는 사실을 말하지 않는다
    const talker: RumorTalker = { id: talkerId, traits: ["cautious", "loyal"], trust: newTrust! };
    const contract: RumorContract = {
      realRisk: 80,
      facts: [{ id: "ct-1:realRisk", contractId: "ct-1", kind: "realRisk" }],
      client: { id: "client-1", knownBy: [talkerId], wealth: 0.5 },
    };

    const talkResult = resolveTalk(talker, [contract], createRng(1), RUMOR_CONFIG);

    // 인맥 공개(①)는 신뢰와 무관하게 여전히 일어난다 — 막히는 것은 사실(②)뿐이다
    expect(talkResult.discoveredContactKeys).toEqual([`${talkerId}->client-1`]);
    expect(talkResult.revealedFacts).toEqual([]);
  });
});

/**
 * 사망의 trust 범위는 길드 전체다 (스토리 AC: "생존 **길드원** 전체에게").
 *
 * 이것이 착취를 억제하는 유일한 기계적 장치이므로, 파티원 한둘만 깎으면 압력이
 * 성립하지 않는다. 반면 `Memory`는 파티에만 남는다 — 소식을 들은 것과 거기 있었던
 * 것은 다르다.
 */
describe("resolveDispatchAftermath — 사망은 길드 전체로 번진다", () => {
  it("test_reputation_death_lowers_trust_of_guild_members_outside_the_party", () => {
    // Arrange
    const party = [member("adv-survivor", 0.7), member("adv-victim", 0.7)];
    const bystanders = [member("adv-home-1", 0.7), member("adv-home-2", 0.7)];
    const result = outcomeOf("dead", "adv-victim");

    // Act
    const aftermath = resolveDispatchAftermath(party, bystanders, result, 50, false, DAY, CONFIG);

    // Assert — 나가지 않은 길드원도 같은 폭으로 떨어진다
    expect(trustOf(aftermath, "adv-home-1")).toBeCloseTo(0.7 + CONFIG.trustOnDeath, 10);
    expect(trustOf(aftermath, "adv-home-2")).toBeCloseTo(0.7 + CONFIG.trustOnDeath, 10);
  });

  it("test_reputation_concealed_death_penalty_also_spreads_to_the_whole_guild", () => {
    // 은폐의 대가가 정보망 전체를 조인다는 것이 이 설계의 핵심이다
    const party = [member("adv-victim", 0.9)];
    const bystanders = [member("adv-home", 0.9)];
    const result = outcomeOf("dead", "adv-victim");

    const aftermath = resolveDispatchAftermath(party, bystanders, result, 50, true, DAY, CONFIG);

    const expected = 0.9 + CONFIG.trustOnDeath + CONFIG.trustOnDeceit;
    expect(trustOf(aftermath, "adv-home")).toBeCloseTo(expected, 10);
  });

  it("test_reputation_bystanders_receive_no_memory_only_trust", () => {
    // lostComrade는 거기 있었던 사람의 경험이다 — 소식을 들은 사람에게 붙으면
    // 1인 파티 엣지 케이스("아무에게도 안 남는다")의 의미가 무너진다
    const party = [member("adv-victim", 0.7)];
    const bystanders = [member("adv-home", 0.7)];
    const result = outcomeOf("dead", "adv-victim");

    const aftermath = resolveDispatchAftermath(party, bystanders, result, 50, true, DAY, CONFIG);

    expect(memoriesOf(aftermath, "adv-home")).toHaveLength(0);
    expect(trustOf(aftermath, "adv-home")).toBeDefined();
  });

  it("test_reputation_non_death_outcomes_do_not_spread_outside_the_party", () => {
    // 무사히 다녀온 일과 부상은 소식거리가 아니다 — 파티 밖은 그대로다
    const bystanders = [member("adv-home", 0.5)];

    const survived = resolveDispatchAftermath(
      [member("adv-1", 0.5)],
      bystanders,
      outcomeOf("success"),
      50,
      false,
      DAY,
      CONFIG,
    );
    const wounded = resolveDispatchAftermath(
      [member("adv-1", 0.5)],
      bystanders,
      outcomeOf("injured", "adv-1"),
      50,
      false,
      DAY,
      CONFIG,
    );

    expect(trustOf(survived, "adv-home")).toBeUndefined();
    expect(trustOf(wounded, "adv-home")).toBeUndefined();
  });
});

/**
 * 강행 배정의 대가.
 *
 * > 2026-08-09 신설 — 배정 거부가 하드 게이트에서 대가로 바뀌면서 생겼다.
 * > 마지막 케이스가 이 변경의 **알려진 한계**를 못박는다: 신뢰가 이미 0이면 대가가
 * > 없다. 무심코 "고쳐지지 않았다"고 읽히지 않도록 의도된 동작임을 테스트로 남긴다.
 * > 실제 해법은 로드맵 P4의 「길드 탈퇴」다.
 * > 기록: `design/quick-specs/assignment-reluctance-2026-08-09.md` §7
 */
describe("resolveForcedAssignment — 강행 배정", () => {
  const PENALTY = balance.dispatch.forcedAssignmentTrustPenalty;

  it("test_forced_assignment_lowers_trust_by_the_penalty", () => {
    // Arrange
    const reluctant = [member("adv-1", 0.5)];

    // Act
    const aftermath = resolveForcedAssignment(reluctant, DAY, PENALTY);

    // Assert
    expect(trustOf(aftermath, "adv-1")).toBeCloseTo(0.5 + PENALTY, 8);
  });

  it("test_forced_assignment_records_the_memory_with_the_day", () => {
    // Arrange
    const reluctant = [member("adv-1", 0.5)];

    // Act
    const aftermath = resolveForcedAssignment(reluctant, DAY, PENALTY);

    // Assert
    expect(memoriesOf(aftermath, "adv-1")).toEqual([{ day: DAY, kind: "forcedAssignment" }]);
  });

  it("test_forced_assignment_penalty_is_lighter_than_a_death", () => {
    // 사람이 죽은 것보다 무거울 수 없다 — 이 순서가 깨지면 밸런스가 뒤집힌 것이다.
    expect(Math.abs(PENALTY)).toBeLessThan(Math.abs(CONFIG.trustOnDeath));
  });

  it("test_forced_assignment_with_no_reluctant_members_changes_nothing", () => {
    // Act
    const aftermath = resolveForcedAssignment([], DAY, PENALTY);

    // Assert
    expect(aftermath.trustUpdates).toEqual([]);
    expect(aftermath.memoryUpdates).toEqual([]);
  });

  it("test_forced_assignment_cost_vanishes_at_zero_trust", () => {
    // Arrange — 은폐 사망 한 번이면 길드원 전원이 도달하는 상태
    const reluctant = [member("adv-broken", 0)];

    // Act
    const aftermath = resolveForcedAssignment(reluctant, DAY, PENALTY);

    // Assert — 클램프되어 대가가 사라진다. 의도된 한계이며 P4가 해결한다
    expect(trustOf(aftermath, "adv-broken")).toBe(0);
  });
});
