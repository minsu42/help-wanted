/**
 * @vitest-environment happy-dom
 *
 * 파견 화면 상호작용 테스트.
 *
 * `onAdvanceDay`가 주입된 콜백이라는 것이 이 테스트 파일의 전제다 — `GameState`는
 * 필요한 필드만 손으로 채운 객체고, `GameConfig`/`balance.json`/`names.json`을 전혀
 * 조립하지 않는다. 시간 진행(`onAdvanceDay`)과 서술 문안(`TextBank`)도 테스트가 직접
 * 스텁으로 몬다. 이 화면이 "회차 진행을 모른다"는 경계를 정확히 지키는지가 이 파일이
 * 고정하는 핵심 회귀 조건이다.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DispatchResult } from "../../../src/domain/dispatch";
import type {
  ActiveDispatch,
  DayReport,
  GameState,
  ResolvedDispatch,
} from "../../../src/domain/gameState";
import { createRng } from "../../../src/domain/rng";
import type { TextBank } from "../../../src/domain/text";
import type { Adventurer, Client, Contract, GradeThresholds } from "../../../src/domain/types";
import type { Settlement } from "../../../src/presentation/ui/CounterScreen";
import {
  mountDispatchScreen,
  type AssignmentRules,
  type DispatchScreenDeps,
} from "../../../src/presentation/ui/DispatchScreen";

/** 두 임계값 모두 이 테스트 파일이 직접 고정한다 — balance.json 현재값과 무관하게
 * 배정 화면의 규칙 자체를 검증하는 경계값 테스트이므로 하드코딩이 옳다. */
const RULES: AssignmentRules = {
  survivalRefusalRisk: 90,
  assignmentTrustThreshold: 0.15,
  gloryVolunteerRisk: 70,
};

const GRADES: GradeThresholds = { steady: 25, skilled: 50, veteran: 75 };

/** 결과 화면 테스트용 최소 서술 문안. 변형이 하나뿐이라 rng와 무관하게 결정론이다. */
const TEXT: TextBank = {
  situations: {
    resultSuccess: { _vars: ["name"], lines: { default: ["{name} 무사 귀환"] } },
    resultInjured: { _vars: ["name"], lines: { default: ["{name} 부상"] } },
    resultDead: { _vars: ["name"], lines: { default: ["{name} 사망"] } },
  },
};

let idCounter = 0;

function makeAdventurer(overrides: Partial<Adventurer> = {}): Adventurer {
  idCounter += 1;
  return {
    id: `adv-${idCounter}`,
    name: `모험가${idCounter}`,
    traits: ["loyal", "cautious"],
    goal: "money",
    trust: 0.5,
    memories: [],
    capability: 50,
    status: "available",
    inGuild: true,
    tenureYears: 2,
    ...overrides,
  };
}

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "client-1",
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

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: "ct-1",
    client: makeClient(),
    statedRisk: 40,
    realRisk: 50,
    concealment: 0.2,
    baseReward: 100,
    maxPartySize: 2,
    durationDays: 2,
    isTemptation: false,
    facts: [],
    ...overrides,
  };
}

function makeSettlement(contract: Contract, overrides: Partial<Settlement> = {}): Settlement {
  return {
    contract,
    offer: { rewardMultiplier: 1, discloseRisk: false },
    agreedReward: contract.baseReward,
    ...overrides,
  };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    day: 1,
    reputation: 10,
    funds: 200,
    guildTier: 1,
    phase: "playing",
    roster: [],
    openContracts: [],
    activeDispatches: [],
    knowledge: {
      discoveredContacts: new Set(),
      revealedFacts: new Set(),
      heardFacts: new Map(),
    },
    rng: createRng(1),
    usedNames: new Set(),
    nextContractId: 0,
    offersMade: {},
    hallAttendance: { guildMemberIds: [], visitorIds: [] },
    talkedToday: new Set(),
    ...overrides,
  };
}

function makeDayReport(resolved: ResolvedDispatch[] = [], overrides: Partial<DayReport> = {}): DayReport {
  return { day: 2, resolved, recovered: [], newContracts: [], phase: "playing", ...overrides };
}

function makeResult(overrides: Partial<DispatchResult> = {}): DispatchResult {
  return {
    outcome: "success",
    ratio: 2,
    uncertainty: 0,
    effective: 2,
    partyCapability: 100,
    realRisk: 50,
    ...overrides,
  };
}

