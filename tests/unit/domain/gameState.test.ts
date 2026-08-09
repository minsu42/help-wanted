import { describe, expect, it } from "vitest";
import balance from "../../../src/data/balance.json";
import names from "../../../src/data/names.json";
import {
  advanceDay,
  createGameState,
  currentTier,
  dispatchParty,
  type GameConfig,
  type GameState,
} from "../../../src/domain/gameState";
import type { Adventurer } from "../../../src/domain/types";

/** 설정은 balance.json에서 조립한다 — 테스트가 곧 "수치가 파일에서 온다"의 증거다. */
const CONFIG: GameConfig = {
  totalDays: balance.session.totalDays,
  startingFunds: balance.economy.startingFunds,
  startingReputation: balance.economy.startingReputation,
  injuredDays: balance.dispatch.injuredDays,
  guildTiers: balance.guildTiers,
  names,
  roster: {
    worldRosterSize: balance.world.worldRosterSize,
    startingGuildSize: balance.world.startingGuildSize,
    capabilityMin: balance.adventurer.capabilityMin,
    capabilityMax: balance.adventurer.capabilityMax,
    tenureYearsMin: balance.adventurer.tenureYearsMin,
    tenureYearsMax: balance.adventurer.tenureYearsMax,
    guildInitialTrust: balance.world.guildInitialTrust,
    visitorInitialTrust: balance.recruit.initialTrust,
  },
  contract: {
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
    durationDaysMin: balance.scaling.durationDaysMin,
    durationDaysMax: balance.scaling.durationDaysMax,
    alternativeChance: balance.client.alternativeChance,
    clientInitialTrust: balance.client.initialTrust,
    knownByMin: balance.rumor.knownByMin,
    knownByMax: balance.rumor.knownByMax,
    tenureWeightExponent: balance.rumor.tenureWeightExponent,
    factsPerContract: balance.rumor.factsPerContract,
  },
  dispatch: {
    successRatio: balance.dispatch.successRatio,
    injuryRatio: balance.dispatch.injuryRatio,
    maxUncertainty: balance.dispatch.maxUncertainty,
    certaintyBand: balance.dispatch.certaintyBand,
    casualtyBias: balance.dispatch.casualtyBias,
  },
  economy: {
    repOnSuccess: balance.dispatch.repOnSuccess,
    repOnDeath: balance.dispatch.repOnDeath,
    repInjuryPenalty: balance.dispatch.repInjuryPenalty,
  },
  reputation: {
    trustOnSurvive: balance.rumor.trustOnSurvive,
    trustOnWound: balance.rumor.trustOnWound,
    trustOnDeath: balance.rumor.trustOnDeath,
    trustOnDeceit: balance.rumor.trustOnDeceit,
    dangerThreshold: balance.rumor.dangerMemoryThreshold,
  },
  hall: {
    hallAttendanceMin: balance.rumor.hallAttendanceMin,
    visitorMin: balance.rumor.visitorMin,
    visitorMax: balance.rumor.visitorMax,
  },
};

const SEED = 2024;

/** rng는 클로저라 깊은 비교가 불가능하다. 비교 가능한 부분만 뽑는다. */
function snapshot(state: GameState) {
  return {
    day: state.day,
    reputation: state.reputation,
    funds: state.funds,
    guildTier: state.guildTier,
    phase: state.phase,
    roster: state.roster,
    openContracts: state.openContracts,
    activeDispatches: state.activeDispatches,
    nextContractId: state.nextContractId,
    discoveredContacts: [...state.knowledge.discoveredContacts],
    revealedFacts: [...state.knowledge.revealedFacts],
  };
}

function availableGuildMembers(state: GameState): Adventurer[] {
  return state.roster.filter((member) => member.inGuild && member.status === "available");
}

/** 아무 조작 없이 하루씩 넘긴다. */
function runDays(state: GameState, days: number): void {
  for (let step = 0; step < days && state.phase === "playing"; step += 1) {
    advanceDay(state, CONFIG);
  }
}

