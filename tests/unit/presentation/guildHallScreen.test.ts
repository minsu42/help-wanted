/**
 * @vitest-environment happy-dom
 *
 * 길드 홀 화면 상호작용 테스트.
 *
 * `GameState`는 필요한 필드만 손으로 채운 객체다 — `GameConfig`/`balance.json`을
 * 조립하지 않는다. `RumorConfig`/`GuildConfig`/`GradeThresholds`/`TextBank`도 이
 * 파일이 직접 스텁으로 몬다. 이 화면이 `resolveHallAttendance`를 직접 부르지 않고
 * `state.hallAttendance`만 읽는다는 경계, 그리고 재대화 차단이 `state.talkedToday`
 * (화면 로컬이 아니라 세션 상태)에서 온다는 것이 이 파일이 고정하는 핵심 회귀 조건이다.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { recruitCost, type GuildConfig } from "../../../src/domain/guild";
import type { GameState } from "../../../src/domain/gameState";
import { createRng } from "../../../src/domain/rng";
import type { RumorConfig } from "../../../src/domain/rumor";
import type { TextBank } from "../../../src/domain/text";
import type { Adventurer, Client, Contract, Fact, GradeThresholds } from "../../../src/domain/types";
import {
  mountGuildHallScreen,
  type GuildHallScreenDeps,
} from "../../../src/presentation/ui/GuildHallScreen";

const GRADES: GradeThresholds = { steady: 25, skilled: 50, veteran: 75 };

const RUMOR: RumorConfig = {
  trustThresholdDefault: 0.4,
  trustThresholdCautious: 0.6,
  trustThresholdLoyal: 0.2,
  traitDistortion: 0.15,
  greedyPrice: 20,
};

const GUILD: GuildConfig = {
  recruit: { costBase: 80, costPerCapability: 2, costPerTenure: 15, initialTrust: 0.25 },
  guildTiers: [
    { tier: 1, rosterCap: 2, hallAttendanceMax: 4, concurrentContracts: 2, cost: 0 },
    { tier: 2, rosterCap: 4, hallAttendanceMax: 5, concurrentContracts: 3, cost: 400 },
    { tier: 3, rosterCap: 6, hallAttendanceMax: 6, concurrentContracts: 4, cost: 900 },
  ],
};

/** 결정론 확보를 위한 최소 문안. 변형이 하나뿐이라 rng와 무관하다. */
const TEXT: TextBank = {
  situations: {
    rumorTold: {
      _vars: ["name", "client", "risk"],
      lines: { default: ["{name}이 말했다: {client} 위험도 {risk}"] },
    },
    rumorRefused: {
      _vars: ["name"],
      lines: { default: ["{name}이 입을 다물었다"] },
    },
    recruitGreeting: {
      _vars: ["name"],
      lines: { default: ["{name}이 합류했다"] },
    },
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
    id: `client-${idCounter}`,
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
    realRisk: 100,
    concealment: 0.2,
    baseReward: 100,
    maxPartySize: 2,
    durationDays: 2,
    isTemptation: false,
    facts: [],
    ...overrides,
  };
}

function makeFact(contractId: string, kind: Fact["kind"] = "realRisk"): Fact {
  return { id: `${contractId}:${kind}`, contractId, kind };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    day: 3,
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
      knownWealth: new Map(),
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

let root: HTMLElement;
let state: GameState;
let onAdvanceDay: ReturnType<typeof vi.fn<() => void>>;
let onReturnToCounter: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  document.body.innerHTML = "";
  root = document.createElement("div");
  document.body.appendChild(root);

  state = makeState();
  onAdvanceDay = vi.fn<() => void>();
  onReturnToCounter = vi.fn<() => void>();
});

function setRoster(members: Adventurer[]): void {
  state.roster.splice(0, state.roster.length, ...members);
}

function mount(overrides: Partial<GuildHallScreenDeps> = {}) {
  return mountGuildHallScreen(root, {
    state,
    rumor: RUMOR,
    guild: GUILD,
    gradeThresholds: GRADES,
    text: TEXT,
    onAdvanceDay,
    onReturnToCounter,
    ...overrides,
  });
}

function personRow(id: string): HTMLElement {
  const row = root.querySelector<HTMLElement>(`[data-person-id="${id}"]`);
  if (row === null) throw new Error(`행이 없다: ${id}`);
  return row;
}

