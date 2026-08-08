import { describe, expect, it } from "vitest";
import balance from "../../../src/data/balance.json";
import {
  activeGuildRosterSize,
  checkExpand,
  checkRecruit,
  expandGuild,
  findGuildTier,
  recruitAdventurer,
  recruitCost,
  type GuildConfig,
  type RecruitConfig,
  type RosterMember,
} from "../../../src/domain/guild";
import { discoveredContactKey, resolveTalk, type RumorConfig, type RumorContract } from "../../../src/domain/rumor";
import { createRng } from "../../../src/domain/rng";
import type { Adventurer, AdventurerStatus } from "../../../src/domain/types";

/** 설정은 balance.json에서 조립한다 — 수치가 파일에서 온다는 것의 증거다. */
const RECRUIT_CONFIG: RecruitConfig = {
  costBase: balance.recruit.costBase,
  costPerCapability: balance.recruit.costPerCapability,
  costPerTenure: balance.recruit.costPerTenure,
  initialTrust: balance.recruit.initialTrust,
};

const GUILD_CONFIG: GuildConfig = {
  recruit: RECRUIT_CONFIG,
  guildTiers: balance.guildTiers,
};

const RUMOR_CONFIG: RumorConfig = {
  trustThresholdDefault: balance.rumor.trustThresholdDefault,
  trustThresholdCautious: balance.rumor.trustThresholdCautious,
  trustThresholdLoyal: balance.rumor.trustThresholdLoyal,
  traitDistortion: balance.rumor.traitDistortion,
  greedyPrice: balance.rumor.greedyPrice,
};

/** 픽스처 팩토리. 필요한 필드만 덮어써서 각 테스트의 의도를 드러낸다. */
function adventurer(overrides: Partial<Adventurer> = {}): Adventurer {
  return {
    id: "adv-outsider",
    name: "김철수",
    traits: ["talkative", "loyal"],
    goal: "money",
    trust: 0,
    memories: [],
    capability: 20,
    status: "available",
    inGuild: false,
    tenureYears: 1,
    ...overrides,
  };
}

function guildMember(id: string, status: AdventurerStatus = "available"): RosterMember {
  return adventurer({ id, inGuild: true, status });
}

describe("recruitCost", () => {
  // --- QA: 비용 계산 ---
  it("test_recruit_cost_for_a_rookie_capability_20_tenure_1", () => {
    const cost = recruitCost({ capability: 20, tenureYears: 1 }, RECRUIT_CONFIG);

    expect(cost).toBe(135);
  });

  it("test_recruit_cost_for_a_veteran_capability_80_tenure_6", () => {
    const cost = recruitCost({ capability: 80, tenureYears: 6 }, RECRUIT_CONFIG);

    expect(cost).toBe(330);
  });
});

describe("activeGuildRosterSize", () => {
  it("test_counts_only_living_guild_members", () => {
    // Arrange — 길드원 3명 중 1명은 사망, 외부인 1명은 세지 않는다
    const roster: RosterMember[] = [
      guildMember("adv-1"),
      guildMember("adv-2", "dead"),
      guildMember("adv-3", "injured"),
      adventurer({ id: "adv-outsider", inGuild: false }),
    ];

    const size = activeGuildRosterSize(roster);

    // Assert — adv-1(available) + adv-3(injured)만 센다. injured도 길드원이므로 포함
    expect(size).toBe(2);
  });
});