describe("createGameState", () => {
  it("test_starting_values_come_from_config", () => {
    const state = createGameState(SEED, CONFIG);

    expect(state.day).toBe(1);
    expect(state.reputation).toBe(CONFIG.startingReputation);
    expect(state.funds).toBe(CONFIG.startingFunds);
    expect(state.guildTier).toBe(1);
    expect(state.phase).toBe("playing");
  });

  it("test_state_holds_world_roster_and_empty_knowledge", () => {
    const state = createGameState(SEED, CONFIG);

    expect(state.roster).toHaveLength(CONFIG.roster.worldRosterSize);
    expect(state.roster.filter((m) => m.inGuild)).toHaveLength(CONFIG.roster.startingGuildSize);
    expect(state.knowledge.discoveredContacts.size).toBe(0);
    expect(state.knowledge.revealedFacts.size).toBe(0);
  });

  it("test_opening_contracts_fill_to_tier_capacity", () => {
    const state = createGameState(SEED, CONFIG);

    expect(state.openContracts).toHaveLength(currentTier(state, CONFIG).concurrentContracts);
  });

  it("test_client_names_do_not_collide_with_roster_names", () => {
    // 명부와 의뢰인이 usedNames를 공유한다 — 동명이인이 생기면 소문에서 화자가 흐려진다
    const state = createGameState(SEED, CONFIG);
    runDays(state, 10);

    const everyone = [
      ...state.roster.map((m) => m.name),
      ...state.openContracts.map((c) => c.client.name),
      ...state.activeDispatches.map((d) => d.contract.client.name),
    ];

    expect(new Set(everyone).size).toBe(everyone.length);
  });

  it("test_two_states_from_the_same_seed_do_not_interfere", () => {
    // rng가 전역이면 한쪽을 진행시켰을 때 다른 쪽이 달라진다
    const a = createGameState(SEED, CONFIG);
    const b = createGameState(SEED, CONFIG);

    runDays(a, 5);

    expect(snapshot(createGameState(SEED, CONFIG))).toEqual(snapshot(b));
  });
});

describe("advanceDay", () => {
  it("test_full_session_is_reproducible_from_the_same_seed", () => {
    // Arrange / Act — 15일 전체를 두 번 굴린다
    const first = createGameState(SEED, CONFIG);
    const second = createGameState(SEED, CONFIG);
    runDays(first, CONFIG.totalDays);
    runDays(second, CONFIG.totalDays);

    // Assert
    expect(snapshot(second)).toEqual(snapshot(first));
  });

  it("test_different_seed_produces_a_different_session", () => {
    const a = createGameState(SEED, CONFIG);
    const b = createGameState(SEED + 1, CONFIG);
    runDays(a, CONFIG.totalDays);
    runDays(b, CONFIG.totalDays);

    expect(snapshot(b)).not.toEqual(snapshot(a));
  });

  it("test_day_increments_by_one", () => {
    const state = createGameState(SEED, CONFIG);

    const report = advanceDay(state, CONFIG);

    expect(state.day).toBe(2);
    expect(report.day).toBe(2);
  });

  it("test_session_ends_after_the_configured_day_count", () => {
    const state = createGameState(SEED, CONFIG);

    // 14번 넘기면 15일차 — 아직 진행 중이어야 한다
    runDays(state, CONFIG.totalDays - 1);
    expect(state.day).toBe(CONFIG.totalDays);
    expect(state.phase).toBe("playing");

    // 한 번 더 넘기면 16일 = 종료
    const final = advanceDay(state, CONFIG);
    expect(state.day).toBe(CONFIG.totalDays + 1);
    expect(final.phase).toBe("ended");
  });

  it("test_ended_session_refuses_to_advance", () => {
    const state = createGameState(SEED, CONFIG);
    runDays(state, CONFIG.totalDays);

    expect(state.phase).toBe("ended");
    expect(() => advanceDay(state, CONFIG)).toThrow(/끝난 회차/);
  });

  it("test_open_contracts_never_exceed_tier_capacity", () => {
    const state = createGameState(SEED, CONFIG);
    const capacity = currentTier(state, CONFIG).concurrentContracts;

    for (let step = 0; step < CONFIG.totalDays; step += 1) {
      expect(state.openContracts.length).toBeLessThanOrEqual(capacity);
      if (state.phase === "ended") break;
      advanceDay(state, CONFIG);
    }
  });

  it("test_raising_the_tier_opens_more_contracts", () => {
    // Edge: 등급을 2로 올리면 다음 날부터 3까지 열린다
    const state = createGameState(SEED, CONFIG);
    expect(state.openContracts).toHaveLength(2);

    state.guildTier = 2;
    const report = advanceDay(state, CONFIG);

    expect(currentTier(state, CONFIG).concurrentContracts).toBe(3);
    expect(state.openContracts).toHaveLength(3);
    expect(report.newContracts.length).toBeGreaterThan(0);
  });

  it("test_contract_ids_are_unique_across_the_session", () => {
    const state = createGameState(SEED, CONFIG);
    const seen: string[] = state.openContracts.map((c) => c.id);

    for (let step = 0; step < CONFIG.totalDays - 1; step += 1) {
      seen.push(...advanceDay(state, CONFIG).newContracts.map((c) => c.id));
    }

    expect(new Set(seen).size).toBe(seen.length);
  });

  it("test_contracts_scale_with_current_reputation", () => {
    // 명성이 압력을 만든다 — 성공할수록 감당 못 할 것이 온다
    const calm = createGameState(SEED, CONFIG);
    const famous = createGameState(SEED, CONFIG);
    famous.reputation = 90;
    famous.openContracts = [];

    const arrivals = advanceDay(famous, CONFIG).newContracts;
    const meanRisk = (contracts: readonly { realRisk: number }[]): number =>
      contracts.reduce((sum, c) => sum + c.realRisk, 0) / contracts.length;

    expect(meanRisk(arrivals)).toBeGreaterThan(meanRisk(calm.openContracts));
  });
});