function talkButton(id: string, pay?: boolean): HTMLButtonElement {
  const selector =
    pay === undefined
      ? `[data-action="talk"][data-id="${id}"]`
      : `[data-action="talk"][data-id="${id}"][data-pay="${pay}"]`;
  const button = root.querySelector<HTMLButtonElement>(selector);
  if (button === null) throw new Error(`대화 버튼이 없다: ${id}`);
  return button;
}

describe("길드 홀 화면 — 출석자 렌더", () => {
  it("test_attendee_shows_name_grade_two_traits_and_affiliation", () => {
    const member = makeAdventurer({ name: "카린", traits: ["talkative", "bitter"], capability: 80 });
    setRoster([member]);
    state.hallAttendance = { guildMemberIds: [member.id], visitorIds: [] };

    mount();

    const row = personRow(member.id);
    expect(row.querySelector(".hall-person__name")?.textContent).toBe("카린");
    expect(row.querySelector(".hall-person__grade")?.textContent).toBe("베테랑");
    expect(row.querySelector(".hall-person__traits")?.textContent).toContain("수다스럽다");
    expect(row.querySelector(".hall-person__traits")?.textContent).toContain("냉소적이다");
    expect(row.querySelector(".hall-person__affiliation")?.textContent).toBe("길드원");
  });

  it("test_guild_member_and_visitor_are_marked_with_different_classes", () => {
    const member = makeAdventurer({ inGuild: true });
    const visitor = makeAdventurer({ inGuild: false });
    setRoster([member, visitor]);
    state.hallAttendance = { guildMemberIds: [member.id], visitorIds: [visitor.id] };

    mount();

    expect(personRow(member.id).classList.contains("hall-person--guild")).toBe(true);
    expect(personRow(visitor.id).classList.contains("hall-person--guild")).toBe(false);
    expect(personRow(visitor.id).classList.contains("hall-person--visitor")).toBe(true);
  });

  it("test_capability_number_never_appears_in_dom", () => {
    const members = [
      makeAdventurer({ capability: 33 }),
      makeAdventurer({ capability: 61 }),
      makeAdventurer({ capability: 77 }),
    ];
    setRoster(members);
    state.hallAttendance = { guildMemberIds: members.map((m) => m.id), visitorIds: [] };

    mount();

    for (const member of members) {
      expect(root.innerHTML).not.toContain(String(member.capability));
    }
    expect(root.querySelectorAll("[data-capability]")).toHaveLength(0);
  });

  it("test_names_are_escaped", () => {
    const member = makeAdventurer({ name: "<script>evil()</script>" });
    setRoster([member]);
    state.hallAttendance = { guildMemberIds: [member.id], visitorIds: [] };

    mount();

    expect(root.querySelector("script")).toBeNull();
    expect(root.innerHTML).toContain("&lt;script&gt;");
  });
});