describe("checkRecruit", () => {
  // --- QA: 정원 차단 ---
  it("test_roster_full_at_tier_1_cap_blocks_recruit_with_rosterFull_reason", () => {
    // Arrange — 등급 1 정원 8, 길드원 8명이 모두 살아 있다
    const roster = Array.from({ length: 8 }, (_, i) => guildMember(`adv-g${i}`));
    const candidate = adventurer({ id: "adv-outsider", inGuild: false });

    const result = checkRecruit(candidate, roster, 10_000, 1, GUILD_CONFIG);

    expect(result.canRecruit).toBe(false);
    expect(result.reason).toBe("rosterFull");
  });

  // --- QA: Edge — 사망으로 7명이 되면 다시 활성 ---
  it("test_a_death_freeing_a_slot_makes_recruit_possible_again", () => {
    const roster = [
      ...Array.from({ length: 7 }, (_, i) => guildMember(`adv-g${i}`)),
      guildMember("adv-dead", "dead"),
    ];
    const candidate = adventurer({ id: "adv-outsider", inGuild: false, capability: 20, tenureYears: 1 });

    const result = checkRecruit(candidate, roster, 10_000, 1, GUILD_CONFIG);

    expect(result.canRecruit).toBe(true);
  });

  // --- QA: 자금 부족 ---
  it("test_insufficient_funds_blocks_recruit_with_a_reason_distinct_from_rosterFull", () => {
    const candidate = adventurer({ capability: 80, tenureYears: 6 }); // cost 330

    const result = checkRecruit(candidate, [], 100, 1, GUILD_CONFIG);

    expect(result.canRecruit).toBe(false);
    expect(result.reason).toBe("insufficientFunds");
    expect(result.reason).not.toBe("rosterFull");
  });

  it("test_already_in_guild_member_cannot_be_recruited", () => {
    const candidate = adventurer({ inGuild: true });

    const result = checkRecruit(candidate, [], 10_000, 1, GUILD_CONFIG);

    expect(result.canRecruit).toBe(false);
    expect(result.reason).toBe("alreadyInGuild");
  });

  it("test_recruit_check_uses_the_rosterCap_of_the_given_guild_tier", () => {
    // 등급 2 정원 10 — 등급 1이면 막혔을 8명짜리 명부도 등급 2에서는 통과한다
    const roster = Array.from({ length: 8 }, (_, i) => guildMember(`adv-g${i}`));
    const candidate = adventurer({ id: "adv-outsider", inGuild: false });

    const result = checkRecruit(candidate, roster, 10_000, 2, GUILD_CONFIG);

    expect(result.canRecruit).toBe(true);
  });
});

describe("recruitAdventurer", () => {
  // --- QA: 영입 실행 ---
  it("test_recruit_execution_sets_inGuild_deducts_exact_cost_and_sets_initial_trust", () => {
    // Arrange
    const candidate = adventurer({ capability: 20, tenureYears: 1, inGuild: false, trust: 0 });
    const funds = 500;

    // Act
    const newFunds = recruitAdventurer(candidate, [], funds, 1, GUILD_CONFIG);

    // Assert
    expect(candidate.inGuild).toBe(true);
    expect(newFunds).toBe(funds - 135);
    expect(candidate.trust).toBe(balance.recruit.initialTrust);
  });

  // --- QA: 이미 길드원인 사람은 영입할 수 없다 ---
  it("test_recruit_execution_throws_for_an_existing_guild_member", () => {
    const candidate = adventurer({ inGuild: true });

    expect(() => recruitAdventurer(candidate, [], 10_000, 1, GUILD_CONFIG)).toThrow(/영입/);
  });

  it("test_recruit_execution_throws_when_roster_is_full", () => {
    const roster = Array.from({ length: 8 }, (_, i) => guildMember(`adv-g${i}`));
    const candidate = adventurer({ id: "adv-outsider", inGuild: false });

    expect(() => recruitAdventurer(candidate, roster, 10_000, 1, GUILD_CONFIG)).toThrow(/영입/);
  });

  it("test_recruit_execution_throws_when_funds_are_insufficient", () => {
    const candidate = adventurer({ capability: 80, tenureYears: 6 }); // cost 330

    expect(() => recruitAdventurer(candidate, [], 100, 1, GUILD_CONFIG)).toThrow(/영입/);
  });
});

