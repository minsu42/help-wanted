/**
 * @vitest-environment happy-dom
 *
 * 결산 화면 상호작용 테스트.
 *
 * 이 화면은 회차 진행 규칙을 모른다 — `DispatchScreen` 테스트와 같은 이유로
 * `GameState`를 필요한 필드만 손으로 채운 객체로 만든다. `balance.json`의
 * `GameConfig` 조립 표면(`hall`, `reputation` 절 등)은 다른 스토리가 병행 작업 중이라
 * 계속 바뀌는 중이고, 이 화면은 그 표면을 전혀 쓰지 않으므로 여기 얽매일 이유가
 * 없다. 사망자 서술만은 실제 `src/data/text.json`(`resultDead`)을 그대로 써서
 * 내가 이번 스토리에서 추가한 `endings` 절과 함께 실제 파일이 올바른 모양인지도
 * 같이 검증한다.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import textBank from "../../../src/data/text.json";
import type { GameState } from "../../../src/domain/gameState";
import { createRng } from "../../../src/domain/rng";
import { narrate } from "../../../src/domain/text";
import type { Adventurer } from "../../../src/domain/types";
import {
  mountEndingScreen,
  type EndingScreenDeps,
  type EndingTextBank,
  type ReputationTierBounds,
} from "../../../src/presentation/ui/EndingScreen";

const TEXT_BANK = textBank as EndingTextBank;
const SEED = 424242;

/** 명성 구간 경계. `balance.json`에는 아직 이 노브가 없다 (스토리 보고서 참조) —
 * 다른 화면 테스트(`DispatchScreen`의 `RULES`)와 같은 방식으로 이 파일이 직접 고정한다. */
const TIERS: ReputationTierBounds = { low: 20, high: 60 };

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

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    day: 16,
    reputation: 10,
    funds: 200,
    guildTier: 1,
    phase: "ended",
    roster: [],
    openContracts: [],
    activeDispatches: [],
    knowledge: {
      discoveredContacts: new Set(),
      revealedFacts: new Set(),
      heardFacts: new Map(),
      slotProgress: new Map(),
    },
    rng: createRng(SEED),
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

/**
 * 명부를 갈아 끼운다.
 *
 * `GameState.roster`는 `readonly` 속성이다 — 명부가 사람의 유일한 저장소여야 하므로
 * 배열 자체를 교체하는 것을 타입이 막는다. 제자리에서 내용만 바꾼다.
 */
function setRoster(members: readonly Adventurer[]): void {
  state.roster.splice(0, state.roster.length, ...members);
}

/** 실제 화면과 같은 경로(narrate)로 기대 문장을 만든다. */
function expectedDeathLine(member: Adventurer, state: GameState): string {
  return narrate(TEXT_BANK, "resultDead", member.traits, { name: member.name }, state.rng);
}

let root: HTMLElement;
let state: GameState;
let onRestart: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  document.body.innerHTML = "";
  root = document.createElement("div");
  document.body.appendChild(root);

  idCounter = 0;
  state = makeState();
  onRestart = vi.fn<() => void>();
});

function mount(overrides: Partial<EndingScreenDeps> = {}): ReturnType<typeof mountEndingScreen> {
  return mountEndingScreen(root, {
    state,
    text: TEXT_BANK,
    reputationTiers: TIERS,
    seed: SEED,
    onRestart,
    ...overrides,
  });
}

describe("결산 화면 — 요약", () => {
  it("test_summary_shows_final_reputation_funds_tier_and_guild_size", () => {
    state.reputation = 42;
    state.funds = 777;
    state.guildTier = 2;
    setRoster([
      makeAdventurer({ inGuild: true, status: "available" }),
      makeAdventurer({ inGuild: true, status: "onMission" }),
      makeAdventurer({ inGuild: false, status: "available" }), // 외부 모험가 — 세지 않는다
    ]);

    mount();

    const summary = root.querySelector(".ending__summary")?.textContent ?? "";
    expect(summary).toContain("42");
    expect(summary).toContain("777");
    expect(summary).toContain("2등급");
    expect(summary).toContain("2명"); // 길드원 2명만 (외부 모험가 제외)
  });

  it("test_dead_guild_members_are_excluded_from_the_guild_count", () => {
    setRoster([
      makeAdventurer({ inGuild: true, status: "available" }),
      makeAdventurer({ inGuild: true, status: "dead" }),
    ]);

    mount();

    const summary = root.querySelector(".ending__summary")?.textContent ?? "";
    expect(summary).toContain("1명");
  });
});