describe("dispatchParty", () => {
  /** 첫 의뢰에 배정 가능한 길드원 한 명을 보낸다. */
  function sendOne(state: GameState) {
    const contract = state.openContracts[0];
    const member = availableGuildMembers(state)[0];
    return { member, dispatch: dispatchParty(state, contract.id, [member.id]) };
  }

  it("test_dispatch_moves_the_contract_and_marks_the_party", () => {
    const state = createGameState(SEED, CONFIG);
    const openBefore = state.openContracts.length;

    const { member, dispatch } = sendOne(state);

    expect(member.status).toBe("onMission");
    expect(state.openContracts).toHaveLength(openBefore - 1);
    expect(state.activeDispatches).toContain(dispatch);
    expect(dispatch.resolveOnDay).toBe(state.day + dispatch.contract.durationDays);
  });

  it("test_dispatch_stores_agreed_reward_and_concealment_for_later_stories", () => {
    const state = createGameState(SEED, CONFIG);
    const contract = state.openContracts[0];
    const member = availableGuildMembers(state)[0];

    const dispatch = dispatchParty(state, contract.id, [member.id], {
      agreedReward: 120,
      concealedKnownRisk: true,
    });

    expect(dispatch.agreedReward).toBe(120);
    expect(dispatch.concealedKnownRisk).toBe(true);
  });

  it("test_dispatch_defaults_to_no_reward_and_no_concealment", () => {
    const state = createGameState(SEED, CONFIG);

    const { dispatch } = sendOne(state);

    expect(dispatch.agreedReward).toBe(0);
    expect(dispatch.concealedKnownRisk).toBe(false);
  });

  it("test_dispatched_member_cannot_be_dispatched_again", () => {
    const state = createGameState(SEED, CONFIG);
    const { member } = sendOne(state);
    const other = state.openContracts[0];

    expect(() => dispatchParty(state, other.id, [member.id])).toThrow(/배정할 수 없다/);
  });

  it("test_unknown_contract_throws", () => {
    const state = createGameState(SEED, CONFIG);
    const member = availableGuildMembers(state)[0];

    expect(() => dispatchParty(state, "ct-nope", [member.id])).toThrow(/열려 있지 않은/);
  });

  it("test_empty_party_throws", () => {
    const state = createGameState(SEED, CONFIG);

    expect(() => dispatchParty(state, state.openContracts[0].id, [])).toThrow(/빈 파티/);
  });

  it("test_party_over_capacity_throws", () => {
    const state = createGameState(SEED, CONFIG);
    const contract = state.openContracts[0];
    const ids = availableGuildMembers(state)
      .slice(0, contract.maxPartySize + 1)
      .map((m) => m.id);

    expect(() => dispatchParty(state, contract.id, ids)).toThrow(/정원 초과/);
  });

  it("test_duplicate_party_member_throws", () => {
    // Arrange — 시작 명성에서는 2인 의뢰가 거의 안 나온다. 명성을 올려 확실히 만든다.
    // (조건이 안 맞으면 조용히 통과하는 테스트는 테스트가 아니다)
    const famous: GameConfig = { ...CONFIG, startingReputation: 90 };
    const state = createGameState(SEED, famous);
    const contract = state.openContracts.find((c) => c.maxPartySize >= 2);
    const member = availableGuildMembers(state)[0];

    // Assert — 전제부터 검증한다
    expect(contract).toBeDefined();
    expect(() => dispatchParty(state, contract!.id, [member.id, member.id])).toThrow(/두 번/);
  });

  it("test_unknown_member_throws", () => {
    const state = createGameState(SEED, CONFIG);

    expect(() => dispatchParty(state, state.openContracts[0].id, ["adv-nope"])).toThrow(/명부에/);
  });
});

