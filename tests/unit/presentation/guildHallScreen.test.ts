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
 *
 * 홀이 목록에서 **방**으로 바뀌면서 상호작용이 두 단계가 됐다 — 방 안의 사람을 누르면
 * (`select-person`) 하단 대화창이 열리고, 대화·영입 버튼은 그 대화창에만 있다.
 * 그래서 대부분의 테스트가 {@link select}로 시작한다. 사람의 정보가 방에 다 노출돼
 * 있으면 방이 아니라 그냥 세로 목록이므로, 이 두 단계는 의도된 것이다.
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
import layout from "../../../src/data/hall-layout.json";

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
    rumorNothingToTell: {
      _vars: ["name"],
      lines: { default: ["{name}은 아는 것이 없었다"] },
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
    occupation: 'resident',
    keyLeverage: null,
    ...overrides,
  };
}

function makeContract(overrides: Partial<Contract> = {}): Contract {
  return {
    id: "ct-1",
    client: makeClient(),
    questKind: "legacy",
    scenarioId: "legacy",
    slots: new Map(),
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
      slotProgress: new Map(),
    },
    rng: createRng(1),
    usedNames: new Set(),
    nextContractId: 0,
    offersMade: {},
    settlements: {},
    intakeSessions: {},
    commissionSheets: {},
    ratesIntroduced: false,
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

/** 명부와 출석을 한 번에 세운다 — 거의 모든 테스트가 이 둘을 함께 필요로 한다. */
function attend(members: Adventurer[]): void {
  setRoster(members);
  state.hallAttendance = {
    guildMemberIds: members.filter((m) => m.inGuild).map((m) => m.id),
    visitorIds: members.filter((m) => !m.inGuild).map((m) => m.id),
  };
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

/** 방 안의 인물. 없으면 오늘 홀에 오지 않았다는 뜻이다. */
function token(id: string): HTMLButtonElement | null {
  return root.querySelector<HTMLButtonElement>(`[data-action="select-person"][data-person-id="${id}"]`);
}

/** 그 사람에게 말을 걸러 간다. 대화·영입 버튼은 이 다음에야 존재한다. */
function select(id: string): void {
  const button = token(id);
  if (button === null) throw new Error(`방에 그 사람이 없다: ${id}`);
  button.click();
}

/** 하단 대화창. 아무도 고르지 않았으면 안내문만 들어 있다. */
function panel(): HTMLElement {
  const node = root.querySelector<HTMLElement>(".hall-dialogue");
  if (node === null) throw new Error("대화창이 없다");
  return node;
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

function recruitButton(id: string): HTMLButtonElement | null {
  return root.querySelector<HTMLButtonElement>(`[data-action="recruit"][data-id="${id}"]`);
}

describe("길드 홀 화면 — 방", () => {
  it("test_every_attendee_gets_a_token_in_the_room", () => {
    const members = [makeAdventurer(), makeAdventurer(), makeAdventurer()];
    attend(members);

    mount();

    expect(root.querySelectorAll(".hall-token")).toHaveLength(3);
  });

  it("test_absent_people_have_no_token", () => {
    // 명부에는 있지만 오늘 홀에 오지 않은 사람은 방에 없다
    const present = makeAdventurer();
    const absent = makeAdventurer();
    setRoster([present, absent]);
    state.hallAttendance = { guildMemberIds: [present.id], visitorIds: [] };

    mount();

    expect(token(present.id)).not.toBeNull();
    expect(token(absent.id)).toBeNull();
  });

  it("test_each_token_is_placed_at_its_own_seat", () => {
    // 자리가 겹치면 사람이 사람을 가린다. 인덱스로 배정되므로 순서가 곧 자리다.
    const members = [makeAdventurer(), makeAdventurer(), makeAdventurer()];
    attend(members);

    mount();

    const seats = [...root.querySelectorAll<HTMLElement>(".hall-token")].map(
      (node) => `${node.style.getPropertyValue("--x")}|${node.style.getPropertyValue("--y")}`,
    );
    expect(new Set(seats).size).toBe(seats.length);
  });

  it("test_guild_members_and_visitors_draw_from_different_seat_pools", () => {
    // 소속을 색이 아니라 **자리**로 말한다 — 길드원은 안쪽, 외부인은 문가.
    // 두 무리가 같은 자리 목록을 쓰면 그 신호가 통째로 사라진다.
    const member = makeAdventurer({ inGuild: true });
    const visitor = makeAdventurer({ inGuild: false });
    attend([member, visitor]);

    mount();

    const seatOf = (id: string) => token(id)?.style.getPropertyValue("--x") ?? "";
    expect(seatOf(member.id)).toBe(String(layout.guildSeats[0][0]));
    expect(seatOf(visitor.id)).toBe(String(layout.visitorSeats[0][0]));
  });

  it("test_seats_are_stable_across_rerenders", () => {
    // 대화 한 번에 화면이 다시 그려진다. 자리가 바뀌면 사람이 순간이동한다.
    const talker = makeAdventurer({ trust: 0.9 });
    attend([talker, makeAdventurer(), makeAdventurer()]);
    mount();
    const before = [...root.querySelectorAll<HTMLElement>(".hall-token")].map((n) => n.style.left);

    select(talker.id);
    talkButton(talker.id).click();

    const after = [...root.querySelectorAll<HTMLElement>(".hall-token")].map((n) => n.style.left);
    expect(after).toEqual(before);
  });

  it("test_empty_room_says_nobody_came", () => {
    mount();

    expect(root.querySelector(".hall-room__empty")?.textContent).toContain("아무도 오지 않았다");
  });

  it("test_guild_member_and_visitor_are_marked_with_different_classes", () => {
    const member = makeAdventurer({ inGuild: true });
    const visitor = makeAdventurer({ inGuild: false });
    attend([member, visitor]);

    mount();

    expect(token(member.id)?.classList.contains("hall-person--guild")).toBe(true);
    expect(token(member.id)?.classList.contains("hall-person--visitor")).toBe(false);
    expect(token(visitor.id)?.classList.contains("hall-person--visitor")).toBe(true);
  });

  it("test_capability_number_never_appears_in_dom", () => {
    const members = [
      makeAdventurer({ capability: 33 }),
      makeAdventurer({ capability: 61 }),
      makeAdventurer({ capability: 77 }),
    ];
    attend(members);

    mount();
    select(members[0].id);

    for (const member of members) {
      expect(root.innerHTML).not.toContain(String(member.capability));
    }
    expect(root.querySelectorAll("[data-capability]")).toHaveLength(0);
  });

  it("test_names_are_escaped", () => {
    const member = makeAdventurer({ name: "<script>evil()</script>" });
    attend([member]);

    mount();
    select(member.id);

    expect(root.querySelector("script")).toBeNull();
    expect(root.innerHTML).toContain("&lt;script&gt;");
  });
});

describe("길드 홀 화면 — 대화창 열기", () => {
  it("test_nothing_is_selected_until_a_person_is_clicked", () => {
    attend([makeAdventurer()]);

    mount();

    expect(panel().classList.contains("hall-dialogue--empty")).toBe(true);
    expect(root.querySelector(".hall-dialogue__hint")?.textContent).toContain("눌러 말을 건다");
  });

  it("test_selected_person_shows_name_grade_two_traits_and_affiliation", () => {
    const member = makeAdventurer({ name: "카린", traits: ["talkative", "bitter"], capability: 80 });
    attend([member]);

    mount();
    select(member.id);

    const box = panel();
    expect(box.querySelector(".hall-person__name")?.textContent).toBe("카린");
    expect(box.querySelector(".hall-person__grade")?.textContent).toBe("베테랑");
    expect(box.querySelector(".hall-person__traits")?.textContent).toContain("수다스럽다");
    expect(box.querySelector(".hall-person__traits")?.textContent).toContain("냉소적이다");
    expect(box.querySelector(".hall-person__affiliation")?.textContent).toBe("길드원");
  });

  it("test_clicking_the_sprite_itself_selects_the_person", () => {
    // 회귀: 사람은 버튼이 아니라 **그림**을 누른다. 스프라이트가 인라인 SVG였을 때
    // event.target이 SVGRectElement라 `instanceof HTMLElement` 가드에 걸려 클릭이
    // 통째로 무시된 적이 있다. 그림이 무엇으로 바뀌든 눌리기는 해야 한다.
    const member = makeAdventurer();
    attend([member]);

    mount();
    const sprite = token(member.id)?.querySelector(".hall-token__sprite");
    expect(sprite).not.toBeNull();
    sprite?.dispatchEvent(new Event("click", { bubbles: true }));

    expect(panel().classList.contains("hall-dialogue--empty")).toBe(false);
    expect(panel().dataset.personId).toBe(member.id);
  });

  it("test_clicking_the_selected_person_again_closes_the_dialogue", () => {
    const member = makeAdventurer();
    attend([member]);

    mount();
    select(member.id);
    expect(panel().classList.contains("hall-dialogue--empty")).toBe(false);

    select(member.id);

    expect(panel().classList.contains("hall-dialogue--empty")).toBe(true);
  });

  it("test_selecting_another_person_switches_the_dialogue", () => {
    const first = makeAdventurer({ name: "첫째" });
    const second = makeAdventurer({ name: "둘째" });
    attend([first, second]);

    mount();
    select(first.id);
    select(second.id);

    expect(panel().querySelector(".hall-person__name")?.textContent).toBe("둘째");
  });
});

describe("길드 홀 화면 — 대화", () => {
  it("test_talk_reveals_a_fact_and_updates_knowledge", () => {
    const talker = makeAdventurer({ trust: 0.9, traits: ["loyal", "cautious"] });
    const client = makeClient({ knownBy: [talker.id] });
    const contract = makeContract({ client, facts: [makeFact("ct-1", "realRisk")] });
    attend([talker]);
    state.openContracts = [contract];

    mount();
    select(talker.id);
    talkButton(talker.id).click();

    expect(panel().querySelector(".hall-person__reply")?.textContent?.length).toBeGreaterThan(0);
    expect(state.knowledge.discoveredContacts.has(`${talker.id}->${client.id}`)).toBe(true);
    expect(state.knowledge.revealedFacts.has(`ct-1:realRisk`)).toBe(true);
  });

  it("test_heard_facts_records_teller_and_possibly_distorted_stated_value", () => {
    // bitter는 실제보다 부풀려 전한다 — statedValue !== actualValue(realRisk)가 성립해야
    // 결과 대조 화면의 "저 사람 말은 늘 과장이다" 학습 연결이 끊기지 않는다.
    const talker = makeAdventurer({ trust: 0.9, traits: ["bitter", "loyal"] });
    const client = makeClient({ knownBy: [talker.id] });
    const contract = makeContract({ id: "ct-1", realRisk: 100, client, facts: [makeFact("ct-1", "realRisk")] });
    attend([talker]);
    state.openContracts = [contract];

    mount();
    select(talker.id);
    talkButton(talker.id).click();

    const heard = state.knowledge.heardFacts.get("ct-1:realRisk");
    expect(heard).toBeDefined();
    expect(heard?.tellerId).toBe(talker.id);
    expect(heard?.day).toBe(state.day);
    expect(heard?.statedValue).not.toBe(contract.realRisk);
    expect(heard?.statedValue).toBeCloseTo(100 * (1 + RUMOR.traitDistortion), 8);
  });

  it("test_talked_person_button_is_removed_and_added_to_talkedToday", () => {
    const talker = makeAdventurer({ trust: 0.9 });
    attend([talker]);

    mount();
    select(talker.id);
    talkButton(talker.id).click();

    expect(state.talkedToday.has(talker.id)).toBe(true);
    expect(root.querySelector(`[data-action="talk"][data-id="${talker.id}"]`)).toBeNull();
    expect(panel().querySelector(".hall-person__status")?.textContent).toContain("이미 대화했다");
  });

  it("test_talking_keeps_the_person_selected_so_the_reply_stays_visible", () => {
    // 말을 걸었는데 대화창이 닫히면 방금 들은 말이 사라진다
    const talker = makeAdventurer({ trust: 0.9 });
    attend([talker, makeAdventurer()]);

    mount();
    select(talker.id);
    talkButton(talker.id).click();

    expect(panel().dataset.personId).toBe(talker.id);
  });

  it("test_talked_person_token_is_dimmed_in_the_room", () => {
    // 남은 기회가 어디 있는지 방을 훑어보고 알 수 있어야 한다
    const talker = makeAdventurer({ trust: 0.9 });
    attend([talker]);

    mount();
    select(talker.id);
    talkButton(talker.id).click();

    expect(token(talker.id)?.classList.contains("hall-person--talked")).toBe(true);
  });

  it("test_reentry_does_not_bypass_talkedToday_block", () => {
    // 재대화 차단이 화면 로컬이 아니라 state.talkedToday에서 온다는 것을 고정한다 —
    // 화면을 다시 mount해도(길드 홀을 나갔다 들어와도) 차단이 유지되어야 한다.
    const talker = makeAdventurer();
    attend([talker]);
    state.talkedToday.add(talker.id);

    const handle = mount();
    select(talker.id);

    expect(root.querySelector(`[data-action="talk"][data-id="${talker.id}"]`)).toBeNull();
    expect(panel().querySelector(".hall-person__status")).not.toBeNull();

    handle.destroy();
    mount();
    select(talker.id);
    expect(root.querySelector(`[data-action="talk"][data-id="${talker.id}"]`)).toBeNull();
  });

  it("test_person_who_knows_nobody_says_so_instead_of_refusing", () => {
    // 회귀: 값을 치른 greedy에게 "공짜로 도는 이야기가 어디 있냐"가 돌아오면 플레이어는
    // 돈을 내고 모욕을 산 것으로 읽는다. 아는 게 없는 것과 입을 다무는 것은 다른 일이다.
    const talker = makeAdventurer({ traits: ["greedy", "loyal"], trust: 0.9 });
    attend([talker]);
    state.openContracts = [makeContract({ client: makeClient({ knownBy: [] }) })];
    state.funds = 200;

    mount();
    select(talker.id);
    talkButton(talker.id, true).click();

    const reply = panel().querySelector(".hall-person__reply")?.textContent ?? "";
    expect(reply).toContain("아는 것이 없었다");
    expect(reply).not.toContain("입을 다물었다");
  });

  it("test_person_who_knows_someone_but_stays_silent_reads_as_a_refusal", () => {
    // 신뢰가 모자라 막힌 경우다. 이쪽은 "아는 게 없다"가 아니라 거절이어야 한다 —
    // 신뢰를 쌓으면 열린다는 신호가 사라지면 안 된다.
    const talker = makeAdventurer({ traits: ["loyal", "cautious"], trust: 0 });
    const client = makeClient({ knownBy: [talker.id] });
    attend([talker]);
    state.openContracts = [makeContract({ client, facts: [makeFact("ct-1", "realRisk")] })];

    mount();
    select(talker.id);
    talkButton(talker.id).click();

    const reply = panel().querySelector(".hall-person__reply")?.textContent ?? "";
    expect(reply).toContain("입을 다물었다");
    expect(state.knowledge.revealedFacts.size).toBe(0);
  });

  it("test_greedy_person_offers_pay_and_refuse_choices", () => {
    const talker = makeAdventurer({ traits: ["greedy", "loyal"], trust: 0.9 });
    attend([talker]);

    mount();
    select(talker.id);

    expect(talkButton(talker.id, true)).not.toBeNull();
    expect(talkButton(talker.id, false)).not.toBeNull();
  });

  it("test_greedy_pay_button_is_disabled_when_funds_are_insufficient", () => {
    const talker = makeAdventurer({ traits: ["greedy", "loyal"], trust: 0.9 });
    attend([talker]);
    state.funds = RUMOR.greedyPrice - 1;

    mount();
    select(talker.id);

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

    // 오지 않은 외부인은 방에 없으므로 말을 걸 수조차 없다
    expect(token(absentOutsider.id)).toBeNull();

    select(guildMember.id);
    expect(recruitButton(guildMember.id)).toBeNull();

    select(visitor.id);
    expect(recruitButton(visitor.id)).not.toBeNull();
  });

  it("test_successful_recruit_sets_inGuild_and_deducts_exact_cost", () => {
    const visitor = makeAdventurer({ inGuild: false, capability: 20, tenureYears: 1 });
    attend([visitor]);
    state.funds = 500;
    const cost = recruitCost(visitor, GUILD.recruit);

    mount();
    select(visitor.id);
    recruitButton(visitor.id)?.click();

    expect(visitor.inGuild).toBe(true);
    expect(state.funds).toBe(500 - cost);
  });

  it("test_recruited_person_immediately_reads_as_a_guild_member", () => {
    // 방금 돈을 냈는데 아직도 외부인이라고 나오면 혼란만 남는다
    const visitor = makeAdventurer({ inGuild: false, capability: 20, tenureYears: 1 });
    attend([visitor]);
    state.funds = 500;

    mount();
    select(visitor.id);
    recruitButton(visitor.id)?.click();

    expect(panel().querySelector(".hall-person__affiliation")?.textContent).toBe("길드원");
    expect(recruitButton(visitor.id)).toBeNull();
    expect(token(visitor.id)?.classList.contains("hall-person--guild")).toBe(true);
  });

  it("test_roster_full_disables_recruit_with_its_own_reason", () => {
    const memberA = makeAdventurer({ inGuild: true });
    const memberB = makeAdventurer({ inGuild: true });
    const visitor = makeAdventurer({ inGuild: false });
    attend([memberA, memberB, visitor]); // guildTier 1의 rosterCap은 2

    mount();
    select(visitor.id);

    expect(recruitButton(visitor.id)?.disabled).toBe(true);
    const reason = panel().querySelector(".hall-person__recruit-reason")?.textContent ?? "";
    expect(reason).toContain("정원이 찼습니다");
  });

  it("test_insufficient_funds_disables_recruit_with_a_different_reason", () => {
    const visitor = makeAdventurer({ inGuild: false, capability: 80, tenureYears: 6 });
    attend([visitor]);
    state.funds = 1;

    mount();
    select(visitor.id);

    expect(recruitButton(visitor.id)?.disabled).toBe(true);
    const reason = panel().querySelector(".hall-person__recruit-reason")?.textContent ?? "";
    expect(reason).toContain("자금이 부족합니다");
    expect(reason).not.toContain("정원이 찼습니다");
  });

  it("test_recruit_is_refused_even_if_the_disabled_button_is_bypassed", () => {
    // 규칙이 UI 상태보다 우선한다
    const visitor = makeAdventurer({ inGuild: false, capability: 80, tenureYears: 6 });
    attend([visitor]);
    state.funds = 1;

    mount();
    select(visitor.id);
    const button = recruitButton(visitor.id);
    if (button !== null) {
      button.disabled = false;
      button.click();
    }

    expect(visitor.inGuild).toBe(false);
    expect(state.funds).toBe(1);
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
