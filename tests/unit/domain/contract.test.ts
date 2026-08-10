import { describe, expect, it } from "vitest";
import balance from "../../../src/data/balance.json";
import names from "../../../src/data/names.json";
import { createContract, type ContractConfig } from "../../../src/domain/contract";
import { createRng } from "../../../src/domain/rng";
import { createWorldRoster, type RosterConfig } from "../../../src/domain/roster";
import {
  FACT_KINDS,
  GOALS,
  TRAITS,
  type Adventurer,
  type SlotName,
  type SlotTruth,
} from "../../../src/domain/types";

/** 설정은 balance.json에서 조립한다 — 테스트가 곧 "수치가 파일에서 온다"의 증거다. */
const CONFIG: ContractConfig = {
  riskBase: balance.scaling.riskBase,
  riskPerReputation: balance.scaling.riskPerReputation,
  riskSpread: balance.scaling.riskSpread,
  concealmentMin: balance.scaling.concealmentMin,
  concealmentMax: balance.scaling.concealmentMax,
  temptationChance: balance.scaling.temptationChance,
  temptationRiskMultiplier: balance.scaling.temptationRiskMultiplier,
  temptationRewardMultiplier: balance.scaling.temptationRewardMultiplier,
  rewardPerRisk: balance.economy.rewardPerRisk,
  partySizeRiskDivisor: balance.scaling.partySizeRiskDivisor,
  maxPartySizeCap: balance.scaling.maxPartySizeCap,
  durationRiskDivisor: balance.scaling.durationRiskDivisor,
  durationWeeksMin: balance.scaling.durationWeeksMin,
  durationWeeksMax: balance.scaling.durationWeeksMax,
  alternativeChance: balance.client.alternativeChance,
  clientInitialTrust: balance.client.initialTrust,
  knownByMin: balance.rumor.knownByMin,
  knownByMax: balance.rumor.knownByMax,
  tenureWeightExponent: balance.rumor.tenureWeightExponent,
  factsPerContract: balance.rumor.factsPerContract,
};

const ROSTER_CONFIG: RosterConfig = {
  worldRosterSize: balance.world.worldRosterSize,
  startingGuildSize: balance.world.startingGuildSize,
  capabilityMin: balance.adventurer.capabilityMin,
  capabilityMax: balance.adventurer.capabilityMax,
  tenureYearsMin: balance.adventurer.tenureYearsMin,
  tenureYearsMax: balance.adventurer.tenureYearsMax,
  guildInitialTrust: balance.world.guildInitialTrust,
  visitorInitialTrust: balance.recruit.initialTrust,
};

const SEED = 4321;
const OTHER_SEED = 8765;
const STARTING_REPUTATION = balance.economy.startingReputation;

function makeRoster(seed = SEED): Adventurer[] {
  return createWorldRoster(createRng(seed), ROSTER_CONFIG, names);
}

function makeContext(roster: Adventurer[], reputation = STARTING_REPUTATION, id = "ct-1") {
  return { id, reputation, roster, names };
}

/** 한 시드로는 분포를 못 본다. 여러 시드에서 뽑아 모은다. */
function sampleContracts(count: number, reputation = STARTING_REPUTATION) {
  const roster = makeRoster();
  return Array.from({ length: count }, (_, seed) =>
    createContract(createRng(seed), CONFIG, makeContext(roster, reputation, `ct-${seed}`)),
  );
}