describe("파견 결과가 명부에 반영된다", () => {
  /** 원하는 결과가 나올 때까지 시드를 바꿔가며 회차를 만든다. */
  function sessionEndingIn(outcome: "success" | "injured" | "dead") {
    for (let seed = 0; seed < 400; seed += 1) {
      const state = createGameState(seed, CONFIG);
      const contract = state.openContracts[0];
      const member = availableGuildMembers(state)[0];
      dispatchParty(state, contract.id, [member.id]);

      let report = advanceDay(state, CONFIG);
      while (report.resolved.length === 0 && state.phase === "playing") {
        report = advanceDay(state, CONFIG);
      }
      if (report.resolved[0]?.result.outcome === outcome) {
        return { state, report, memberId: member.id };
      }
    }
    throw new Error(`${outcome} 결과가 나오는 시드를 찾지 못했다`);
  }

  it("test_survivor_returns_to_available", () => {
    const { state, memberId } = sessionEndingIn("success");

    expect(state.roster.find((m) => m.id === memberId)?.status).toBe("available");
    expect(state.activeDispatches).toHaveLength(0);
  });

  it("test_dispatch_is_resolved_on_its_due_day", () => {
    const { report, state } = sessionEndingIn("success");

    expect(report.resolved).toHaveLength(1);
    expect(report.resolved[0].dispatch.resolveOnDay).toBe(state.day);
  });

  it("test_injured_member_recovers_after_the_configured_days", () => {
    const { state, memberId } = sessionEndingIn("injured");
    const casualty = state.roster.find((m) => m.id === memberId);

    expect(casualty?.status).toBe("injured");
    expect(casualty?.recoversOnDay).toBe(state.day + CONFIG.injuredDays);

    // Edge: 회복 하루 전에는 여전히 injured
    runDays(state, CONFIG.injuredDays - 1);
    expect(casualty?.status).toBe("injured");

    // 회복일에 돌아온다
    const report = advanceDay(state, CONFIG);
    expect(report.recovered).toContain(memberId);
    expect(casualty?.status).toBe("available");
    expect(casualty?.recoversOnDay).toBeUndefined();
  });

  it("test_death_is_permanent_for_the_rest_of_the_session", () => {
    const { state, memberId } = sessionEndingIn("dead");
    const casualty = state.roster.find((m) => m.id === memberId);

    expect(casualty?.status).toBe("dead");

    runDays(state, CONFIG.totalDays);

    expect(casualty?.status).toBe("dead");
    expect(casualty?.recoversOnDay).toBeUndefined();
  });

  it("test_dead_member_cannot_be_dispatched_again", () => {
    const { state, memberId } = sessionEndingIn("dead");
    const contract = state.openContracts[0];

    expect(() => dispatchParty(state, contract.id, [memberId])).toThrow(/배정할 수 없다/);
  });
});

