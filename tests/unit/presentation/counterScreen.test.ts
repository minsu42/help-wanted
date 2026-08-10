/**
 * @vitest-environment happy-dom
 *
 * 창구 화면 상호작용 테스트 — 대화형 흥정.
 *
 * UI 스토리의 증거는 수동 워크스루도 허용되지만, 자동 테스트로 고정할 수 있는 항목은
 * 고정한다 — 특히 **결렬된 의뢰의 진실이 DOM에 없다**는 회귀 조건은 눈으로 확인하기
 * 어렵고 한번 깨지면 게임의 전제가 무너진다.
 *
 * 이 파일이 검증하지 않는 것: 수용 판정 자체. 그것은 `negotiation.test.ts`의 몫이고,
 * 화면은 선택지를 `Offer`로 번역해 넘기기만 한다. 여기서 보는 것은 **번역이 맞는가**와
 * **규칙이 UI 상태보다 우선하는가**다.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import balance from "../../../src/data/balance.json";
import names from "../../../src/data/names.json";
import textBank from "../../../src/data/text.json";
import { createGameState, type GameConfig, type GameState } from "../../../src/domain/gameState";
import type { NegotiationConfig } from "../../../src/domain/negotiation";
import { render } from "../../../src/domain/text";
import type { Client, Contract } from "../../../src/domain/types";
import {
  mountCounterScreen,
  type CounterScreenDeps,
  type CounterTextBank,
  type DisclosureStatus,
  type Settlement,
} from "../../../src/presentation/ui/CounterScreen";

const NEGOTIATION: NegotiationConfig = {
  wReward: balance.negotiation.wReward,
  toleranceBase: balance.negotiation.toleranceBase,
  wealthWeight: balance.negotiation.wealthWeight,
  urgencyWeight: balance.negotiation.urgencyWeight,
  alternativePenalty: balance.negotiation.alternativePenalty,
  disclosureBonus: balance.negotiation.disclosureBonus,
  maxOffers: balance.negotiation.maxOffers,
};

const MOVES = balance.negotiation.moves;
const TEXT = textBank as CounterTextBank;

const GAME_CONFIG: GameConfig = {
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

/** 공개 위험도와 실제 위험도가 확연히 다른 의뢰. 은폐 검증의 전제다. */
const STATED_RISK = 40;
const REAL_RISK = 137;
const CONTRACT_ID = "ct-test";

/** 허용치를 최소로 만드는 의뢰인. 어떤 요구든 거부하므로 반박 경로를 확정적으로 탄다. */
const STUBBORN: Partial<Client> = { wealth: 0, urgency: 0 };
/** 허용치가 넉넉한 의뢰인. 웬만한 요구를 받아들이므로 타결 경로를 확정적으로 탄다. */
const GENEROUS: Partial<Client> = { wealth: 1, urgency: 1 };

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: `${CONTRACT_ID}-client`,
    name: "요한 그림",
    traits: ["cautious", "loyal"],
    goal: "money",
    trust: 0.3,
    memories: [],
    wealth: 0.5,
    urgency: 0.5,
    hasAlternative: false,
    knownBy: [],
    ...overrides,
  };
}

function makeContract(client: Client, id: string = CONTRACT_ID): Contract {
  return {
    id,
    client,
    questKind: 'legacy',
    slots: new Map(),
    statedRisk: STATED_RISK,
    realRisk: REAL_RISK,
    concealment: 0.7,
    baseReward: 60,
    maxPartySize: 2,
    durationDays: 2,
    isTemptation: false,
    facts: [
      { id: `${id}:realRisk`, contractId: id, kind: "realRisk" },
      { id: `${id}:realWealth`, contractId: id, kind: "realWealth" },
    ],
  };
}

const LOCKED: DisclosureStatus = {
  allowed: false,
  reason: "이 의뢰의 실제 위험을 아직 모른다.",
};
const UNLOCKED: DisclosureStatus = { allowed: true };

let root: HTMLElement;
let state: GameState;
let onSettled: ReturnType<typeof vi.fn>;
let onVisitHall: ReturnType<typeof vi.fn<() => void>>;
let onEndDay: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  document.body.innerHTML = "";
  root = document.createElement("div");
  document.body.appendChild(root);

  state = createGameState(1234, GAME_CONFIG);
  onSettled = vi.fn();
  onVisitHall = vi.fn<() => void>();
  onEndDay = vi.fn<() => void>();
});