describe("길드 홀 화면 — 대화", () => {
  it("test_talk_reveals_a_fact_and_updates_knowledge", () => {
    const talker = makeAdventurer({ trust: 0.9, traits: ["loyal", "cautious"] });
    const client = makeClient({ knownBy: [talker.id] });
    const contract = makeContract({ client, facts: [makeFact("ct-1", "realRisk")] });
    setRoster([talker]);
    state.openContracts = [contract];
    state.hallAttendance = { guildMemberIds: [talker.id], visitorIds: [] };

    mount();
    talkButton(talker.id).click();

    const row = personRow(talker.id);
    expect(row.querySelector(".hall-person__reply")?.textContent?.length).toBeGreaterThan(0);
    expect(state.knowledge.discoveredContacts.has(`${talker.id}->${client.id}`)).toBe(true);
    expect(state.knowledge.revealedFacts.has(`ct-1:realRisk`)).toBe(true);
  });

  it("test_heard_facts_records_teller_and_possibly_distorted_stated_value", () => {
    // bitter는 실제보다 부풀려 전한다 — statedValue !== actualValue(realRisk)가 성립해야
    // 결과 대조 화면의 "저 사람 말은 늘 과장이다" 학습 연결이 끊기지 않는다.
    const talker = makeAdventurer({ trust: 0.9, traits: ["bitter", "loyal"] });
    const client = makeClient({ knownBy: [talker.id] });
    const contract = makeContract({ id: "ct-1", realRisk: 100, client, facts: [makeFact("ct-1", "realRisk")] });
    setRoster([talker]);
    state.openContracts = [contract];
    state.hallAttendance = { guildMemberIds: [talker.id], visitorIds: [] };

    mount();
    talkButton(talker.id).click();

    const heard = state.knowledge.heardFacts.get("ct-1:realRisk");
    expect(heard).toBeDefined();
    expect(heard?.tellerId).toBe(talker.id);
    expect(heard?.day).toBe(state.day);
    expect(heard?.statedValue).not.toBe(contract.realRisk);
    expect(heard?.statedValue).toBeCloseTo(100 * (1 + RUMOR.traitDistortion), 8);
  });

  it("test_talked_person_button_is_disabled_and_added_to_talkedToday", () => {
    const talker = makeAdventurer({ trust: 0.9 });
    setRoster([talker]);
    state.hallAttendance = { guildMemberIds: [talker.id], visitorIds: [] };

    mount();
    talkButton(talker.id).click();

    expect(state.talkedToday.has(talker.id)).toBe(true);
    expect(root.querySelector(`[data-action="talk"][data-id="${talker.id}"]`)).toBeNull();
    expect(personRow(talker.id).querySelector(".hall-person__status")?.textContent).toContain(
      "이미 대화했다",
    );
  });

  it("test_reentry_does_not_bypass_talkedToday_block", () => {
    // 재대화 차단이 화면 로컬이 아니라 state.talkedToday에서 온다는 것을 고정한다 —
    // 화면을 다시 mount해도(길드 홀을 나갔다 들어와도) 차단이 유지되어야 한다.
    const talker = makeAdventurer();
    setRoster([talker]);
    state.hallAttendance = { guildMemberIds: [talker.id], visitorIds: [] };
    state.talkedToday.add(talker.id);

    const handle = mount();

    expect(root.querySelector(`[data-action="talk"][data-id="${talker.id}"]`)).toBeNull();
    expect(personRow(talker.id).querySelector(".hall-person__status")).not.toBeNull();

    handle.destroy();
    mount();
    expect(root.querySelector(`[data-action="talk"][data-id="${talker.id}"]`)).toBeNull();
  });

  it("test_greedy_person_offers_pay_and_refuse_choices", () => {
    const talker = makeAdventurer({ traits: ["greedy", "loyal"], trust: 0.9 });
    setRoster([talker]);
    state.hallAttendance = { guildMemberIds: [talker.id], visitorIds: [] };

    mount();

    expect(talkButton(talker.id, true)).not.toBeNull();
    expect(talkButton(talker.id, false)).not.toBeNull();
  });

  it("test_greedy_pay_button_is_disabled_when_funds_are_insufficient", () => {
    const talker = makeAdventurer({ traits: ["greedy", "loyal"], trust: 0.9 });
    setRoster([talker]);
    state.hallAttendance = { guildMemberIds: [talker.id], visitorIds: [] };
    state.funds = RUMOR.greedyPrice - 1;

    mount();

    expect(talkButton(talker.id, true).disabled).toBe(true);
    expect(talkButton(talker.id, false).disabled).toBe(false);
  });
});