let root: HTMLElement;
let state: GameState;
let onReturnToCounter: ReturnType<typeof vi.fn<() => void>>;
let onAdvanceDay: ReturnType<typeof vi.fn<() => DayReport>>;

beforeEach(() => {
  document.body.innerHTML = "";
  root = document.createElement("div");
  document.body.appendChild(root);

  state = makeState();
  onReturnToCounter = vi.fn<() => void>();
  onAdvanceDay = vi.fn<() => DayReport>();
});


/**
 * `GameState.roster`는 readonly 프로퍼티다 — 명부가 유일한 사람 저장소이므로 통째로
 * 갈아끼우지 못하게 되어 있다. 테스트에서는 제자리 교체로 같은 효과를 낸다.
 */
function setRoster(members: Adventurer[]): void {
  state.roster.splice(0, state.roster.length, ...members);
}

function mount(settlement: Settlement, overrides: Partial<DispatchScreenDeps> = {}) {
  return mountDispatchScreen(root, {
    state,
    settlement,
    gradeThresholds: GRADES,
    assignmentRules: RULES,
    text: TEXT,
    onAdvanceDay,
    onReturnToCounter,
    ...overrides,
  });
}

function checkboxFor(id: string): HTMLInputElement {
  const input = root.querySelector<HTMLInputElement>(`input[data-field="member"][data-id="${id}"]`);
  if (input === null) throw new Error(`체크박스가 없다: ${id}`);
  return input;
}

function toggle(id: string, checked: boolean): void {
  const input = checkboxFor(id);
  input.checked = checked;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function click(action: string): void {
  const button = root.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
  if (button === null) throw new Error(`버튼이 없다: ${action}`);
  button.click();
}

describe("파견 화면 — 렌더", () => {
  it("test_renders_one_row_per_available_member_only", () => {
    const contract = makeContract();
    const available1 = makeAdventurer();
    const available2 = makeAdventurer();
    const onMission = makeAdventurer({ status: "onMission" });
    setRoster([available1, available2, onMission]);
    state.openContracts = [contract];

    mount(makeSettlement(contract));

    expect(root.querySelectorAll(".roster-row")).toHaveLength(2);
  });

  it("test_outsiders_are_never_assignable", () => {
    // 외부 모험가가 배정 후보에 섞이면 **영입(Story 015)이 존재할 이유가 사라진다** —
    // 돈을 내고 데려올 필요 없이 아무나 보내면 되기 때문이다.
    const contract = makeContract();
    const member = makeAdventurer({ inGuild: true });
    const outsider = makeAdventurer({ inGuild: false });
    setRoster([member, outsider]);
    state.openContracts = [contract];

    mount(makeSettlement(contract));

    const rows = root.querySelectorAll(".roster-row");
    expect(rows).toHaveLength(1);
    expect(root.innerHTML).not.toContain(outsider.name);
  });

  it("test_capability_number_never_appears_in_dom", () => {
    const contract = makeContract({ statedRisk: 40, baseReward: 100, durationDays: 2, maxPartySize: 2 });
    const members = [
      makeAdventurer({ capability: 33 }),
      makeAdventurer({ capability: 61 }),
      makeAdventurer({ capability: 77 }),
    ];
    setRoster(members);
    state.openContracts = [contract];

    mount(makeSettlement(contract));

    for (const member of members) {
      expect(root.innerHTML).not.toContain(String(member.capability));
    }
    expect(root.querySelectorAll("[data-capability]")).toHaveLength(0);
  });

  it("test_grade_label_is_shown_instead_of_the_number", () => {
    const contract = makeContract();
    const veteran = makeAdventurer({ capability: 80 });
    setRoster([veteran]);
    state.openContracts = [contract];

    mount(makeSettlement(contract));

    expect(root.querySelector(".roster-row__grade")?.textContent).toBe("베테랑");
  });

  it("test_names_are_escaped", () => {
    const client = makeClient({ name: '<img src=x onerror="alert(1)">' });
    const contract = makeContract({ client });
    const member = makeAdventurer({ name: '<script>evil()</script>' });
    setRoster([member]);
    state.openContracts = [contract];

    mount(makeSettlement(contract));

    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector("script")).toBeNull();
    expect(root.innerHTML).toContain("&lt;img");
    expect(root.innerHTML).toContain("&lt;script&gt;");
  });
});

