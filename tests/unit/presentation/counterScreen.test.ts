/**
 * @vitest-environment happy-dom
 *
 * 창구 화면 상호작용 테스트.
 *
 * UI 스토리의 증거는 수동 워크스루도 허용되지만, 자동 테스트로 고정할 수 있는 항목은
 * 고정한다 — 특히 **결렬된 의뢰의 진실이 DOM에 없다**는 회귀 조건은 눈으로 확인하기
 * 어렵고 한번 깨지면 게임의 전제가 무너진다.
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
  type DisclosureStatus,
  type Settlement,
} from "../../../src/presentation/ui/CounterScreen";

const NEGOTIATION: NegotiationConfig = {
  wReward: balance.negotiation.wReward,
  wAdvance: balance.negotiation.wAdvance,
  toleranceBase: balance.negotiation.toleranceBase,
  wealthWeight: balance.negotiation.wealthWeight,
  urgencyWeight: balance.negotiation.urgencyWeight,
  alternativePenalty: balance.negotiation.alternativePenalty,
  disclosureBonus: balance.negotiation.disclosureBonus,
  maxOffers: balance.negotiation.maxOffers,
};

const BOUNDS = {
  rewardMin: balance.negotiation.offerRewardMin,
  rewardMax: balance.negotiation.offerRewardMax,
  step: balance.negotiation.offerStep,
};

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
};

/** 공개 위험도와 실제 위험도가 확연히 다른 의뢰. 은폐 검증의 전제다. */
const STATED_RISK = 40;
const REAL_RISK = 137;
const CONTRACT_ID = "ct-test";

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

function makeContract(client: Client): Contract {
  return {
    id: CONTRACT_ID,
    client,
    statedRisk: STATED_RISK,
    realRisk: REAL_RISK,
    concealment: 0.7,
    baseReward: 60,
    maxPartySize: 2,
    durationDays: 2,
    isTemptation: false,
    facts: [
      { id: `${CONTRACT_ID}:realRisk`, contractId: CONTRACT_ID, kind: "realRisk" },
      { id: `${CONTRACT_ID}:realWealth`, contractId: CONTRACT_ID, kind: "realWealth" },
    ],
  };
}

const LOCKED: DisclosureStatus = {
  allowed: false,
  reason: "이 의뢰의 실제 위험을 아직 모른다.",
};

let root: HTMLElement;
let state: GameState;
let onSettled: ReturnType<typeof vi.fn>;

beforeEach(() => {
  document.body.innerHTML = "";
  root = document.createElement("div");
  document.body.appendChild(root);

  state = createGameState(1234, GAME_CONFIG);
  onSettled = vi.fn();
});

function mount(overrides: Partial<CounterScreenDeps> = {}) {
  return mountCounterScreen(root, {
    state,
    negotiation: NEGOTIATION,
    bounds: BOUNDS,
    text: textBank,
    disclosureStatus: () => LOCKED,
    onSettled: onSettled as unknown as (settlement: Settlement) => void,
    ...overrides,
  });
}

/** 단일 의뢰만 남긴다 — 판정을 예측 가능하게 만든다. */
function withSingleContract(client: Client = makeClient()): Contract {
  const contract = makeContract(client);
  state.openContracts = [contract];
  return contract;
}