describe("createContract", () => {
  it("test_legacy_contract_has_the_new_schema_without_consuming_slot_rng", () => {
    const contract = createContract(createRng(SEED), CONFIG, makeContext(makeRoster()));

    expect(contract.questKind).toBe("legacy");
    expect(contract.slots.size).toBe(0);
  });

  it("test_contract_keeps_injected_slot_truth_separate_from_progress", () => {
    const kind: SlotTruth = {
      knows: "certain",
      tells: "vague",
      valueKey: "quest.kind.investigation",
      weight: 1,
    };
    const slots = new Map<SlotName, SlotTruth>([["kind", kind]]);

    const contract = createContract(createRng(SEED), CONFIG, {
      ...makeContext(makeRoster()),
      questKind: "investigation",
      slots,
    });

    expect(contract.questKind).toBe("investigation");
    expect(contract.slots).toBe(slots);
    expect(contract.slots.get("kind")).toEqual(kind);
    expect(contract).not.toHaveProperty("slotProgress");
  });

  it("test_same_seed_and_reputation_produces_identical_contract", () => {
    // Arrange
    const roster = makeRoster();

    // Act
    const a = createContract(createRng(SEED), CONFIG, makeContext(roster));
    const b = createContract(createRng(SEED), CONFIG, makeContext(roster));

    // Assert
    expect(a).toEqual(b);
  });

  it("test_different_seed_produces_different_contract", () => {
    const roster = makeRoster();

    const a = createContract(createRng(SEED), CONFIG, makeContext(roster));
    const b = createContract(createRng(OTHER_SEED), CONFIG, makeContext(roster));

    expect(a).not.toEqual(b);
  });

  it("test_stated_risk_never_exceeds_real_risk", () => {
    // 은폐폭은 0 이상이므로 의뢰인이 위험을 부풀리는 일은 없다.
    // 이것이 뒤집히면 위험 고지 축의 경제적 근거가 무너진다.
    for (const contract of sampleContracts(200)) {
      expect(contract.statedRisk).toBeLessThanOrEqual(contract.realRisk);
    }
  });

  it("test_honest_client_appears_when_concealment_is_zero", () => {
    // Arrange — 은폐폭을 0으로 고정하면 전원 정직한 의뢰인이다
    const honest: ContractConfig = { ...CONFIG, concealmentMin: 0, concealmentMax: 0 };
    const roster = makeRoster();

    // Act
    const contract = createContract(createRng(SEED), honest, makeContext(roster));

    // Assert — 실제 ≯ 공개이므로 위험 고지 축이 열리지 않아야 한다
    expect(contract.concealment).toBe(0);
    expect(contract.statedRisk).toBeCloseTo(contract.realRisk, 10);
  });

  it("test_concealment_stays_within_configured_range", () => {
    for (const contract of sampleContracts(200)) {
      expect(contract.concealment).toBeGreaterThanOrEqual(CONFIG.concealmentMin);
      expect(contract.concealment).toBeLessThan(CONFIG.concealmentMax);
    }
  });

  it("test_concealment_varies_between_contracts", () => {
    // 고정값이면 모든 의뢰인이 늘 거짓말해서 위험 고지 축이 알기만 하면 무조건 열린다
    const distinct = new Set(sampleContracts(50).map((c) => c.concealment));

    expect(distinct.size).toBeGreaterThan(1);
  });

  it("test_higher_reputation_raises_expected_risk", () => {
    // 명성이 압력을 만든다 — 성공할수록 감당 못 할 것이 온다
    const meanRealRisk = (reputation: number): number => {
      const contracts = sampleContracts(120, reputation).filter((c) => !c.isTemptation);
      return contracts.reduce((sum, c) => sum + c.realRisk, 0) / contracts.length;
    };

    const low = meanRealRisk(10);
    const mid = meanRealRisk(50);
    const high = meanRealRisk(100);

    expect(mid).toBeGreaterThan(low);
    expect(high).toBeGreaterThan(mid);
  });

  it("test_expected_risk_matches_the_documented_curve", () => {
    // 스펙 실측치: 명성 10 ≈ 48, 50 ≈ 102, 100 ≈ 170
    const expectedRisk = (reputation: number): number =>
      CONFIG.riskBase + CONFIG.riskPerReputation * reputation;

    expect(expectedRisk(10)).toBeCloseTo(48.5, 1);
    expect(expectedRisk(50)).toBeCloseTo(102.5, 1);
    expect(expectedRisk(100)).toBeCloseTo(170, 1);
  });

  it("test_real_risk_stays_within_spread_of_expected", () => {
    const reputation = STARTING_REPUTATION;
    const expected = CONFIG.riskBase + CONFIG.riskPerReputation * reputation;

    for (const contract of sampleContracts(200, reputation)) {
      const base = contract.isTemptation ? expected * CONFIG.temptationRiskMultiplier : expected;
      expect(contract.realRisk).toBeGreaterThanOrEqual(base * (1 - CONFIG.riskSpread));
      expect(contract.realRisk).toBeLessThanOrEqual(base * (1 + CONFIG.riskSpread));
    }
  });

  it("test_real_risk_varies_at_the_same_reputation", () => {
    // 결정론적으로 나오면 계산하면 되므로 소문이 무가치해진다
    const distinct = new Set(sampleContracts(50).map((c) => c.realRisk));

    expect(distinct.size).toBeGreaterThan(1);
  });

  it("test_reward_is_derived_from_stated_risk_not_real_risk", () => {
    // 의뢰인은 자기가 인정한 위험만큼만 값을 부른다 — 위험 고지 축의 경제적 근거
    for (const contract of sampleContracts(100).filter((c) => !c.isTemptation)) {
      expect(contract.baseReward).toBeCloseTo(contract.statedRisk * CONFIG.rewardPerRisk, 8);
    }
  });

  it("test_temptation_contract_pays_more_per_unit_of_risk", () => {
    // 위험보다 보상이 더 커야 실제로 유혹이 된다
    const contracts = sampleContracts(300);
    const rate = (c: (typeof contracts)[number]): number => c.baseReward / c.statedRisk;

    const tempting = contracts.filter((c) => c.isTemptation);
    const ordinary = contracts.filter((c) => !c.isTemptation);

    expect(tempting.length).toBeGreaterThan(0);
    expect(ordinary.length).toBeGreaterThan(0);
    expect(Math.min(...tempting.map(rate))).toBeGreaterThan(Math.max(...ordinary.map(rate)));
  });

  it("test_temptation_contract_is_riskier_than_ordinary", () => {
    const contracts = sampleContracts(300);
    const mean = (values: number[]): number => values.reduce((a, b) => a + b, 0) / values.length;

    const tempting = mean(contracts.filter((c) => c.isTemptation).map((c) => c.realRisk));
    const ordinary = mean(contracts.filter((c) => !c.isTemptation).map((c) => c.realRisk));

    expect(tempting).toBeGreaterThan(ordinary);
  });

  it("test_temptation_never_appears_when_chance_is_zero", () => {
    const never: ContractConfig = { ...CONFIG, temptationChance: 0 };
    const roster = makeRoster();

    for (let seed = 0; seed < 50; seed += 1) {
      const contract = createContract(createRng(seed), never, makeContext(roster));
      expect(contract.isTemptation).toBe(false);
    }
  });

  it("test_party_size_and_duration_stay_within_configured_bounds", () => {
    for (const contract of sampleContracts(200)) {
      expect(contract.maxPartySize).toBeGreaterThanOrEqual(1);
      expect(contract.maxPartySize).toBeLessThanOrEqual(CONFIG.maxPartySizeCap);
      expect(Number.isInteger(contract.maxPartySize)).toBe(true);

      expect(contract.durationWeeks).toBeGreaterThanOrEqual(CONFIG.durationWeeksMin);
      expect(contract.durationWeeks).toBeLessThanOrEqual(CONFIG.durationWeeksMax);
      expect(Number.isInteger(contract.durationWeeks)).toBe(true);
    }
  });

  it("test_party_size_and_duration_derive_from_stated_risk", () => {
    for (const contract of sampleContracts(100)) {
      const expectedParty = Math.min(
        CONFIG.maxPartySizeCap,
        Math.max(1, Math.ceil(contract.statedRisk / CONFIG.partySizeRiskDivisor)),
      );
      const expectedDuration = Math.min(
        CONFIG.durationWeeksMax,
        Math.max(
          CONFIG.durationWeeksMin,
          Math.round(contract.statedRisk / CONFIG.durationRiskDivisor),
        ),
      );

      expect(contract.maxPartySize).toBe(expectedParty);
      expect(contract.durationWeeks).toBe(expectedDuration);
    }
  });

  it("test_client_hidden_state_is_within_normalized_bounds", () => {
    for (const contract of sampleContracts(200)) {
      expect(contract.client.wealth).toBeGreaterThanOrEqual(0);
      expect(contract.client.wealth).toBeLessThan(1);
      expect(contract.client.urgency).toBeGreaterThanOrEqual(0);
      expect(contract.client.urgency).toBeLessThan(1);
      expect(typeof contract.client.hasAlternative).toBe("boolean");
    }
  });

  it("test_client_is_a_well_formed_person", () => {
    for (const contract of sampleContracts(50)) {
      const { client } = contract;

      expect(client.traits).toHaveLength(2);
      expect(client.traits[0]).not.toBe(client.traits[1]);
      expect(TRAITS).toContain(client.traits[0]);
      expect(GOALS).toContain(client.goal);
      expect(client.trust).toBe(CONFIG.clientInitialTrust);
      expect(client.memories).toEqual([]);
    }
  });

  it("test_client_name_does_not_collide_with_roster_when_set_is_shared", () => {
    // Arrange — 명부와 의뢰인이 같은 이름 집합을 공유한다
    const usedNames = new Set<string>();
    const roster = createWorldRoster(createRng(SEED), ROSTER_CONFIG, names, usedNames);
    const rosterNames = new Set(roster.map((a) => a.name));

    // Act
    const clientNames = Array.from({ length: 20 }, (_, seed) =>
      createContract(createRng(seed), CONFIG, {
        id: `ct-${seed}`,
        reputation: STARTING_REPUTATION,
        roster,
        names,
        usedNames,
      }).client.name,
    );

    // Assert
    for (const name of clientNames) {
      expect(rosterNames.has(name)).toBe(false);
    }
    expect(new Set(clientNames).size).toBe(clientNames.length);
  });

  it("test_known_by_count_is_within_configured_range", () => {
    for (const contract of sampleContracts(200)) {
      expect(contract.client.knownBy.length).toBeGreaterThanOrEqual(CONFIG.knownByMin);
      expect(contract.client.knownBy.length).toBeLessThanOrEqual(CONFIG.knownByMax);
    }
  });

  it("test_known_by_entries_are_distinct_and_exist_in_roster", () => {
    const roster = makeRoster();
    const rosterIds = new Set(roster.map((a) => a.id));

    for (let seed = 0; seed < 100; seed += 1) {
      const { knownBy } = createContract(createRng(seed), CONFIG, makeContext(roster)).client;

      expect(new Set(knownBy).size).toBe(knownBy.length);
      for (const id of knownBy) {
        expect(rosterIds.has(id)).toBe(true);
      }
    }
  });

  it("test_known_by_is_drawn_from_the_whole_world_pool_not_just_guild", () => {
    // 외부인이 knownBy에 있는 것이 영입 정찰의 근거다
    const roster = makeRoster();
    const outsiders = new Set(roster.filter((a) => !a.inGuild).map((a) => a.id));
    let sawOutsider = false;

    for (let seed = 0; seed < 100 && !sawOutsider; seed += 1) {
      const { knownBy } = createContract(createRng(seed), CONFIG, makeContext(roster)).client;
      sawOutsider = knownBy.some((id) => outsiders.has(id));
    }

    expect(sawOutsider).toBe(true);
  });

  it("test_known_by_favours_long_tenure", () => {
    // Arrange — 근속 8년 1명 vs 근속 1년 20명. 균등이면 8년이 뽑힐 비율은 약 1/21.
    const veteran = adventurer("adv-veteran", 8);
    const rookies = Array.from({ length: 20 }, (_, i) => adventurer(`adv-rookie-${i}`, 1));
    const roster = [veteran, ...rookies];
    const single: ContractConfig = { ...CONFIG, knownByMin: 1, knownByMax: 1 };

    // Act
    let veteranPicks = 0;
    const trials = 1000;
    for (let seed = 0; seed < trials; seed += 1) {
      const { knownBy } = createContract(createRng(seed), single, makeContext(roster)).client;
      if (knownBy.includes(veteran.id)) veteranPicks += 1;
    }

    // Assert — 가중치 8^1.5 ≈ 22.6 vs 20 × 1 = 20 → 기대 비율 ≈ 0.53, 균등은 0.048
    expect(veteranPicks / trials).toBeGreaterThan(0.3);
  });

  it("test_zero_tenure_roster_falls_back_to_uniform_instead_of_throwing", () => {
    // 전원 근속 0년이면 가중치 합이 0이다. 죽은 월드를 만들지 말고 균등으로 물러선다.
    const roster = Array.from({ length: 5 }, (_, i) => adventurer(`adv-${i}`, 0));

    const contract = createContract(createRng(SEED), CONFIG, makeContext(roster));

    expect(contract.client.knownBy.length).toBeGreaterThanOrEqual(CONFIG.knownByMin);
    expect(new Set(contract.client.knownBy).size).toBe(contract.client.knownBy.length);
  });

  it("test_known_by_is_capped_by_roster_size", () => {
    // 명부가 요구 인원보다 작아도 중복을 내지 않는다
    const roster = [adventurer("adv-only", 5)];
    const greedy: ContractConfig = { ...CONFIG, knownByMin: 3, knownByMax: 3 };

    const contract = createContract(createRng(SEED), greedy, makeContext(roster));

    expect(contract.client.knownBy).toEqual(["adv-only"]);
  });

  it("test_empty_roster_yields_a_contract_nobody_knows", () => {
    const contract = createContract(createRng(SEED), CONFIG, makeContext([]));

    expect(contract.client.knownBy).toEqual([]);
  });

  it("test_facts_count_matches_config", () => {
    for (const contract of sampleContracts(20)) {
      expect(contract.facts).toHaveLength(CONFIG.factsPerContract);
    }
  });

  it("test_fact_ids_follow_the_agreed_convention", () => {
    // 협상(#9)과 합의된 규약이다 — 깨지면 위험 고지 축이 열리지 않는다
    const roster = makeRoster();
    const contract = createContract(createRng(SEED), CONFIG, makeContext(roster, 10, "ct-42"));

    for (const fact of contract.facts) {
      expect(fact.id).toBe(`ct-42:${fact.kind}`);
      expect(fact.contractId).toBe("ct-42");
      expect(FACT_KINDS).toContain(fact.kind);
    }
  });

  it("test_facts_cover_both_kinds_at_default_config", () => {
    const roster = makeRoster();
    const contract = createContract(createRng(SEED), CONFIG, makeContext(roster));

    expect(contract.facts.map((f) => f.kind).sort()).toEqual([...FACT_KINDS].sort());
  });

  it("test_real_risk_fact_comes_first_when_facts_are_reduced", () => {
    // 위험 고지 축을 여는 쪽이 더 중요한 정보다
    const single: ContractConfig = { ...CONFIG, factsPerContract: 1 };
    const roster = makeRoster();

    const contract = createContract(createRng(SEED), single, makeContext(roster));

    expect(contract.facts).toHaveLength(1);
    expect(contract.facts[0].kind).toBe("realRisk");
  });
});

/** 근속 연수만 통제하면 되는 테스트용 모험가. 나머지 필드는 판정에 쓰이지 않는다. */
function adventurer(id: string, tenureYears: number): Adventurer {
  return {
    id,
    name: id,
    traits: ["talkative", "cautious"],
    goal: "money",
    trust: 0,
    memories: [],
    capability: 50,
    status: "available",
    inGuild: true,
    tenureYears,
  };
}