describe("파견 화면 — 배정 거부", () => {
  it("test_low_trust_member_is_disabled_with_a_reason", () => {
    const contract = makeContract();
    const distrustful = makeAdventurer({ trust: 0.1 });
    setRoster([distrustful]);
    state.openContracts = [contract];

    mount(makeSettlement(contract));

    expect(checkboxFor(distrustful.id).disabled).toBe(true);
    expect(root.querySelector(".roster-row__reason")?.textContent?.length).toBeGreaterThan(0);
  });

  it("test_survival_goal_refuses_high_risk_contract", () => {
    const contract = makeContract({ statedRisk: 95 }); // > survivalRefusalRisk(90)
    const survivor = makeAdventurer({ goal: "survival", trust: 0.9 });
    setRoster([survivor]);
    state.openContracts = [contract];

    mount(makeSettlement(contract));

    expect(checkboxFor(survivor.id).disabled).toBe(true);
    expect(root.querySelector(".roster-row__reason")?.textContent).toContain("생존");
  });

  it("test_survival_goal_accepts_low_risk_contract", () => {
    const contract = makeContract({ statedRisk: 50 }); // <= survivalRefusalRisk(90)
    const survivor = makeAdventurer({ goal: "survival", trust: 0.9 });
    setRoster([survivor]);
    state.openContracts = [contract];

    mount(makeSettlement(contract));

    expect(checkboxFor(survivor.id).disabled).toBe(false);
  });

  it("test_forced_checked_refused_member_is_not_added_to_selection", () => {
    // UI 상태(체크됨)를 규칙보다 믿으면 안 된다 — disabled를 우회해도 selection에 안 실린다
    const contract = makeContract({ maxPartySize: 1 });
    const distrustful = makeAdventurer({ trust: 0.1 });
    setRoster([distrustful]);
    state.openContracts = [contract];

    mount(makeSettlement(contract));

    const input = checkboxFor(distrustful.id);
    input.disabled = false;
    input.checked = true;
    input.dispatchEvent(new Event("input", { bubbles: true }));

    expect(root.querySelector(".dispatch__count")?.textContent).toContain("0 / 1명");
    const button = root.querySelector<HTMLButtonElement>('[data-action="confirm"]');
    button?.removeAttribute("disabled");
    button?.click();
    expect(distrustful.status).toBe("available");
  });
});

describe("파견 화면 — glory 강조 (힌트, 게이트 아님)", () => {
  it("test_glory_goal_is_highlighted_above_volunteer_threshold", () => {
    const contract = makeContract({ statedRisk: 95 }); // > gloryVolunteerRisk(70)
    const glorious = makeAdventurer({ goal: "glory", trust: 0.9 });
    setRoster([glorious]);
    state.openContracts = [contract];

    mount(makeSettlement(contract));

    expect(root.querySelector(".roster-row--glory")).not.toBeNull();
    expect(root.querySelector(".roster-row__badge")?.textContent).toContain("명예");
  });

  it("test_glory_goal_is_not_highlighted_below_volunteer_threshold", () => {
    const contract = makeContract({ statedRisk: 50 }); // <= gloryVolunteerRisk(70)
    const glorious = makeAdventurer({ goal: "glory", trust: 0.9 });
    setRoster([glorious]);
    state.openContracts = [contract];

    mount(makeSettlement(contract));

    expect(root.querySelector(".roster-row--glory")).toBeNull();
  });

  it("test_glory_highlight_is_independent_of_survival_refusal_threshold", () => {
    // 70 < 위험도 <= 90 구간 — glory는 강조되지만 survival은 거부되지 않는다 (의도된 밴드)
    const contract = makeContract({ statedRisk: 80 });
    const glorious = makeAdventurer({ goal: "glory", trust: 0.9 });
    const survivor = makeAdventurer({ goal: "survival", trust: 0.9 });
    setRoster([glorious, survivor]);
    state.openContracts = [contract];

    mount(makeSettlement(contract));

    expect(checkboxFor(glorious.id).disabled).toBe(false);
    expect(checkboxFor(survivor.id).disabled).toBe(false);
    expect(
      root.querySelector(`[data-id="${glorious.id}"]`)?.closest(".roster-row")?.classList.contains("roster-row--glory"),
    ).toBe(true);
  });
});