function mount(overrides: Partial<CounterScreenDeps> = {}) {
  return mountCounterScreen(root, {
    state,
    negotiation: NEGOTIATION,
    moves: MOVES,
    text: TEXT,
    disclosureStatus: () => LOCKED,
    onSettled: onSettled as unknown as (settlement: Settlement) => void,
    onVisitHall,
    onEndDay,
    ...overrides,
  });
}

/** 단일 의뢰만 남긴다 — 판정을 예측 가능하게 만든다. */
function withSingleContract(client: Client = makeClient()): Contract {
  const contract = makeContract(client);
  state.openContracts = [contract];
  return contract;
}

function moveButton(id: string): HTMLButtonElement | null {
  return root.querySelector<HTMLButtonElement>(`[data-action="move"][data-move="${id}"]`);
}

function playMove(id: string): void {
  const button = moveButton(id);
  if (button === null) throw new Error(`선택지 ${id}가 화면에 없다`);
  button.click();
}

function clientLine(): string {
  return root.querySelector(".booth__line")?.textContent ?? "";
}

/**
 * 그 상황의 어휘 집합에서 나온 문장인지 확인한다.
 *
 * 문구를 직접 단언하면 문안을 다듬는 순간 깨진다. 검증해야 하는 것은
 * **지목된 축이 맞는가**이지 특정 단어가 들어 있는가가 아니다.
 */
function linesFor(situation: string, clientName: string): Set<string> {
  const entry = textBank.situations[situation as keyof typeof textBank.situations];
  const all = Object.values(entry.lines as Record<string, readonly string[]>).flat();
  // 실제 render를 쓴다 — 조사 처리까지 화면과 같은 경로를 지나야 비교가 성립한다
  return new Set(all.map((line) => render(line, { client: clientName })));
}

describe("창구 화면 — 나가는 문", () => {
  it("test_counter_visit_hall_button_calls_the_callback_once", () => {
    // 홀로 가는 문이 창구에만 있다 — 이 버튼이 없으면 정보를 캘 방법이 없고
    // "정보 = 흥정력"의 앞쪽 절반에 도달하지 못한다
    mount();

    root.querySelector<HTMLButtonElement>('[data-action="visit-hall"]')?.click();

    expect(onVisitHall).toHaveBeenCalledTimes(1);
    expect(onEndDay).not.toHaveBeenCalled();
  });

  it("test_counter_end_day_button_calls_the_callback_once", () => {
    mount();

    root.querySelector<HTMLButtonElement>('[data-action="end-day"]')?.click();

    expect(onEndDay).toHaveBeenCalledTimes(1);
    expect(onVisitHall).not.toHaveBeenCalled();
  });
});

describe("창구 화면 — 렌더", () => {
  it("test_counter_seats_one_client_at_a_time", () => {
    // 창구는 한 명씩 마주 앉는 자리다. 카드를 늘어놓으면 대화가 아니라 목록이 된다.
    mount();

    expect(root.querySelectorAll(".booth")).toHaveLength(1);
  });

  it("test_booth_shows_the_stated_facts", () => {
    const contract = withSingleContract();
    mount();

    const booth = root.querySelector(".booth")?.textContent ?? "";
    expect(booth).toContain(contract.client.name);
    expect(booth).toContain(String(STATED_RISK));
    expect(booth).toContain(`${contract.durationDays}일`);
    expect(booth).toContain(`${contract.maxPartySize}명`);
  });

  it("test_booth_opens_with_a_line_from_the_client", () => {
    // 창구에 앉자마자 상대가 말을 건다 — 대화라는 것을 첫 화면이 알려야 한다
    const contract = withSingleContract();
    mount();

    expect(linesFor("clientOpening", contract.client.name).has(clientLine())).toBe(true);
  });

  it("test_real_risk_is_never_rendered", () => {
    // 공개 위험도만 나간다. 실제 위험도는 소문으로 알아내야 하는 것이다.
    withSingleContract();
    mount();

    expect(root.innerHTML).not.toContain(String(REAL_RISK));
  });

  it("test_capability_numbers_do_not_appear", () => {
    // 이 화면은 모험가를 그리지 않는다. 역량 숫자가 새어 나갈 경로 자체가 없어야 한다.
    mount();

    for (const member of state.roster) {
      expect(root.innerHTML).not.toContain(`${member.capability}명`);
    }
    expect(root.querySelectorAll("[data-capability]")).toHaveLength(0);
  });

  it("test_client_name_is_escaped", () => {
    // names.json이 안전한 것은 오늘의 사실이지 구조적 보장이 아니다
    withSingleContract(makeClient({ name: '<img src=x onerror="alert(1)">' }));
    mount();

    expect(root.querySelector("img")).toBeNull();
    expect(root.innerHTML).toContain("&lt;img");
  });
});

