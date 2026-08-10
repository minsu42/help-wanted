/**
 * @vitest-environment happy-dom
 *
 * 결과 대조 화면 테스트.
 *
 * 이 화면은 컨셉의 1순위 설계 리스크("창발이 무작위처럼 느껴짐")에 대한 최종
 * 방어선이므로, 눈으로 보기 쉬운 것("몰랐다"가 빈칸이 아님, 역량 원본 숫자가 절대
 * 새지 않음, 붉은색이 위험·사망·미지급에만 쓰임)을 특히 회귀 테스트로 고정한다.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import balance from "../../../src/data/balance.json";
import textBank from "../../../src/data/text.json";
import { createRng } from "../../../src/domain/rng";
import { render } from "../../../src/domain/text";
import type { DispatchResult } from "../../../src/domain/dispatch";
import type { Adventurer, Client, Contract, GradeThresholds } from "../../../src/domain/types";
import {
  mountOutcomeScreen,
  type HeardFact,
  type OutcomeScreenDeps,
  type ResolvedOutcome,
} from "../../../src/presentation/ui/OutcomeScreen";

const GRADE_THRESHOLDS: GradeThresholds = balance.adventurer.gradeThresholds;
const CERTAINTY_BAND = balance.dispatch.certaintyBand;

const CLIENT_ID = "client-outcome-test";

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: CLIENT_ID,
    name: "요한 그림",
    traits: ["cautious", "loyal"],
    goal: "money",
    trust: 0.3,
    memories: [],
    wealth: 0.2,
    urgency: 0.5,
    hasAlternative: false,
    knownBy: [],
    occupation: 'resident',
    keyLeverage: null,
    ...overrides,
  };
}

function makeContract(client: Client, overrides: Partial<Contract> = {}): Contract {
  return {
    id: "ct-outcome-test",
    client,
    questKind: "legacy",
    scenarioId: "legacy",
    slots: new Map(),
    statedRisk: 40,
    realRisk: 90,
    concealment: 0.5,
    baseReward: 100,
    maxPartySize: 2,
    durationDays: 2,
    isTemptation: false,
    facts: [],
    ...overrides,
  };
}

function makeAdventurer(overrides: Partial<Adventurer> = {}): Adventurer {
  return {
    id: "adv-1",
    name: "카린",
    traits: ["boastful", "talkative"],
    goal: "glory",
    trust: 0.5,
    memories: [],
    capability: 999, // 화면이 이 숫자를 절대 그리면 안 된다 — 눈에 띄는 값으로 잡는다
    status: "available",
    inGuild: true,
    tenureYears: 3,
    ...overrides,
  };
}

function makeResult(overrides: Partial<DispatchResult> = {}): DispatchResult {
  return {
    outcome: "success",
    ratio: 1.2,
    uncertainty: 0,
    effective: 1.2,
    partyCapability: 108,
    realRisk: 90,
    ...overrides,
  };
}

function makeHeardFact(overrides: Partial<HeardFact> = {}): HeardFact {
  return {
    kind: "realRisk",
    statedValue: 60,
    tellerId: "adv-1",
    tellerName: "카린",
    tellerTraits: ["boastful", "talkative"],
    ...overrides,
  };
}

let root: HTMLElement;
let onContinue: ReturnType<typeof vi.fn>;

beforeEach(() => {
  document.body.innerHTML = "";
  root = document.createElement("div");
  document.body.appendChild(root);
  onContinue = vi.fn();
});

function mount(outcome: ResolvedOutcome, overrides: Partial<OutcomeScreenDeps> = {}) {
  return mountOutcomeScreen(root, {
    outcome,
    gradeThresholds: GRADE_THRESHOLDS,
    certaintyBand: CERTAINTY_BAND,
    rng: createRng(1),
    text: textBank,
    onContinue: onContinue as unknown as () => void,
    ...overrides,
  });
}

describe("결과 대조 화면 — 좌변 (알았던 것)", () => {
  it("test_heard_rumor_shows_stated_value_and_teller_name", () => {
    // Arrange
    const client = makeClient();
    const contract = makeContract(client);
    const heard = makeHeardFact({ statedValue: 60, tellerName: "카린" });
    const outcome: ResolvedOutcome = {
      contract,
      result: makeResult(),
      party: [makeAdventurer()],
      concealedKnownRisk: false,
      heardFacts: [heard],
    };

    // Act
    mount(outcome);

    // Assert
    const known = root.querySelector(".outcome__side--known")?.textContent ?? "";
    expect(known).toContain("60");
    expect(known).toContain("카린");
  });

  it("test_no_rumor_is_shown_as_did_not_know_not_blank_or_zero", () => {
    // Arrange
    const contract = makeContract(makeClient());
    const outcome: ResolvedOutcome = {
      contract,
      result: makeResult(),
      party: [makeAdventurer()],
      concealedKnownRisk: false,
      heardFacts: [], // 소문 없이 파견했다
    };

    // Act
    mount(outcome);

    // Assert
    const unknownRows = root.querySelectorAll(".outcome__fact--unknown");
    expect(unknownRows.length).toBeGreaterThanOrEqual(1);
    for (const row of unknownRows) {
      const text = row.textContent ?? "";
      expect(text).toContain("몰랐다");
      // 빈칸이나 0이 아니라 문장으로 표시돼야 한다
      expect(text.trim().endsWith("몰랐다")).toBe(false); // "몰랐다 — ..." 형태로 설명이 붙어 있다
    }
  });
});

describe("결과 대조 화면 — 마진 띠", () => {
  it("test_comfortable_and_risky_ratios_render_different_band_text_without_raw_numbers", () => {
    // Arrange
    const contractComfortable = makeContract(makeClient());
    const outcomeComfortable: ResolvedOutcome = {
      contract: contractComfortable,
      result: makeResult({ ratio: 1.5, effective: 1.5, uncertainty: 0 }),
      party: [makeAdventurer()],
      concealedKnownRisk: false,
      heardFacts: [],
    };

    const contractRisky = makeContract(makeClient());
    const outcomeRisky: ResolvedOutcome = {
      contract: contractRisky,
      result: makeResult({ ratio: 0.9, effective: 0.95, uncertainty: 0.2 }),
      party: [makeAdventurer()],
      concealedKnownRisk: false,
      heardFacts: [],
    };

    // Act
    mount(outcomeComfortable);
    const comfortableBand = root.querySelector(".outcome__band")?.textContent ?? "";
    const comfortableHtml = root.innerHTML;

    document.body.innerHTML = "";
    root = document.createElement("div");
    document.body.appendChild(root);
    mount(outcomeRisky);
    const riskyBand = root.querySelector(".outcome__band")?.textContent ?? "";
    const riskyHtml = root.innerHTML;

    // Assert
    expect(comfortableBand).not.toBe(riskyBand);
    expect(comfortableBand.length).toBeGreaterThan(0);
    expect(riskyBand.length).toBeGreaterThan(0);
    // 숫자가 그대로 렌더되지 않는다
    expect(comfortableHtml).not.toContain("1.5");
    expect(riskyHtml).not.toContain("0.9");
  });
});

describe("결과 대조 화면 — 차이 강조", () => {
  it("test_real_risk_differing_from_belief_gets_a_diff_class", () => {
    // Arrange — statedRisk 40, realRisk 90, 소문도 없었다: 믿음(40)과 실제(90)가 다르다
    const contract = makeContract(makeClient(), { statedRisk: 40, realRisk: 90 });
    const outcome: ResolvedOutcome = {
      contract,
      result: makeResult({ realRisk: 90 }),
      party: [makeAdventurer()],
      concealedKnownRisk: false,
      heardFacts: [],
    };

    // Act
    mount(outcome);

    // Assert
    expect(root.querySelectorAll(".outcome__fact--diff").length).toBeGreaterThan(0);
  });
});

// 2026-08-09 — 「미지급」 절이 여기 있었다. 잔금 미지급 판정이 폐기되면서
// (`roadmap.md` P0 항목 2) 검사할 규칙이 사라졌으므로 삭제하고, 남은 두 갈래를
// 아래가 대신 고정한다. 완수 여부 하나가 지급 여부 전부다.
describe("결과 대조 화면 — 보상 지급", () => {
  it("test_completed_dispatch_reports_the_reward_arrived", () => {
    // Arrange
    const contract = makeContract(makeClient({ wealth: 0.2 }));
    const outcome: ResolvedOutcome = {
      contract,
      result: makeResult({ outcome: "success" }),
      party: [makeAdventurer()],
      concealedKnownRisk: false,
      heardFacts: [],
    };

    // Act — wealth가 낮아도 완수했으면 전액 들어온다
    mount(outcome);

    // Assert
    expect(root.querySelector(".outcome__payment")?.textContent ?? "").toContain("예정대로");
  });

  it("test_death_reports_no_reward_arrived", () => {
    // Arrange
    const contract = makeContract(makeClient());
    const outcome: ResolvedOutcome = {
      contract,
      result: makeResult({ outcome: "dead", casualtyId: "adv-1" }),
      party: [makeAdventurer()],
      concealedKnownRisk: false,
      heardFacts: [],
    };

    // Act
    mount(outcome);

    // Assert
    expect(root.querySelector(".outcome__payment")?.textContent ?? "").toContain("완수하지 못해");
  });
});

describe("결과 대조 화면 — 사망", () => {
  it("test_death_shows_the_casualty_name_and_a_narrated_line", () => {
    // Arrange
    const deceased = makeAdventurer({ id: "adv-dead", name: "발더", traits: ["bitter", "loyal"] });
    const contract = makeContract(makeClient());
    const outcome: ResolvedOutcome = {
      contract,
      result: makeResult({ outcome: "dead", casualtyId: "adv-dead" }),
      party: [deceased],
      concealedKnownRisk: false,
      heardFacts: [],
    };

    // Act
    mount(outcome);

    // Assert
    const death = root.querySelector(".outcome__death")?.textContent ?? "";
    expect(death).toContain("발더");

    const line = root.querySelector(".outcome__death-line")?.textContent ?? "";
    const bank = textBank.situations.resultDead.lines as Record<string, readonly string[]>;
    // 실제 render()를 거친다 — 조사 처리까지 화면과 같은 경로를 지나야 비교가 성립한다
    // (counterScreen.test.ts의 linesFor와 같은 방식)
    const possibleLines = new Set(
      Object.values(bank)
        .flat()
        .map((template) => render(template, { name: "발더" })),
    );
    expect(possibleLines.has(line)).toBe(true);
  });
});

describe("결과 대조 화면 — 역량 불변식", () => {
  it("test_raw_capability_number_never_appears_in_the_dom", () => {
    // Arrange — 999는 위험도·지불여력 어떤 포맷과도 우연히 겹치지 않는 값이다
    const member = makeAdventurer({ capability: 999 });
    const contract = makeContract(makeClient());
    const outcome: ResolvedOutcome = {
      contract,
      result: makeResult({ partyCapability: 999 }),
      party: [member],
      concealedKnownRisk: false,
      heardFacts: [],
    };

    // Act
    mount(outcome);

    // Assert
    expect(root.innerHTML).not.toContain("999");
    expect(root.querySelectorAll("[data-capability]")).toHaveLength(0);
  });
});

describe("결과 대조 화면 — escapeHtml", () => {
  it("test_hostile_name_is_escaped_not_interpreted_as_a_tag", () => {
    // Arrange
    const member = makeAdventurer({ name: '<script>alert(1)</script>' });
    const contract = makeContract(makeClient());
    const outcome: ResolvedOutcome = {
      contract,
      result: makeResult({ outcome: "dead", casualtyId: member.id }),
      party: [member],
      concealedKnownRisk: false,
      heardFacts: [],
    };

    // Act
    mount(outcome);

    // Assert
    expect(root.querySelector("script")).toBeNull();
    expect(root.innerHTML).toContain("&lt;script&gt;");
  });
});

describe("결과 대조 화면 — 수명", () => {
  it("test_continue_button_invokes_the_callback", () => {
    // Arrange
    const contract = makeContract(makeClient());
    const outcome: ResolvedOutcome = {
      contract,
      result: makeResult(),
      party: [makeAdventurer()],
      concealedKnownRisk: false,
      heardFacts: [],
    };
    mount(outcome);

    // Act
    root.querySelector<HTMLButtonElement>('[data-action="continue"]')?.click();

    // Assert
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("test_destroy_clears_dom_and_detaches_listeners", () => {
    // Arrange
    const contract = makeContract(makeClient());
    const outcome: ResolvedOutcome = {
      contract,
      result: makeResult(),
      party: [makeAdventurer()],
      concealedKnownRisk: false,
      heardFacts: [],
    };
    const handle = mount(outcome);

    // Act
    handle.destroy();

    // Assert
    expect(root.innerHTML).toBe("");
    root.dispatchEvent(new Event("click", { bubbles: true }));
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("test_destroy_is_idempotent", () => {
    // Arrange
    const contract = makeContract(makeClient());
    const outcome: ResolvedOutcome = {
      contract,
      result: makeResult(),
      party: [makeAdventurer()],
      concealedKnownRisk: false,
      heardFacts: [],
    };
    const handle = mount(outcome);

    // Act / Assert
    handle.destroy();
    expect(() => handle.destroy()).not.toThrow();
  });
});