describe("파견 화면 — 정원 상한", () => {
  it("test_third_selection_beyond_max_party_size_is_blocked", () => {
    const contract = makeContract({ maxPartySize: 2 });
    const [a, b, c] = [makeAdventurer(), makeAdventurer(), makeAdventurer()];
    setRoster([a, b, c]);
    state.openContracts = [contract];

    mount(makeSettlement(contract));

    toggle(a.id, true);
    toggle(b.id, true);
    expect(root.querySelector(".dispatch__count")?.textContent).toContain("2 / 2명");
    expect(checkboxFor(c.id).disabled).toBe(true);

    // disabled를 우회해도 정원 규칙은 입력 핸들러 내부에서 다시 막는다
    const thirdInput = checkboxFor(c.id);
    thirdInput.disabled = false;
    thirdInput.checked = true;
    thirdInput.dispatchEvent(new Event("input", { bubbles: true }));

    expect(root.querySelector(".dispatch__count")?.textContent).toContain("2 / 2명");
  });
});

describe("파견 화면 — 배정 확정", () => {
  it("test_confirm_is_disabled_until_at_least_one_is_selected", () => {
    const contract = makeContract();
    const member = makeAdventurer();
    setRoster([member]);
    state.openContracts = [contract];

    mount(makeSettlement(contract));

    expect(root.querySelector<HTMLButtonElement>('[data-action="confirm"]')?.disabled).toBe(true);
    toggle(member.id, true);
    expect(root.querySelector<HTMLButtonElement>('[data-action="confirm"]')?.disabled).toBe(false);
  });

  it("test_confirm_click_with_no_selection_does_nothing", () => {
    const contract = makeContract();
    const member = makeAdventurer();
    setRoster([member]);
    state.openContracts = [contract];

    mount(makeSettlement(contract));

    const button = root.querySelector<HTMLButtonElement>('[data-action="confirm"]');
    button?.removeAttribute("disabled");
    button?.click();

    expect(member.status).toBe("available");
    expect(root.querySelector(".dispatch__waiting")).toBeNull();
  });

  it("test_confirm_moves_selected_members_to_onMission_and_shows_duration", () => {
    const contract = makeContract({ durationDays: 3 });
    const member = makeAdventurer();
    setRoster([member]);
    state.openContracts = [contract];

    mount(makeSettlement(contract));
    toggle(member.id, true);
    click("confirm");

    expect(member.status).toBe("onMission");
    expect(root.querySelector(".dispatch__waiting")?.textContent).toContain("3일 남았다");
  });

  it("test_concealed_known_risk_is_true_when_real_risk_known_and_undisclosed", () => {
    const contract = makeContract();
    const member = makeAdventurer();
    setRoster([member]);
    state.openContracts = [contract];
    state.knowledge.revealedFacts.add(`${contract.id}:realRisk`);

    mount(makeSettlement(contract, { offer: { rewardMultiplier: 1, discloseRisk: false } }));
    toggle(member.id, true);
    click("confirm");

    expect(state.activeDispatches).toHaveLength(1);
    expect(state.activeDispatches[0].concealedKnownRisk).toBe(true);
  });

  it("test_concealed_known_risk_is_false_when_disclosed", () => {
    const contract = makeContract();
    const member = makeAdventurer();
    setRoster([member]);
    state.openContracts = [contract];
    state.knowledge.revealedFacts.add(`${contract.id}:realRisk`);

    mount(makeSettlement(contract, { offer: { rewardMultiplier: 1, discloseRisk: true } }));
    toggle(member.id, true);
    click("confirm");

    expect(state.activeDispatches[0].concealedKnownRisk).toBe(false);
  });

  // 회귀 테스트 — 이 화면이 `revealedFacts`만 보고 판정하던 버그를 고정한다.
  // 숨긴 것이 없는 의뢰인에게는 고지할 것도 없으므로 침묵이 성립하지 않는다.
  // 이 케이스가 비어 있어서 27개가 전부 통과하는 상태로 버그가 살아 있었다.
  it("test_dispatch_screen_honest_client_known_risk_is_not_concealment", () => {
    // Arrange — 정직한 의뢰인: 숨긴 것이 없어 실제 == 공개다
    const contract = makeContract({ statedRisk: 50, realRisk: 50, concealment: 0 });
    const member = makeAdventurer();
    setRoster([member]);
    state.openContracts = [contract];
    state.knowledge.revealedFacts.add(`${contract.id}:realRisk`);

    // Act — 사실을 알고 있고 고지하지 않은 채 타결한다
    mount(
      makeSettlement(contract, {
        offer: { rewardMultiplier: 1, discloseRisk: false },
      }),
    );
    toggle(member.id, true);
    click("confirm");

    // Assert — 속인 것이 아니다. trust 대폭 하락이 발동하면 안 된다
    expect(state.activeDispatches[0].concealedKnownRisk).toBe(false);
  });
});