describe("길드 홀 화면 — 영입", () => {
  it("test_only_visitors_present_today_are_shown_as_recruit_candidates", () => {
    const guildMember = makeAdventurer({ inGuild: true });
    const visitor = makeAdventurer({ inGuild: false });
    const absentOutsider = makeAdventurer({ inGuild: false });
    setRoster([guildMember, visitor, absentOutsider]);
    state.hallAttendance = { guildMemberIds: [guildMember.id], visitorIds: [visitor.id] };

    mount();

    expect(root.querySelector(`[data-action="recruit"][data-id="${guildMember.id}"]`)).toBeNull();
    expect(root.querySelector(`[data-action="recruit"][data-id="${visitor.id}"]`)).not.toBeNull();
    expect(root.querySelector(`[data-action="recruit"][data-id="${absentOutsider.id}"]`)).toBeNull();
  });

  it("test_successful_recruit_sets_inGuild_and_deducts_exact_cost", () => {
    const visitor = makeAdventurer({ inGuild: false, capability: 20, tenureYears: 1 });
    setRoster([visitor]);
    state.hallAttendance = { guildMemberIds: [], visitorIds: [visitor.id] };
    state.funds = 500;
    const cost = recruitCost(visitor, GUILD.recruit);

    mount();
    root.querySelector<HTMLButtonElement>(`[data-action="recruit"][data-id="${visitor.id}"]`)?.click();

    expect(visitor.inGuild).toBe(true);
    expect(state.funds).toBe(500 - cost);
  });

  it("test_roster_full_disables_recruit_with_its_own_reason", () => {
    const memberA = makeAdventurer({ inGuild: true });
    const memberB = makeAdventurer({ inGuild: true });
    const visitor = makeAdventurer({ inGuild: false });
    setRoster([memberA, memberB, visitor]); // guildTier 1의 rosterCap은 2
    state.hallAttendance = { guildMemberIds: [memberA.id, memberB.id], visitorIds: [visitor.id] };

    mount();

    const button = root.querySelector<HTMLButtonElement>(`[data-action="recruit"][data-id="${visitor.id}"]`);
    expect(button?.disabled).toBe(true);
    const reason = personRow(visitor.id).querySelector(".hall-person__recruit-reason")?.textContent ?? "";
    expect(reason).toContain("정원이 찼습니다");
  });

  it("test_insufficient_funds_disables_recruit_with_a_different_reason", () => {
    const visitor = makeAdventurer({ inGuild: false, capability: 80, tenureYears: 6 });
    setRoster([visitor]);
    state.hallAttendance = { guildMemberIds: [], visitorIds: [visitor.id] };
    state.funds = 1;

    mount();

    const button = root.querySelector<HTMLButtonElement>(`[data-action="recruit"][data-id="${visitor.id}"]`);
    expect(button?.disabled).toBe(true);
    const reason = personRow(visitor.id).querySelector(".hall-person__recruit-reason")?.textContent ?? "";
    expect(reason).toContain("자금이 부족합니다");
    expect(reason).not.toContain("정원이 찼습니다");
  });
});

describe("길드 홀 화면 — 길드 확장", () => {
  it("test_successful_expand_updates_tier_and_funds", () => {
    state.guildTier = 1;
    state.funds = 1000;

    mount();
    root.querySelector<HTMLButtonElement>('[data-action="expand"]')?.click();

    expect(state.guildTier).toBe(2);
    expect(state.funds).toBe(1000 - GUILD.guildTiers[1].cost);
  });

  it("test_expand_is_disabled_at_max_tier", () => {
    state.guildTier = 3;
    state.funds = 100_000;

    mount();

    expect(root.querySelector<HTMLButtonElement>('[data-action="expand"]')).toBeNull();
    expect(root.querySelector(".hall-expand")?.textContent).toContain("이미 최고 등급입니다");
  });

  it("test_expand_is_disabled_when_funds_are_insufficient", () => {
    state.guildTier = 1;
    state.funds = 10;

    mount();

    const button = root.querySelector<HTMLButtonElement>('[data-action="expand"]');
    expect(button?.disabled).toBe(true);
    expect(root.querySelector(".hall-expand__reason")?.textContent).toContain("자금이 부족합니다");
  });
});

describe("길드 홀 화면 — 하루 진행 콜백", () => {
  it("test_return_button_invokes_the_injected_callback", () => {
    mount();
    root.querySelector<HTMLButtonElement>('[data-action="return"]')?.click();
    expect(onReturnToCounter).toHaveBeenCalledTimes(1);
  });

  it("test_end_day_button_invokes_the_injected_callback_without_calling_advanceDay_itself", () => {
    mount();
    root.querySelector<HTMLButtonElement>('[data-action="end-day"]')?.click();
    expect(onAdvanceDay).toHaveBeenCalledTimes(1);
  });
});

describe("길드 홀 화면 — 수명", () => {
  it("test_destroy_clears_dom_and_detaches_listeners", () => {
    const handle = mount();
    handle.destroy();

    expect(root.innerHTML).toBe("");
    root.dispatchEvent(new Event("click", { bubbles: true }));
    expect(onReturnToCounter).not.toHaveBeenCalled();
  });

  it("test_destroy_is_idempotent", () => {
    const handle = mount();
    handle.destroy();
    expect(() => handle.destroy()).not.toThrow();
  });
});