describe("창구 화면 — 대기줄", () => {
  it("test_queue_is_hidden_when_only_one_client_waits", () => {
    // 고를 것이 없는 탭 줄은 화면만 먹는다
    withSingleContract();
    mount();

    expect(root.querySelector(".queue")).toBeNull();
  });

  it("test_queue_lists_every_waiting_client", () => {
    state.openContracts = [
      makeContract(makeClient({ id: "c1", name: "첫째" }), "ct-1"),
      makeContract(makeClient({ id: "c2", name: "둘째" }), "ct-2"),
    ];
    mount();

    expect(root.querySelectorAll(".queue__tab")).toHaveLength(2);
  });

  it("test_selecting_a_queued_client_seats_them_at_the_counter", () => {
    state.openContracts = [
      makeContract(makeClient({ id: "c1", name: "첫째" }), "ct-1"),
      makeContract(makeClient({ id: "c2", name: "둘째" }), "ct-2"),
    ];
    mount();

    root.querySelector<HTMLButtonElement>('[data-action="select"][data-contract="ct-2"]')?.click();

    expect(root.querySelector(".booth__client")?.textContent).toBe("둘째");
  });
});

describe("창구 화면 — 위험 고지", () => {
  it("test_locked_disclosure_hides_the_move_and_states_the_reason", () => {
    // 사유 없이 선택지만 사라지면 플레이어는 그런 수가 있다는 것조차 모른다
    withSingleContract();
    mount();

    expect(moveButton("disclose")).toBeNull();
    expect(root.querySelector(".moves__locked")?.textContent).toContain(LOCKED.reason ?? "");
  });

  it("test_unlocked_disclosure_offers_the_move_without_a_reason", () => {
    withSingleContract();
    mount({ disclosureStatus: () => UNLOCKED });

    expect(moveButton("disclose")).not.toBeNull();
    expect(root.querySelector(".moves__locked")).toBeNull();
  });

  it("test_locked_disclosure_is_ignored_even_if_the_button_is_forged", () => {
    // UI 상태를 규칙보다 믿으면 안 된다. 잠긴 축은 어떤 경로로도 제안에 실리지 않는다.
    withSingleContract(makeClient(STUBBORN));
    mount();

    const forged = document.createElement("button");
    forged.dataset.action = "move";
    forged.dataset.move = "disclose";
    root.appendChild(forged);
    forged.click();

    expect(state.offersMade[CONTRACT_ID]).toBeUndefined();
    expect(onSettled).not.toHaveBeenCalled();
  });

  it("test_disclosure_to_a_client_with_alternatives_breaks_off", () => {
    // 정직의 대가다 — 대안이 있는 의뢰인은 부담스러운 조건에 위험까지 알면 다른
    // 길드로 간다. 고지만으로는 결렬되지 않는다 (허용치가 오르므로 오히려 타결된다)
    withSingleContract(makeClient({ ...STUBBORN, hasAlternative: true }));
    mount({ disclosureStatus: () => UNLOCKED });

    playMove("pressRewardHard");
    playMove("disclose");

    expect(root.querySelector(".booth")).toBeNull();
    expect(state.openContracts).toHaveLength(0);
  });
});