describe("파견 화면 — onAdvanceDay 스텁으로 시간 진행 몰기", () => {
  it("test_onAdvanceDay_stub_drives_time_without_any_gameConfig", () => {
    // 이 테스트가 이 경계의 실익이다 — balance.json도 GameConfig도 조립하지 않고
    // 시간 진행을 완전히 테스트가 통제한다.
    const contract = makeContract({ durationDays: 2 });
    const member = makeAdventurer();
    setRoster([member]);
    state.openContracts = [contract];

    mount(makeSettlement(contract));
    toggle(member.id, true);
    click("confirm");

    const activeDispatch: ActiveDispatch = state.activeDispatches[0];

    onAdvanceDay.mockReturnValueOnce(makeDayReport()); // 1일차 — 아직 안 옴
    click("advance-day");
    expect(onAdvanceDay).toHaveBeenCalledTimes(1);
    expect(root.querySelector(".dispatch__waiting")).not.toBeNull();
    expect(root.querySelector(".result-list")).toBeNull();

    const result = makeResult({ outcome: "success" });
    onAdvanceDay.mockReturnValueOnce(makeDayReport([{ dispatch: activeDispatch, result }]));
    click("advance-day");
    expect(onAdvanceDay).toHaveBeenCalledTimes(2);
    expect(root.querySelector(".result-list")).not.toBeNull();
  });

  it("test_onAdvanceDay_resolution_for_a_different_contract_is_ignored", () => {
    const contract = makeContract();
    const member = makeAdventurer();
    setRoster([member]);
    state.openContracts = [contract];

    mount(makeSettlement(contract));
    toggle(member.id, true);
    click("confirm");

    const unrelated: ActiveDispatch = {
      contract: makeContract({ id: "ct-other" }),
      partyIds: ["adv-other"],
      resolveOnDay: 99,
      agreedReward: 0,
      concealedKnownRisk: false,
    };
    onAdvanceDay.mockReturnValueOnce(
      makeDayReport([{ dispatch: unrelated, result: makeResult() }]),
    );
    click("advance-day");

    expect(root.querySelector(".dispatch__waiting")).not.toBeNull();
  });

  it("test_onAdvanceDay_throwing_is_caught_and_shown_as_ended", () => {
    const contract = makeContract();
    const member = makeAdventurer();
    setRoster([member]);
    state.openContracts = [contract];

    mount(makeSettlement(contract));
    toggle(member.id, true);
    click("confirm");

    onAdvanceDay.mockImplementationOnce(() => {
      throw new Error("이미 끝난 회차다");
    });

    expect(() => click("advance-day")).not.toThrow();
    expect(root.querySelector(".dispatch__return")).not.toBeNull();
  });
});

describe("파견 화면 — 결과 렌더", () => {
  it("test_success_outcome_uses_narrate_and_is_not_dead_colored", () => {
    const contract = makeContract({ durationDays: 1 });
    const member = makeAdventurer({ name: "카린" });
    setRoster([member]);
    state.openContracts = [contract];

    mount(makeSettlement(contract));
    toggle(member.id, true);
    click("confirm");
    const activeDispatch = state.activeDispatches[0];

    onAdvanceDay.mockReturnValueOnce(
      makeDayReport([{ dispatch: activeDispatch, result: makeResult({ outcome: "success" }) }]),
    );
    click("advance-day");

    expect(root.querySelector(".result-row__line")?.textContent).toBe("카린 무사 귀환");
    expect(root.querySelector(".result-row--dead")).toBeNull();
  });

  it("test_death_outcome_is_rendered_with_the_seal_class", () => {
    const contract = makeContract({ durationDays: 1, maxPartySize: 1 });
    const member = makeAdventurer({ name: "발더" });
    setRoster([member]);
    state.openContracts = [contract];

    mount(makeSettlement(contract));
    toggle(member.id, true);
    click("confirm");
    const activeDispatch = state.activeDispatches[0];

    onAdvanceDay.mockReturnValueOnce(
      makeDayReport([
        { dispatch: activeDispatch, result: makeResult({ outcome: "dead", casualtyId: member.id }) },
      ]),
    );
    click("advance-day");

    const deadRow = root.querySelector(".result-row--dead");
    expect(deadRow).not.toBeNull();
    expect(deadRow?.querySelector(".result-row__line")?.textContent).toBe("발더 사망");
  });

  it("test_mixed_party_shows_one_dead_and_one_success_row", () => {
    const contract = makeContract({ durationDays: 1, maxPartySize: 2 });
    const survivor = makeAdventurer({ name: "리아" });
    const casualty = makeAdventurer({ name: "톰" });
    setRoster([survivor, casualty]);
    state.openContracts = [contract];

    mount(makeSettlement(contract));
    toggle(survivor.id, true);
    toggle(casualty.id, true);
    click("confirm");
    const activeDispatch = state.activeDispatches[0];

    onAdvanceDay.mockReturnValueOnce(
      makeDayReport([
        { dispatch: activeDispatch, result: makeResult({ outcome: "dead", casualtyId: casualty.id }) },
      ]),
    );
    click("advance-day");

    expect(root.querySelectorAll(".result-row--dead")).toHaveLength(1);
    expect(root.querySelectorAll(".result-row")).toHaveLength(2);
  });

  it("test_return_button_invokes_the_injected_callback", () => {
    const contract = makeContract({ durationDays: 1 });
    const member = makeAdventurer();
    setRoster([member]);
    state.openContracts = [contract];

    mount(makeSettlement(contract));
    toggle(member.id, true);
    click("confirm");
    const activeDispatch = state.activeDispatches[0];
    onAdvanceDay.mockReturnValueOnce(
      makeDayReport([{ dispatch: activeDispatch, result: makeResult() }]),
    );
    click("advance-day");

    click("return");
    expect(onReturnToCounter).toHaveBeenCalledTimes(1);
  });
});