// --- QA: 영입이 정보를 연다 ---
describe("영입이 정보를 연다 (rumor.ts와의 통합)", () => {
  function contractKnownBy(knownBy: readonly string[]): RumorContract {
    return {
      realRisk: 100,
      client: { id: "client-x", knownBy, wealth: 0.5 },
      facts: [{ id: "ct-0:realRisk", contractId: "ct-0", kind: "realRisk" }],
    };
  }

  it("test_recruiting_an_outsider_immediately_opens_their_known_contacts_regardless_of_trust", () => {
    // Arrange — 인맥 공개(①)는 신뢰와 무관하다. 영입 직후에도 즉시 나온다
    const outsider = adventurer({ id: "adv-outsider", inGuild: false, trust: 0, traits: ["talkative", "cautious"] });
    const contract = contractKnownBy([outsider.id]);

    // Act
    recruitAdventurer(outsider, [], 1_000, 1, GUILD_CONFIG);
    const result = resolveTalk(outsider, [contract], createRng(1), RUMOR_CONFIG);

    // Assert
    expect(result.discoveredContactKeys).toContain(discoveredContactKey(outsider.id, "client-x"));
  });

  it("test_recruit_initial_trust_alone_is_not_enough_for_a_default_threshold_talker", () => {
    // default 임계값(0.4) > recruit.initialTrust(0.25) — 신뢰 임계는 별도로 충족해야 한다
    const outsider = adventurer({ id: "adv-outsider", inGuild: false, trust: 0, traits: ["talkative", "bitter"] });
    const contract = contractKnownBy([outsider.id]);

    recruitAdventurer(outsider, [], 1_000, 1, GUILD_CONFIG);
    const result = resolveTalk(outsider, [contract], createRng(1), RUMOR_CONFIG);

    expect(result.revealedFacts).toEqual([]);
  });

  it("test_recruit_initial_trust_is_enough_for_a_loyal_talker_whose_threshold_is_lower", () => {
    // loyal 임계값(0.2) <= recruit.initialTrust(0.25) — 이 조합이면 영입 직후 바로 말한다
    const outsider = adventurer({ id: "adv-outsider", inGuild: false, trust: 0, traits: ["talkative", "loyal"] });
    const contract = contractKnownBy([outsider.id]);

    recruitAdventurer(outsider, [], 1_000, 1, GUILD_CONFIG);
    const result = resolveTalk(outsider, [contract], createRng(1), RUMOR_CONFIG);

    expect(result.revealedFacts.length).toBeGreaterThan(0);
  });
});

describe("checkExpand / expandGuild", () => {
  // --- Manual QA: 확장 3효과 동시 반영 ---
  it("test_expand_from_tier_1_to_2_updates_rosterCap_hallAttendanceMax_and_concurrentContracts_together", () => {
    const result = expandGuild(1, 1_000, GUILD_CONFIG);
    const newTierRow = findGuildTier(result.guildTier, GUILD_CONFIG);

    expect(result.guildTier).toBe(2);
    expect(newTierRow.rosterCap).toBe(10);
    expect(newTierRow.hallAttendanceMax).toBe(5);
    expect(newTierRow.concurrentContracts).toBe(3);
  });

  it("test_expand_deducts_the_exact_tier_cost_from_funds", () => {
    const tier2Cost = findGuildTier(2, GUILD_CONFIG).cost;

    const result = expandGuild(1, 1_000, GUILD_CONFIG);

    expect(result.funds).toBe(1_000 - tier2Cost);
  });

  // --- QA: 등급 3에서 더 이상 올릴 수 없다 ---
  it("test_cannot_expand_beyond_tier_3", () => {
    const check = checkExpand(3, 100_000, GUILD_CONFIG);

    expect(check.canExpand).toBe(false);
    expect(check.reason).toBe("maxTierReached");
  });

  it("test_expand_throws_when_already_at_max_tier", () => {
    expect(() => expandGuild(3, 100_000, GUILD_CONFIG)).toThrow(/확장/);
  });

  // --- QA: 자금 부족 시 불가, 사유 코드 구분 ---
  it("test_expand_blocked_by_insufficient_funds_with_a_distinct_reason", () => {
    const check = checkExpand(1, 0, GUILD_CONFIG);

    expect(check.canExpand).toBe(false);
    expect(check.reason).toBe("insufficientFunds");
    expect(check.reason).not.toBe("maxTierReached");
  });

  // --- 밸런스 관계 고정: 확장 비용 > 최고가 영입 비용 ---
  it("test_cheapest_expansion_costs_more_than_the_highest_possible_recruit_cost", () => {
    // Arrange — balance.json이 정의한 실제 상한(capabilityMax/tenureYearsMax)으로
    // 나올 수 있는 가장 비싼 영입가를 계산한다. 특정 예시 숫자(330)에 매지 않고
    // 실제 생성 범위의 극단값으로 관계를 고정해야 밸런싱 중 실수를 잡을 수 있다.
    const maxPossibleRecruitCost = recruitCost(
      { capability: balance.adventurer.capabilityMax, tenureYears: balance.adventurer.tenureYearsMax },
      RECRUIT_CONFIG,
    );
    const cheapestExpansionCost = Math.min(
      ...GUILD_CONFIG.guildTiers.filter((tier) => tier.cost > 0).map((tier) => tier.cost),
    );

    // Act & Assert
    expect(cheapestExpansionCost).toBeGreaterThan(maxPossibleRecruitCost);
  });
});
