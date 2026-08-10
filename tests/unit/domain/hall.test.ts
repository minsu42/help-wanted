import { describe, expect, it } from "vitest";
import balance from "../../../src/data/balance.json";
import { createRng } from "../../../src/domain/rng";
import { resolveHallAttendance, type HallConfig } from "../../../src/domain/hall";
import type { Adventurer, AdventurerStatus } from "../../../src/domain/types";

/** 설정은 balance.json에서 조립한다 — 등급 1 기준. */
const BASE_CONFIG: HallConfig = {
  hallAttendanceMin: balance.rumor.hallAttendanceMin,
  hallAttendanceMax: balance.guildTiers[0].hallAttendanceMax,
  visitorMin: balance.rumor.visitorMin,
  visitorMax: balance.rumor.visitorMax,
};

const SEED = 1234;
const OTHER_SEED = 5678;

/** 픽스처 팩토리 — 인라인 매직 넘버 없이 테스트마다 필요한 모양만 지정한다. */
function makeAdventurer(id: string, overrides: Partial<Adventurer> = {}): Adventurer {
  return {
    id,
    name: id,
    traits: ["talkative", "cautious"],
    goal: "money",
    trust: 0.5,
    memories: [],
    capability: 50,
    status: "available",
    inGuild: true,
    tenureYears: 3,
    ...overrides,
  };
}

function makeRoster(
  guildCount: number,
  visitorCount: number,
  status: AdventurerStatus = "available",
): Adventurer[] {
  const guild = Array.from({ length: guildCount }, (_, i) =>
    makeAdventurer(`guild-${i}`, { inGuild: true, status }),
  );
  const visitors = Array.from({ length: visitorCount }, (_, i) =>
    makeAdventurer(`visitor-${i}`, { inGuild: false, status }),
  );
  return [...guild, ...visitors];
}