describe("파견 화면 — 응급 탈출구 (2026-08-09, 로드맵 P0 발견)", () => {
  // 회귀 테스트 — 가용한 길드원이 전부 배정을 거부하면(또는 명부가 비어 있으면)
  // 이 화면에 나갈 방법이 없어 게임이 멈췄다. 확정 버튼은 계속 disabled로 남고,
  // 취소 버튼이 없으면 창구로도 다른 화면으로도 돌아갈 길이 없다.
  it("test_dispatch_screen_abandon_button_exists_even_when_every_member_is_refused", () => {
    const contract = makeContract();
    const distrustful = makeAdventurer({ trust: 0.1 }); // assignmentTrustThreshold(0.15) 미달
    setRoster([distrustful]);
    state.openContracts = [contract];

    mount(makeSettlement(contract));

    expect(checkboxFor(distrustful.id).disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('[data-action="confirm"]')?.disabled).toBe(true);
    expect(root.querySelector('[data-action="return"]')).not.toBeNull();
  });

  it("test_dispatch_screen_abandon_button_exists_when_no_member_is_assignable_at_all", () => {
    const contract = makeContract();
    state.openContracts = [contract];
    setRoster([]); // 명부 자체가 비어 있는 극단 케이스

    mount(makeSettlement(contract));

    expect(root.querySelector(".roster-list__empty")).not.toBeNull();
    expect(root.querySelector('[data-action="return"]')).not.toBeNull();
  });

  it("test_dispatch_screen_abandoning_before_confirm_leaves_the_contract_untouched", () => {
    // 확정 전에 나가면 `dispatchParty`가 아직 호출되지 않았으므로 계약이 여전히
    // `openContracts`에 남아야 한다 — 상태를 건드리지 않는 순수한 취소여야 한다.
    const contract = makeContract();
    const member = makeAdventurer();
    setRoster([member]);
    state.openContracts = [contract];

    mount(makeSettlement(contract));
    toggle(member.id, true); // 선택까지는 했으나 확정은 하지 않는다

    click("return");

    expect(onReturnToCounter).toHaveBeenCalledTimes(1);
    expect(state.openContracts).toEqual([contract]);
    expect(state.activeDispatches).toHaveLength(0);
    expect(member.status).toBe("available");
  });
});

describe("파견 화면 — 수명", () => {
  it("test_destroy_clears_dom_and_detaches_listeners", () => {
    const contract = makeContract();
    const member = makeAdventurer();
    setRoster([member]);
    state.openContracts = [contract];

    const handle = mount(makeSettlement(contract));
    handle.destroy();

    expect(root.innerHTML).toBe("");
    root.dispatchEvent(new Event("click", { bubbles: true }));
    expect(onReturnToCounter).not.toHaveBeenCalled();
  });

  it("test_destroy_is_idempotent", () => {
    const contract = makeContract();
    state.openContracts = [contract];

    const handle = mount(makeSettlement(contract));
    handle.destroy();
    expect(() => handle.destroy()).not.toThrow();
  });
});