describe("결산 화면 — 사망자 명단", () => {
  it("test_every_death_is_listed_by_name_with_its_own_line_not_a_count", () => {
    const first = makeAdventurer({ name: "발더", inGuild: true, status: "dead", traits: ["bitter", "loyal"] });
    const second = makeAdventurer({ name: "에린", inGuild: true, status: "dead", traits: ["boastful", "greedy"] });
    setRoster([first, second, makeAdventurer({ inGuild: true, status: "available" })]);

    mount();

    const rows = root.querySelectorAll(".ending__roll-row");
    expect(rows).toHaveLength(2);

    const rollText = root.querySelector(".ending__roll")?.textContent ?? "";
    expect(rollText).toContain("발더");
    expect(rollText).toContain("에린");
    // 숫자 요약("사망 2명")이 아니라 개별 항목이어야 한다
    expect(rollText).not.toMatch(/사망\s*\d+명/);

    expect(rows[0].querySelector(".ending__roll-name")?.textContent).toBe("발더");
    expect(rows[0].querySelector(".ending__roll-line")?.textContent).toBe(expectedDeathLine(first, state));
    expect(rows[1].querySelector(".ending__roll-name")?.textContent).toBe("에린");
    expect(rows[1].querySelector(".ending__roll-line")?.textContent).toBe(expectedDeathLine(second, state));
  });

  it("test_zero_deaths_shows_a_dedicated_message_not_an_empty_list", () => {
    setRoster([makeAdventurer({ inGuild: true, status: "available" })]);

    mount();

    expect(root.querySelector(".ending__roll-list")).toBeNull();
    expect(root.querySelector(".ending__roll-empty")?.textContent?.length).toBeGreaterThan(0);
  });

  it("test_dead_member_name_is_escaped", () => {
    // names.json이 안전한 것은 오늘의 사실이지 구조적 보장이 아니다
    const member = makeAdventurer({
      name: "<script>alert(1)</script>",
      inGuild: true,
      status: "dead",
    });
    setRoster([member]);

    mount();

    expect(root.querySelector("script")).toBeNull();
    expect(root.querySelector(".ending__roll-name")?.innerHTML).toContain("&lt;script&gt;");
  });
});

describe("결산 화면 — 운명 분기", () => {
  function fateTextFor(reputation: number): string | null | undefined {
    document.body.innerHTML = "";
    root = document.createElement("div");
    document.body.appendChild(root);
    state = makeState({ reputation, roster: [] });

    mount();
    return root.querySelector(".ending__fate-text")?.textContent;
  }

  it("test_three_reputation_bands_render_three_distinct_fate_texts", () => {
    const low = fateTextFor(TIERS.low - 1);
    const mid = fateTextFor((TIERS.low + TIERS.high) / 2);
    const high = fateTextFor(TIERS.high);

    expect(low).toBe(TEXT_BANK.endings.low);
    expect(mid).toBe(TEXT_BANK.endings.mid);
    expect(high).toBe(TEXT_BANK.endings.high);
    expect(new Set([low, mid, high]).size).toBe(3);
  });
});

describe("결산 화면 — 시드", () => {
  it("test_seed_is_displayed", () => {
    mount();

    expect(root.querySelector(".ending__seed")?.textContent).toContain(String(SEED));
  });
});

describe("결산 화면 — 다시 시작", () => {
  it("test_restart_button_calls_on_restart_exactly_once", () => {
    mount();

    root.querySelector<HTMLButtonElement>('[data-action="restart"]')?.click();

    expect(onRestart).toHaveBeenCalledTimes(1);
  });
});

describe("결산 화면 — 역량 숫자 비노출", () => {
  it("test_raw_capability_number_never_appears_in_the_dom", () => {
    // 이 값이 명성·자금·등급 등 다른 표시 숫자와 우연히 겹치지 않게 갈라놓는다
    state.reputation = 10;
    state.funds = 200;
    state.guildTier = 1;
    setRoster([makeAdventurer({ capability: 63, inGuild: true, status: "available" })]);

    mount();

    expect(/\b63\b/.test(root.innerHTML)).toBe(false);
    expect(root.querySelectorAll("[data-capability]")).toHaveLength(0);
  });
});

describe("결산 화면 — 수명", () => {
  it("test_destroy_clears_dom_and_detaches_listeners", () => {
    const handle = mount();

    handle.destroy();

    expect(root.innerHTML).toBe("");
    root.dispatchEvent(new Event("click", { bubbles: true }));
    expect(onRestart).not.toHaveBeenCalled();
  });

  it("test_destroy_is_idempotent", () => {
    const handle = mount();

    handle.destroy();
    expect(() => handle.destroy()).not.toThrow();
  });
});