describe("resolveHallAttendance", () => {
  it("test_guild_attendance_count_within_configured_range", () => {
    // Arrange — 후보를 넉넉히 둬서 범위가 후보 부족으로 왜곡되지 않게 한다
    const roster = makeRoster(10, 10);

    // Act / Assert
    for (let seed = 0; seed < 100; seed += 1) {
      const result = resolveHallAttendance(roster, createRng(seed), BASE_CONFIG);

      expect(result.guildMemberIds.length).toBeGreaterThanOrEqual(BASE_CONFIG.hallAttendanceMin);
      expect(result.guildMemberIds.length).toBeLessThanOrEqual(BASE_CONFIG.hallAttendanceMax);
    }
  });

  it("test_visitor_attendance_count_within_configured_range", () => {
    const roster = makeRoster(10, 10);

    for (let seed = 0; seed < 100; seed += 1) {
      const result = resolveHallAttendance(roster, createRng(seed), BASE_CONFIG);

      expect(result.visitorIds.length).toBeGreaterThanOrEqual(BASE_CONFIG.visitorMin);
      expect(result.visitorIds.length).toBeLessThanOrEqual(BASE_CONFIG.visitorMax);
    }
  });

  it("test_onMission_adventurers_never_attend", () => {
    // Arrange — 절반은 available, 절반은 onMission
    const roster = [
      ...makeRoster(5, 5, "available"),
      ...Array.from({ length: 5 }, (_, i) =>
        makeAdventurer(`onmission-guild-${i}`, { inGuild: true, status: "onMission" }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makeAdventurer(`onmission-visitor-${i}`, { inGuild: false, status: "onMission" }),
      ),
    ];

    for (let seed = 0; seed < 50; seed += 1) {
      const result = resolveHallAttendance(roster, createRng(seed), BASE_CONFIG);
      const attendees = [...result.guildMemberIds, ...result.visitorIds];

      expect(attendees.some((id) => id.startsWith("onmission-"))).toBe(false);
    }
  });

  it("test_injured_adventurers_never_attend", () => {
    const roster = [
      ...makeRoster(5, 5, "available"),
      ...Array.from({ length: 5 }, (_, i) =>
        makeAdventurer(`injured-guild-${i}`, { inGuild: true, status: "injured", recoversOnWeek: 3 }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makeAdventurer(`injured-visitor-${i}`, {
          inGuild: false,
          status: "injured",
          recoversOnWeek: 3,
        }),
      ),
    ];

    for (let seed = 0; seed < 50; seed += 1) {
      const result = resolveHallAttendance(roster, createRng(seed), BASE_CONFIG);
      const attendees = [...result.guildMemberIds, ...result.visitorIds];

      expect(attendees.some((id) => id.startsWith("injured-"))).toBe(false);
    }
  });

  it("test_dead_adventurers_never_attend", () => {
    const roster = [
      ...makeRoster(5, 5, "available"),
      ...Array.from({ length: 5 }, (_, i) =>
        makeAdventurer(`dead-guild-${i}`, { inGuild: true, status: "dead" }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makeAdventurer(`dead-visitor-${i}`, { inGuild: false, status: "dead" }),
      ),
    ];

    for (let seed = 0; seed < 50; seed += 1) {
      const result = resolveHallAttendance(roster, createRng(seed), BASE_CONFIG);
      const attendees = [...result.guildMemberIds, ...result.visitorIds];

      expect(attendees.some((id) => id.startsWith("dead-"))).toBe(false);
    }
  });

  it("test_same_seed_produces_identical_attendance", () => {
    // Arrange
    const roster = makeRoster(10, 10);

    // Act
    const a = resolveHallAttendance(roster, createRng(SEED), BASE_CONFIG);
    const b = resolveHallAttendance(roster, createRng(SEED), BASE_CONFIG);

    // Assert
    expect(a).toEqual(b);
  });

  it("test_different_seed_produces_different_attendance", () => {
    const roster = makeRoster(10, 10);

    const a = resolveHallAttendance(roster, createRng(SEED), BASE_CONFIG);
    const b = resolveHallAttendance(roster, createRng(OTHER_SEED), BASE_CONFIG);

    expect(a).not.toEqual(b);
  });

  it("test_higher_tier_hall_attendance_max_raises_observed_ceiling", () => {
    // Arrange — 등급 3 상한(6)까지 실제로 뽑힐 수 있을 만큼 후보를 넉넉히 둔다
    const roster = makeRoster(balance.guildTiers[2].hallAttendanceMax + 2, 0);
    const tierThreeConfig: HallConfig = {
      ...BASE_CONFIG,
      hallAttendanceMax: balance.guildTiers[2].hallAttendanceMax,
    };

    let sawTierThreeCeiling = false;
    let exceededTierOneCeiling = false;

    // Act
    for (let seed = 0; seed < 200; seed += 1) {
      const result = resolveHallAttendance(roster, createRng(seed), tierThreeConfig);
      if (result.guildMemberIds.length === balance.guildTiers[2].hallAttendanceMax) {
        sawTierThreeCeiling = true;
      }
      if (result.guildMemberIds.length > BASE_CONFIG.hallAttendanceMax) {
        exceededTierOneCeiling = true;
      }
    }

    // Assert — 등급 1 상한으로는 절대 나올 수 없는 인원수가 실제로 관측된다
    expect(sawTierThreeCeiling).toBe(true);
    expect(exceededTierOneCeiling).toBe(true);
  });

  it("test_insufficient_candidates_returns_all_available_without_throwing", () => {
    // Arrange — hallAttendanceMin(3)보다 적은 1명만 후보로 둔다
    const roster = makeRoster(1, 0);

    // Act / Assert — 던지지 않고, 있는 만큼만 돌려준다
    expect(() => {
      const result = resolveHallAttendance(roster, createRng(SEED), BASE_CONFIG);
      expect(result.guildMemberIds).toEqual(["guild-0"]);
      expect(result.visitorIds).toEqual([]);
    }).not.toThrow();
  });

  it("test_guild_members_and_visitors_are_returned_separately", () => {
    // Arrange
    const roster = makeRoster(10, 10);

    // Act
    const result = resolveHallAttendance(roster, createRng(SEED), BASE_CONFIG);

    // Assert — 두 배열이 소속 규칙을 정확히 지킨다
    for (const id of result.guildMemberIds) {
      expect(id.startsWith("guild-")).toBe(true);
    }
    for (const id of result.visitorIds) {
      expect(id.startsWith("visitor-")).toBe(true);
    }
    // 겹치는 사람이 없다
    const overlap = result.guildMemberIds.filter((id) => result.visitorIds.includes(id));
    expect(overlap).toEqual([]);
  });
});