describe("창구 화면 — 흥정", () => {
  it("test_a_move_counts_as_one_offer_on_game_state", () => {
    // 화면에 두면 재진입으로 결렬 규칙을 우회할 수 있다
    withSingleContract(makeClient(STUBBORN));
    mount();

    playMove("pressRewardHard");

    expect(state.offersMade[CONTRACT_ID]).toBe(1);
  });

  // 2026-08-09 — 여기 있던 test_rejected_offer_shows_the_contested_axis_line은 삭제했다.
  // 축이 보상 하나뿐이라 "선불이 아니라 보상이 지목된다"를 잴 대상이 없다. 아래 두 개가
  // 남은 규칙(반박은 언제나 보상 축)을 고정한다.
  it("test_rejected_offer_contests_reward_when_reward_dominates", () => {
    const contract = withSingleContract(makeClient(STUBBORN));
    mount();

    playMove("pressRewardHard");

    expect(linesFor("counterReward", contract.client.name).has(clientLine())).toBe(true);
  });

  it("test_contested_axis_is_marked_on_the_terms", () => {
    // 의뢰인의 말과 숫자가 같은 축을 가리켜야 반박이 다음 수의 근거가 된다
    withSingleContract(makeClient(STUBBORN));
    mount();

    playMove("pressRewardHard");

    const contested = root.querySelector(".terms__item--contested")?.textContent ?? "";
    expect(contested).toContain("보상");
  });

  it("test_moves_that_change_nothing_are_not_offered", () => {
    // 보상이 이미 1배인데 "값 이야기는 접겠습니다"가 떠 있으면 선택지가 아니라 소음이다
    withSingleContract();
    mount();

    expect(moveButton("backDownReward")).toBeNull();
  });

  it("test_backing_down_becomes_available_after_pressing_an_axis", () => {
    // 반박을 듣고 물러설 길이 있어야 대화가 성립한다
    withSingleContract(makeClient(STUBBORN));
    mount();

    playMove("pressRewardHard");

    expect(moveButton("backDownReward")).not.toBeNull();
  });

  it("test_backing_down_returns_the_axis_to_neutral", () => {
    withSingleContract(makeClient(STUBBORN));
    mount();

    playMove("pressRewardHard");
    playMove("backDownReward");

    const terms = root.querySelector(".terms")?.textContent ?? "";
    expect(terms).toContain("×1.00");
  });

  it("test_a_playable_move_always_remains_until_the_offers_run_out", () => {
    // Arrange — 선불 축이 빠지면서 남은 축이 보상 하나뿐이 됐다. 조건이 중립이면
    // backDownReward가 사라지므로, takeAsIs의 면제가 막다른 길을 막는 유일한 장치다.
    // 그 면제를 지우면 이 테스트가 깨진다. (CounterScreen.isPlayable 주석 참조)
    withSingleContract(makeClient(STUBBORN));
    mount();

    // Act & Assert — 결렬 직전까지 매 턴 고를 수 있는 수가 남아 있다.
    // 같은 수를 두 번 두면 값이 안 바뀌어 사라지므로 번갈아 둔다 — 그 사라짐 자체가
    // 이 테스트가 지키려는 규칙("조건이 실제로 달라지는 수만 보여준다")이다.
    for (let attempt = 1; attempt < NEGOTIATION.maxOffers; attempt += 1) {
      expect(root.querySelectorAll(".moves button:not([disabled])").length).toBeGreaterThan(0);
      expect(moveButton("takeAsIs")).not.toBeNull();
      playMove(attempt % 2 === 1 ? "pressRewardHard" : "pressReward");
    }
  });

  it("test_running_out_of_offers_breaks_off_and_clears_the_counter", () => {
    withSingleContract(makeClient(STUBBORN));
    mount();

    playMove("pressReward");
    playMove("pressRewardHard");
    expect(root.querySelector(".booth")).not.toBeNull();

    playMove("pressReward");

    expect(state.offersMade[CONTRACT_ID]).toBe(NEGOTIATION.maxOffers);
    expect(root.querySelector(".booth")).toBeNull();
    expect(state.openContracts.find((c) => c.id === CONTRACT_ID)).toBeUndefined();
    expect(root.querySelector(".counter__broken")?.textContent?.length).toBeGreaterThan(0);
  });

  it("test_broken_negotiation_never_reveals_the_truth", () => {
    // 결렬된 의뢰의 진실이 새면 "알아내는 것"의 값이 0이 된다
    withSingleContract(makeClient(STUBBORN));
    mount();

    playMove("pressReward");
    playMove("pressRewardHard");
    playMove("pressReward");

    expect(root.innerHTML).not.toContain(String(REAL_RISK));
    expect(root.innerHTML).not.toContain("realRisk");
  });

  it("test_accepted_offer_settles_and_reports_the_terms", () => {
    const contract = withSingleContract(makeClient(GENEROUS));
    mount();

    playMove("pressReward");

    expect(onSettled).toHaveBeenCalledTimes(1);
    const settlement = onSettled.mock.calls[0][0] as Settlement;
    expect(settlement.contract.id).toBe(contract.id);
    expect(settlement.agreedReward).toBeCloseTo(contract.baseReward * 1.4, 8);
  });

  it("test_taking_the_offer_as_is_settles_at_the_base_terms", () => {
    const contract = withSingleContract(makeClient(GENEROUS));
    mount();

    playMove("takeAsIs");

    const settlement = onSettled.mock.calls[0][0] as Settlement;
    expect(settlement.agreedReward).toBeCloseTo(contract.baseReward, 8);
  });

  it("test_settled_booth_hides_the_moves_and_shows_the_stamp", () => {
    withSingleContract(makeClient(GENEROUS));
    mount();

    playMove("takeAsIs");

    expect(root.querySelector(".booth__stamp")).not.toBeNull();
    expect(root.querySelector(".moves")).toBeNull();
  });

  it("test_settled_contract_cannot_be_negotiated_again", () => {
    withSingleContract(makeClient(GENEROUS));
    mount();

    playMove("takeAsIs");
    // 선택지가 사라졌으므로 위조 버튼으로 다시 시도한다
    const forged = document.createElement("button");
    forged.dataset.action = "move";
    forged.dataset.move = "pressReward";
    root.appendChild(forged);
    forged.click();

    expect(onSettled).toHaveBeenCalledTimes(1);
  });
});