describe("경제가 일일 진행에 물려 있다", () => {
  it("test_success_pays_the_full_agreed_reward", () => {
    // Arrange — success 결과가 나올 때까지 시드를 바꿔가며 회차를 만든다
    for (let seed = 0; seed < 400; seed += 1) {
      const state = createGameState(seed, CONFIG);
      const contract = state.openContracts[0];
      const member = availableGuildMembers(state)[0];
      dispatchParty(state, contract.id, [member.id], { agreedReward: 200 });
      const fundsBefore = state.funds;

      let report = advanceDay(state, CONFIG);
      while (report.resolved.length === 0 && state.phase === "playing") {
        report = advanceDay(state, CONFIG);
      }
      if (report.resolved[0]?.result.outcome !== "success") continue;

      // Assert — 완수(success)하면 타결액 전액이 들어온다
      expect(state.funds).toBe(fundsBefore + 200);
      return;
    }
    throw new Error("success 결과가 나오는 시드를 찾지 못했다");
  });

  it("test_reputation_moves_when_a_dispatch_resolves", () => {
    // Arrange — 결과가 날 때까지 시드를 바꿔가며 회차를 만든다
    for (let seed = 0; seed < 200; seed += 1) {
      const state = createGameState(seed, CONFIG);
      const contract = state.openContracts[0];
      const member = availableGuildMembers(state)[0];
      dispatchParty(state, contract.id, [member.id], { agreedReward: 100 });
      const reputationBefore = state.reputation;

      let report = advanceDay(state, CONFIG);
      while (report.resolved.length === 0 && state.phase === "playing") {
        report = advanceDay(state, CONFIG);
      }
      if (report.resolved.length === 0) continue;

      // Assert — 성공/부상은 오르고 사망은 내린다
      const outcome = report.resolved[0].result.outcome;
      if (outcome === "dead") expect(state.reputation).toBeLessThan(reputationBefore);
      else expect(state.reputation).toBeGreaterThan(reputationBefore);
      return;
    }
    throw new Error("판정이 나는 시드를 찾지 못했다");
  });

  it("test_death_never_pays_the_agreed_reward", () => {
    // Arrange — dead 결과가 나올 때까지 시드를 바꿔가며 회차를 만든다
    for (let seed = 0; seed < 400; seed += 1) {
      const state = createGameState(seed, CONFIG);
      const contract = state.openContracts[0];
      const member = availableGuildMembers(state)[0];
      dispatchParty(state, contract.id, [member.id], { agreedReward: 500 });
      const fundsBefore = state.funds;

      let report = advanceDay(state, CONFIG);
      while (report.resolved.length === 0 && state.phase === "playing") {
        report = advanceDay(state, CONFIG);
      }
      if (report.resolved[0]?.result.outcome !== "dead") continue;

      // Assert — 사망이면 타결액은 전혀 들어오지 않는다
      expect(state.funds).toBe(fundsBefore);
      return;
    }
    throw new Error("사망이 나는 시드를 찾지 못했다");
  });
});

describe("currentTier", () => {
  it("test_returns_the_row_for_the_current_tier", () => {
    const state = createGameState(SEED, CONFIG);

    expect(currentTier(state, CONFIG).tier).toBe(1);
    state.guildTier = 3;
    expect(currentTier(state, CONFIG).tier).toBe(3);
  });

  it("test_undefined_tier_throws", () => {
    const state = createGameState(SEED, CONFIG);
    state.guildTier = 99;

    expect(() => currentTier(state, CONFIG)).toThrow(/길드 등급/);
  });
});
