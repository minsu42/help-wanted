import { describe, expect, it } from "vitest";
import balance from "../../src/data/balance.json";
import names from "../../src/data/names.json";
import { createGameState, type GameConfig } from "../../src/domain/gameState";
import { discoveredContactKey, resolveTalk, type RumorConfig } from "../../src/domain/rumor";
import { canDisclose } from "../../src/domain/negotiation";

/**
 * 길드 홀 대화가 실제로 **지식을 만들어내는지**를 회차 수준에서 확인한다.
 *
 * 단위 테스트는 각 조각을 손으로 만든 픽스처로 검증한다. 여기서 확인하는 것은 다른
 * 것이다 — `createGameState`가 만든 **실제 월드**에서 홀에 온 사람들이 실제로 열린
 * 의뢰의 `knownBy`에 걸려서, 대화가 `heardFacts`·`discoveredContacts`를 채우고
 * 위험 고지 축까지 열리는가. 브라우저에서 한 시드를 돌려 보니 인맥이 하나도 밝혀지지
 * 않아, 그것이 그 시드의 우연인지 배선이 끊긴 것인지 가리기 위해 만들었다.
 *
 * 여러 시드를 도는 이유: 한 시드에서 아무도 아는 사람이 없는 것은 정상이다
 * (`knownByMin`/`Max`가 1~2명이고 월드가 22명이므로). 하지만 **모든 시드에서** 그렇다면
 * 배선이 끊긴 것이다.
 */

const CONFIG: GameConfig = {
  totalWeeks: balance.session.totalWeeks,
  clientsPerWeek: balance.session.clientsPerWeek,
  startingFunds: balance.economy.startingFunds,
  startingReputation: balance.economy.startingReputation,
  injuredWeeks: balance.dispatch.injuredWeeks,
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
    durationWeeksMin: balance.scaling.durationWeeksMin,
    durationWeeksMax: balance.scaling.durationWeeksMax,
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
  intakeWallet: balance.intake.wallet,
};

const RUMOR: RumorConfig = {
  trustThresholdDefault: balance.rumor.trustThresholdDefault,
  trustThresholdCautious: balance.rumor.trustThresholdCautious,
  trustThresholdLoyal: balance.rumor.trustThresholdLoyal,
  traitDistortion: balance.rumor.traitDistortion,
  greedyPrice: balance.rumor.greedyPrice,
};

/**
 * 한 시드에서 1일차 홀 출석자 전원과 대화하고, 얻은 것을 지식에 반영한다.
 *
 * `GuildHallScreen`의 `handleTalk`과 **같은 순서로** 반영한다 — 그 화면이 하는 일을
 * 회차 수준에서 재현하는 것이 이 헬퍼의 목적이므로, 어느 한쪽만 바뀌면 이 테스트가
 * 깨져서 알려준다.
 */
function talkToEveryoneOnDayOne(seed: number) {
  const state = createGameState(seed, CONFIG);
  const attendees = [
    ...state.hallAttendance.guildMemberIds,
    ...state.hallAttendance.visitorIds,
  ];

  for (const id of attendees) {
    const talker = state.roster.find((person) => person.id === id);
    if (talker === undefined) continue;

    const result = resolveTalk(talker, state.openContracts, state.rng, RUMOR, {
      payGreedyPrice: true,
    });

    for (const key of result.discoveredContactKeys) {
      state.knowledge.discoveredContacts.add(key);
    }
    for (const fact of result.revealedFacts) {
      state.knowledge.revealedFacts.add(fact.factId);
      state.knowledge.heardFacts.set(fact.factId, {
        statedValue: fact.statedValue,
        tellerId: fact.tellerId,
        week: state.week,
      });
    }
  }

  return { state, attendees };
}

const SEEDS = [1, 2, 3, 7, 11, 42, 99, 1234, 20260808, 777777];

describe("길드 홀 대화 → 지식 (integration: hall → rumor → knowledge)", () => {
  it("test_hall_talks_discover_contacts_in_at_least_one_seed", () => {
    // 한 시드에서 아무도 못 얻는 것은 정상이다. 모든 시드에서 그렇다면 배선이 끊긴 것이다.
    const seedsWithContacts = SEEDS.filter(
      (seed) => talkToEveryoneOnDayOne(seed).state.knowledge.discoveredContacts.size > 0,
    );

    expect(seedsWithContacts.length).toBeGreaterThan(0);
  });

  it("test_hall_talks_reveal_facts_in_at_least_one_seed", () => {
    const seedsWithFacts = SEEDS.filter(
      (seed) => talkToEveryoneOnDayOne(seed).state.knowledge.revealedFacts.size > 0,
    );

    expect(seedsWithFacts.length).toBeGreaterThan(0);
  });

  it("test_revealed_facts_and_heardFacts_stay_in_lockstep", () => {
    // 하나만 채우면 축은 열리는데 결과 화면에 화자가 안 나오는 식으로 조용히 어긋난다
    for (const seed of SEEDS) {
      const { state } = talkToEveryoneOnDayOne(seed);

      expect(state.knowledge.heardFacts.size).toBe(state.knowledge.revealedFacts.size);
      for (const factId of state.knowledge.revealedFacts) {
        expect(state.knowledge.heardFacts.has(factId)).toBe(true);
      }
    }
  });

  it("test_heard_fact_teller_is_a_real_person_in_the_roster", () => {
    // 결과 대조 화면이 화자 id를 이름으로 푸는 데 실패하면 좌변이 조용히 비어버린다
    for (const seed of SEEDS) {
      const { state } = talkToEveryoneOnDayOne(seed);

      for (const heard of state.knowledge.heardFacts.values()) {
        expect(state.roster.some((person) => person.id === heard.tellerId)).toBe(true);
      }
    }
  });

  it("test_discovered_contact_keys_match_the_documented_format", () => {
    for (const seed of SEEDS) {
      const { state } = talkToEveryoneOnDayOne(seed);

      for (const key of state.knowledge.discoveredContacts) {
        const [talkerId, clientId] = key.split("->");
        expect(discoveredContactKey(talkerId, clientId)).toBe(key);
        expect(state.roster.some((person) => person.id === talkerId)).toBe(true);
      }
    }
  });

  it("test_disclosure_axis_opens_in_at_least_one_seed_after_talking", () => {
    // 이것이 "정보 = 흥정력"이 실제로 성립하는지에 대한 회차 수준 증거다.
    // 열리려면 realRisk 사실을 얻고 **그 의뢰가 은폐 중**이어야 한다.
    const seedsWithOpenAxis = SEEDS.filter((seed) => {
      const { state } = talkToEveryoneOnDayOne(seed);
      return state.openContracts.some(
        (contract) => canDisclose(contract, state.knowledge).allowed,
      );
    });

    expect(seedsWithOpenAxis.length).toBeGreaterThan(0);
  });
});