/**
 * 배정 화면에서 「나중에 배정한다」로 돌아온 경우.
 *
 * 화면이 새로 만들어지므로 `talks`는 비어 있다. 조건이 `GameState.settlements`에
 * 남아 있지 않으면 도장까지 찍은 계약이 첫마디부터 다시 시작하는데, `offersMade`가
 * 이미 차 있어 다음 제안이 곧바로 결렬된다 — "열린 채로 유지"가 실질적으로 파기가
 * 된다. 기록: `design/quick-specs/assignment-reluctance-2026-08-09.md` §5
 */
describe("창구 화면 — 타결 조건 보존", () => {
  it("test_settling_records_the_terms_in_session_state", () => {
    // Arrange
    const contract = withSingleContract(makeClient(GENEROUS));
    mount();

    // Act
    playMove("pressReward");

    // Assert
    expect(state.settlements[contract.id]).toEqual({
      agreedReward: contract.baseReward * 1.4,
      discloseRisk: false,
    });
  });

  it("test_remounting_restores_the_settled_terms_without_renegotiating", () => {
    // Arrange — 타결한 뒤 화면을 버리고 다시 만든다(배정 화면을 다녀온 것과 같다)
    const contract = withSingleContract(makeClient(GENEROUS));
    const first = mount();
    playMove("takeAsIs");
    const offersAfterSettle = state.offersMade[contract.id];
    first.destroy();
    onSettled.mockClear();

    // Act
    mount();

    // Assert — 흥정으로 되돌아가지 않고, 제안 횟수도 그대로다
    expect(root.querySelector(".moves")).toBeNull();
    expect(root.querySelector(".booth__stamp")).not.toBeNull();
    expect(state.offersMade[contract.id]).toBe(offersAfterSettle);
  });

  it("test_resuming_a_settled_contract_reports_the_stored_terms", () => {
    // Arrange
    const contract = withSingleContract(makeClient(GENEROUS));
    const first = mount();
    playMove("pressReward");
    first.destroy();
    onSettled.mockClear();
    mount();

    // Act
    root.querySelector<HTMLButtonElement>('[data-action="to-dispatch"]')?.click();

    // Assert
    expect(onSettled).toHaveBeenCalledTimes(1);
    const settlement = onSettled.mock.calls[0][0] as Settlement;
    expect(settlement.contract.id).toBe(contract.id);
    expect(settlement.agreedReward).toBeCloseTo(contract.baseReward * 1.4, 8);
  });

  it("test_resuming_does_not_consume_another_offer", () => {
    // Arrange
    const contract = withSingleContract(makeClient(GENEROUS));
    const first = mount();
    playMove("takeAsIs");
    const offersAfterSettle = state.offersMade[contract.id];
    first.destroy();
    mount();

    // Act
    root.querySelector<HTMLButtonElement>('[data-action="to-dispatch"]')?.click();

    // Assert — 재협상이 아니므로 evaluateOffer를 부르지 않는다
    expect(state.offersMade[contract.id]).toBe(offersAfterSettle);
    expect(state.openContracts).toContain(contract);
  });
});

describe("창구 화면 — 수명", () => {
  it("test_destroy_clears_dom_and_detaches_listeners", () => {
    withSingleContract(makeClient(STUBBORN));
    const handle = mount();

    handle.destroy();

    expect(root.innerHTML).toBe("");
    root.dispatchEvent(new Event("click", { bubbles: true }));
    expect(onSettled).not.toHaveBeenCalled();
  });

  it("test_destroy_is_idempotent", () => {
    const handle = mount();

    handle.destroy();
    expect(() => handle.destroy()).not.toThrow();
  });
});