function setSlider(field: string, value: number): void {
  const input = root.querySelector<HTMLInputElement>(`input[data-field="${field}"]`);
  if (input === null) throw new Error(`${field} 슬라이더가 없다`);
  input.value = String(value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function clickOffer(): void {
  root.querySelector<HTMLButtonElement>('[data-action="offer"]')?.click();
}

/**
 * 그 상황의 어휘 집합에서 나온 문장인지 확인한다.
 *
 * 문구를 직접 단언하면 Story 017에서 문안을 다듬는 순간 깨진다. AC가 요구하는 것은
 * **지목된 축이 맞는가**이지 특정 단어가 들어 있는가가 아니다.
 */
function linesFor(situation: string, clientName: string): Set<string> {
  const entry = textBank.situations[situation as keyof typeof textBank.situations];
  const all = Object.values(entry.lines as Record<string, readonly string[]>).flat();
  // 실제 render를 쓴다 — 조사 처리까지 화면과 같은 경로를 지나야 비교가 성립한다
  return new Set(all.map((line) => render(line, { client: clientName })));
}

describe("창구 화면 — 렌더", () => {
  it("test_renders_one_card_per_open_contract", () => {
    mount();

    expect(root.querySelectorAll(".contract-card")).toHaveLength(state.openContracts.length);
  });

  it("test_card_shows_the_stated_facts", () => {
    const contract = withSingleContract();
    mount();

    const card = root.querySelector(".contract-card")?.textContent ?? "";
    expect(card).toContain(contract.client.name);
    expect(card).toContain(String(STATED_RISK));
    expect(card).toContain(`${contract.durationDays}일`);
    expect(card).toContain(`${contract.maxPartySize}명`);
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

describe("창구 화면 — 위험 고지 축", () => {
  it("test_locked_toggle_is_disabled_and_states_the_reason", () => {
    // 그냥 회색 버튼이면 플레이어는 버그로 읽는다
    withSingleContract();
    mount();

    const toggle = root.querySelector<HTMLInputElement>('input[data-field="disclose"]');
    expect(toggle?.disabled).toBe(true);
    expect(root.querySelector(".axis__hint--locked")?.textContent).toBe(LOCKED.reason);
  });

  it("test_unlocked_toggle_is_enabled_without_a_reason", () => {
    withSingleContract();
    mount({ disclosureStatus: () => ({ allowed: true }) });

    expect(root.querySelector<HTMLInputElement>('input[data-field="disclose"]')?.disabled).toBe(
      false,
    );
    expect(root.querySelector(".axis__hint--locked")).toBeNull();
  });

  it("test_locked_axis_is_ignored_even_if_the_draft_says_otherwise", () => {
    // UI 상태를 규칙보다 믿으면 안 된다. 잠긴 축은 제안에 실리지 않는다.
    // 고지 보너스가 있었다면 타결됐을 조건을 만들고, 잠긴 채로는 거부되는지 본다.
    const client = makeClient({ wealth: 0, urgency: 0 });
    withSingleContract(client);
    const handle = mount();

    setSlider("advance", 0.7);
    // 잠겨 있어도 초안만 켠다
    const toggle = root.querySelector<HTMLInputElement>('input[data-field="disclose"]');
    if (toggle !== null) {
      toggle.disabled = false;
      toggle.checked = true;
      toggle.dispatchEvent(new Event("input", { bubbles: true }));
    }
    clickOffer();

    expect(onSettled).not.toHaveBeenCalled();
    handle.destroy();
  });
});

describe("창구 화면 — 흥정", () => {
  it("test_readout_updates_without_a_full_rerender", () => {
    // 드래그 중에 전체를 다시 그리면 슬라이더가 손에서 빠져나간다
    const contract = withSingleContract();
    mount();
    const sliderBefore = root.querySelector('input[data-field="reward"]');

    setSlider("reward", 2);

    expect(root.querySelector('[data-readout="reward"]')?.textContent).toContain(
      String(Math.round(contract.baseReward * 2)),
    );
    expect(root.querySelector('input[data-field="reward"]')).toBe(sliderBefore);
  });

  it("test_rejected_offer_shows_the_contested_axis_line", () => {
    // 선불 기여도가 압도적인 제안 → 선불 축이 지목되어야 한다
    const contract = withSingleContract(makeClient({ wealth: 0, urgency: 0 }));
    mount();

    setSlider("advance", 1);
    clickOffer();

    const reply = root.querySelector(".contract-card__reply")?.textContent ?? "";
    expect(linesFor("counterAdvance", contract.client.name).has(reply)).toBe(true);
    expect(linesFor("counterReward", contract.client.name).has(reply)).toBe(false);
  });

  it("test_rejected_offer_contests_reward_when_reward_dominates", () => {
    const contract = withSingleContract(makeClient({ wealth: 0, urgency: 0 }));
    mount();

    setSlider("reward", 3);
    clickOffer();

    const reply = root.querySelector(".contract-card__reply")?.textContent ?? "";
    expect(linesFor("counterReward", contract.client.name).has(reply)).toBe(true);
    expect(linesFor("counterAdvance", contract.client.name).has(reply)).toBe(false);
  });

  it("test_offer_count_is_tracked_on_game_state", () => {
    // 화면에 두면 재진입으로 결렬 규칙을 우회할 수 있다
    withSingleContract(makeClient({ wealth: 0, urgency: 0 }));
    mount();

    setSlider("reward", 3);
    clickOffer();

    expect(state.offersMade[CONTRACT_ID]).toBe(1);
  });

  it("test_second_rejection_breaks_off_and_removes_the_card", () => {
    withSingleContract(makeClient({ wealth: 0, urgency: 0 }));
    mount();

    setSlider("reward", 3);
    clickOffer();
    expect(root.querySelectorAll(".contract-card")).toHaveLength(1);

    clickOffer();

    expect(root.querySelectorAll(".contract-card")).toHaveLength(0);
    expect(state.openContracts.find((c) => c.id === CONTRACT_ID)).toBeUndefined();
    expect(root.querySelector(".counter__broken")?.textContent?.length).toBeGreaterThan(0);
  });

  it("test_broken_negotiation_never_reveals_the_truth", () => {
    // 결렬된 의뢰의 진실이 새면 "알아내는 것"의 값이 0이 된다
    withSingleContract(makeClient({ wealth: 0, urgency: 0 }));
    mount();

    setSlider("reward", 3);
    clickOffer();
    clickOffer();

    expect(root.innerHTML).not.toContain(String(REAL_RISK));
    expect(root.innerHTML).not.toContain("realRisk");
  });

  it("test_accepted_offer_settles_and_reports_the_terms", () => {
    const contract = withSingleContract(makeClient({ wealth: 1, urgency: 1 }));
    mount();

    setSlider("advance", 0.5);
    clickOffer();

    expect(onSettled).toHaveBeenCalledTimes(1);
    const settlement = onSettled.mock.calls[0][0] as Settlement;
    expect(settlement.contract.id).toBe(contract.id);
    expect(settlement.agreedReward).toBeCloseTo(contract.baseReward * 1, 8);
    expect(settlement.advancePaid).toBeCloseTo(contract.baseReward * 0.5, 8);
  });

  it("test_settled_card_hides_the_axes_and_shows_the_stamp", () => {
    withSingleContract(makeClient({ wealth: 1, urgency: 1 }));
    mount();

    clickOffer();

    expect(root.querySelector(".contract-card__stamp")).not.toBeNull();
    expect(root.querySelector('input[data-field="reward"]')).toBeNull();
  });

  it("test_settled_contract_cannot_be_offered_again", () => {
    withSingleContract(makeClient({ wealth: 1, urgency: 1 }));
    mount();

    clickOffer();
    clickOffer();

    expect(onSettled).toHaveBeenCalledTimes(1);
  });
});

describe("창구 화면 — 수명", () => {
  it("test_destroy_clears_dom_and_detaches_listeners", () => {
    withSingleContract(makeClient({ wealth: 0, urgency: 0 }));
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
