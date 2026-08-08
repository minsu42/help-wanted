import { describe, expect, it } from "vitest";
import balance from "../../../src/data/balance.json";
import names from "../../../src/data/names.json";
import { createRng } from "../../../src/domain/rng";
import { createWorldRoster, type RosterConfig } from "../../../src/domain/roster";
import { GOALS, TRAITS } from "../../../src/domain/types";

/** 설정은 balance.json에서 조립한다 — 테스트가 곧 "수치가 파일에서 온다"의 증거다. */
const CONFIG: RosterConfig = {
  worldRosterSize: balance.world.worldRosterSize,
  startingGuildSize: balance.world.startingGuildSize,
  capabilityMin: balance.adventurer.capabilityMin,
  capabilityMax: balance.adventurer.capabilityMax,
  tenureYearsMin: balance.adventurer.tenureYearsMin,
  tenureYearsMax: balance.adventurer.tenureYearsMax,
  guildInitialTrust: balance.world.guildInitialTrust,
  visitorInitialTrust: balance.recruit.initialTrust,
};

const SEED = 1234;
const OTHER_SEED = 5678;

describe("createWorldRoster", () => {
  it("test_same_seed_produces_identical_roster", () => {
    // Arrange / Act
    const a = createWorldRoster(createRng(SEED), CONFIG, names);
    const b = createWorldRoster(createRng(SEED), CONFIG, names);

    // Assert
    expect(a).toEqual(b);
  });

  it("test_different_seed_produces_different_roster", () => {
    const a = createWorldRoster(createRng(SEED), CONFIG, names);
    const b = createWorldRoster(createRng(OTHER_SEED), CONFIG, names);

    expect(a).not.toEqual(b);
  });

  it("test_roster_size_matches_config", () => {
    const roster = createWorldRoster(createRng(SEED), CONFIG, names);

    expect(roster).toHaveLength(CONFIG.worldRosterSize);
  });

  it("test_guild_member_count_matches_config", () => {
    const roster = createWorldRoster(createRng(SEED), CONFIG, names);

    expect(roster.filter((a) => a.inGuild)).toHaveLength(CONFIG.startingGuildSize);
  });

  it("test_traits_are_two_and_distinct", () => {
    // Arrange — 한 시드로는 조합을 다 못 본다
    for (let seed = 0; seed < 20; seed += 1) {
      const roster = createWorldRoster(createRng(seed), CONFIG, names);

      for (const person of roster) {
        expect(person.traits).toHaveLength(2);
        expect(person.traits[0]).not.toBe(person.traits[1]);
        expect(TRAITS).toContain(person.traits[0]);
        expect(TRAITS).toContain(person.traits[1]);
      }
    }
  });

  it("test_goal_is_from_known_set", () => {
    const roster = createWorldRoster(createRng(SEED), CONFIG, names);

    for (const person of roster) {
      expect(GOALS).toContain(person.goal);
    }
  });

  it("test_capability_and_tenure_within_configured_range", () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const roster = createWorldRoster(createRng(seed), CONFIG, names);

      for (const person of roster) {
        expect(person.capability).toBeGreaterThanOrEqual(CONFIG.capabilityMin);
        expect(person.capability).toBeLessThanOrEqual(CONFIG.capabilityMax);
        expect(person.tenureYears).toBeGreaterThanOrEqual(CONFIG.tenureYearsMin);
        expect(person.tenureYears).toBeLessThanOrEqual(CONFIG.tenureYearsMax);
      }
    }
  });

  it("test_range_boundaries_are_actually_reachable", () => {
    // 경계값이 나올 수 없으면 범위 설정이 거짓말이 된다
    const capabilities = new Set<number>();
    const tenures = new Set<number>();
    for (let seed = 0; seed < 200; seed += 1) {
      for (const person of createWorldRoster(createRng(seed), CONFIG, names)) {
        capabilities.add(person.capability);
        tenures.add(person.tenureYears);
      }
    }

    expect(capabilities.has(CONFIG.capabilityMin)).toBe(true);
    expect(capabilities.has(CONFIG.capabilityMax)).toBe(true);
    // 근속 경계도 실제로 나와야 한다 — knownBy 가중 추출이 tenureYears^1.5를 쓰므로
    // 경계가 안 나오면 정보망 분포가 설계와 달라진다
    expect(tenures.has(CONFIG.tenureYearsMin)).toBe(true);
    expect(tenures.has(CONFIG.tenureYearsMax)).toBe(true);
  });

  it("test_everyone_starts_available_with_no_memories", () => {
    const roster = createWorldRoster(createRng(SEED), CONFIG, names);

    for (const person of roster) {
      expect(person.status).toBe("available");
      expect(person.memories).toEqual([]);
    }
  });

  it("test_trust_differs_between_guild_and_outsider", () => {
    const roster = createWorldRoster(createRng(SEED), CONFIG, names);

    for (const person of roster) {
      const expected = person.inGuild ? CONFIG.guildInitialTrust : CONFIG.visitorInitialTrust;
      expect(person.trust).toBe(expected);
    }
  });

  it("test_names_are_unique_within_roster", () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const roster = createWorldRoster(createRng(seed), CONFIG, names);
      const distinct = new Set(roster.map((a) => a.name));

      expect(distinct.size).toBe(roster.length);
    }
  });

  it("test_exhausted_name_pool_throws", () => {
    // Arrange — 1 × 1 = 조합 1개. 22명을 못 만든다.
    const tinyPool = { given: ["카린"], family: ["벨트"] };

    // Act / Assert — 조용히 중복을 내는 대신 던져야 한다
    expect(() => createWorldRoster(createRng(SEED), CONFIG, tinyPool)).toThrow(/이름 조합/);
  });

  it("test_shared_used_names_prevents_collision_with_outside_callers", () => {
    // Arrange — 의뢰인 생성과 집합을 공유하는 시나리오
    const shared = new Set<string>(["카린 벨트", "요한 그림"]);

    // Act
    const roster = createWorldRoster(createRng(SEED), CONFIG, names, shared);

    // Assert — 미리 점유된 이름은 아무도 쓰지 않는다
    expect(roster.map((a) => a.name)).not.toContain("카린 벨트");
    expect(roster.map((a) => a.name)).not.toContain("요한 그림");
    expect(shared.size).toBe(2 + roster.length);
  });

  it("test_ids_are_unique_within_roster", () => {
    const roster = createWorldRoster(createRng(SEED), CONFIG, names);
    const ids = new Set(roster.map((a) => a.id));

    expect(ids.size).toBe(roster.length);
  });

  it("test_guild_selection_is_not_top_capability", () => {
    // 다 망한 길드다. 역량 상위권이 이미 내 사람이면 영입할 이유가 없어진다.
    let sawNonTopSelection = false;

    for (let seed = 0; seed < 10; seed += 1) {
      const roster = createWorldRoster(createRng(seed), CONFIG, names);
      const topIds = new Set(
        [...roster]
          .sort((a, b) => b.capability - a.capability)
          .slice(0, CONFIG.startingGuildSize)
          .map((a) => a.id),
      );
      const guildIds = roster.filter((a) => a.inGuild).map((a) => a.id);

      if (guildIds.some((id) => !topIds.has(id))) {
        sawNonTopSelection = true;
        break;
      }
    }

    expect(sawNonTopSelection).toBe(true);
  });

  it("test_guild_larger_than_world_throws", () => {
    const broken: RosterConfig = { ...CONFIG, startingGuildSize: CONFIG.worldRosterSize + 1 };

    expect(() => createWorldRoster(createRng(SEED), broken, names)).toThrow();
  });
});
