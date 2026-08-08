/**
 * 길드 홀 화면 — 정보를 캐는 유일한 창 + 영입·확장.
 *
 * Story 010(홀 출석·대화)과 Story 015(영입·확장 UI 절반)가 한 화면에 있다. 도메인
 * 판정은 전부 다른 파일이 소유한다 — 이 화면은 `resolveHallAttendance`를 **절대
 * 부르지 않는다.** 오늘의 출석자는 `gameState.ts`가 하루에 한 번 뽑아
 * `state.hallAttendance`에 고정해 두고, 이 화면은 그 결과와 `state.roster`를
 * 대조해서 그릴 뿐이다. 화면이 직접 뽑으면 재렌더될 때마다 출석자가 바뀌는 모순이
 * 생긴다 (`hall.ts` 상단 주석 참고).
 *
 * ## 출석 배열이 아니라 `inGuild`로 소속을 가른다
 *
 * `HallAttendance`는 `guildMemberIds`/`visitorIds`로 그날 아침 시점의 소속을
 * 고정해 담아 두지만, 이 화면은 **매 렌더마다 `Adventurer.inGuild`를 다시 읽어서**
 * 배지와 영입 가능 여부를 계산한다. 그래야 홀에서 외부인을 영입한 순간 그 사람이
 * 즉시 "길드원" 배지로 바뀌고 영입 버튼이 사라진다 — 표시가 실시간 진실을 따라가지
 * 않으면 "방금 돈을 냈는데 아직도 외부인이라고 나온다"는 혼란이 생긴다.
 *
 * ## 밝혀진 인맥은 "말한 적 있는가"로만 채워진다
 *
 * `PlayerKnowledge.discoveredContacts`는 대화 한 번(성공 여부·신뢰와 무관하게)이면
 * 채워진다. 이 화면은 그 사람이 아는 **현재 열린 의뢰**의 의뢰인 이름만 나열하고,
 * 하나도 없으면 물음표를 낸다 — "이 사람과 아직 이야기해 본 적 없다"와 "이야기했지만
 * 아는 사람이 없다"를 구분하지 않는 단순화다. 두 경우를 가르려면 "대화한 적 있음"을
 * 별도로 영구 기록해야 하는데, 그런 필드가 도메인에 없다. 물음표가 조금 더 오래
 * 남는 대가로 상태를 하나 아끼는 쪽을 택했다.
 *
 * ## 붉은색은 쓰지 않는다
 *
 * 이 화면에는 사망도 결렬도 없다 — 자금 부족·정원 초과 같은 비활성 사유는 위험이
 * 아니라 그냥 "아직 안 된다"이므로 `--seal`을 전혀 쓰지 않는다 (`guildHall.css` 참고).
 */
import type { GameState } from '../../domain/gameState';
import {
  activeGuildRosterSize,
  checkExpand,
  checkRecruit,
  expandGuild,
  findGuildTier,
  recruitAdventurer,
  type GuildConfig,
  type RecruitBlockReason,
} from '../../domain/guild';
import { discoveredContactKey, resolveTalk, type RumorConfig, type TalkResult } from '../../domain/rumor';
import { narrate, type TextBank } from '../../domain/text';
import { gradeOf, type Adventurer, type Contract, type GradeThresholds } from '../../domain/types';
import { escapeHtml, GRADE_LABELS, TRAIT_LABELS, type ScreenHandle } from '../screen';

export type { ScreenHandle };

export interface GuildHallScreenDeps {
  readonly state: GameState;
  readonly rumor: RumorConfig;
  readonly guild: GuildConfig;
  readonly gradeThresholds: GradeThresholds;
  readonly text: TextBank;
  /**
   * 오늘 하루를 마감한다. 실제 `advanceDay(state, config)` 호출과 그 이후 화면 전환은
   * main.ts가 한다 — 이 화면은 회차 진행의 전역 효과(다른 파견 판정, 의뢰 리필, 다음
   * 날 홀 출석 재추첨)를 몰라도 되고 소유하지도 않는다. `DispatchScreen`이 같은
   * 이유로 `advanceDay`를 직접 부르지 않는 것과 같은 경계다.
   */
  readonly onAdvanceDay: () => void;
  /** 하루를 마감하지 않고 창구로 돌아간다. 화면 전환 자체는 main.ts가 한다 */
  readonly onReturnToCounter: () => void;
}

/**
 * 길드 홀 화면을 그린다.
 *
 * @param root 그려 넣을 요소. 기존 내용은 지워진다
 */
export function mountGuildHallScreen(root: HTMLElement, deps: GuildHallScreenDeps): ScreenHandle {
  /** 이번 대화의 서술 결과. 세션 상태(`talkedToday`)와 달리 재마운트하면 사라진다 —
   *  재대화 차단 자체는 `state.talkedToday`가 지키므로 이 캐시는 순수 표시용이다. */
  const talkMessages = new Map<string, string>();
  /** 영입 직후의 환영 인사. `talkMessages`와 같은 이유로 화면 로컬이다. */
  const recruitMessages = new Map<string, string>();
  let destroyed = false;

  const onClick = (event: Event): void => handleClick(event);
  root.addEventListener('click', onClick);
  render();

  return {
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      root.removeEventListener('click', onClick);
      root.innerHTML = '';
    },
  };

  function handleClick(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const button = target.closest<HTMLElement>('[data-action]');
    if (button === null) return;

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (action === 'talk' && id !== undefined) {
      handleTalk(id, button.dataset.pay === 'true');
    } else if (action === 'recruit' && id !== undefined) {
      handleRecruit(id);
    } else if (action === 'expand') {
      handleExpand();
    } else if (action === 'return') {
      deps.onReturnToCounter();
    } else if (action === 'end-day') {
      deps.onAdvanceDay();
    }
  }

  function memberById(id: string): Adventurer | undefined {
    return deps.state.roster.find((member) => member.id === id);
  }

  function findOpenContract(contractId: string): Contract | undefined {
    return deps.state.openContracts.find((contract) => contract.id === contractId);
  }

  /**
   * 대화 한 번을 실행하고 그 결과를 상태에 반영한다.
   *
   * ①인맥 공개는 신뢰·`greedy` 지불과 무관하게 항상 일어나므로 `discoveredContacts`는
   * 조건 없이 채운다. `revealedFacts`/`heardFacts`는 항상 같이 채운다 — 하나만 채우면
   * 위험 고지 축은 열리는데 결과 대조 화면에 화자가 안 나오는 식으로 조용히 어긋난다
   * (`types.ts`의 `PlayerKnowledge.heardFacts` 문서 참고). `actualValue`가 아니라
   * `statedValue`(왜곡된 값)를 저장해야 "알았던 것 vs 실제였던 것" 대조가 성립한다.
   */
  function handleTalk(id: string, payGreedyPrice: boolean): void {
    if (deps.state.talkedToday.has(id)) return;
    const member = memberById(id);
    if (member === undefined) return;

    const result = resolveTalk(member, deps.state.openContracts, deps.state.rng, deps.rumor, {
      payGreedyPrice,
    });

    for (const key of result.discoveredContactKeys) {
      deps.state.knowledge.discoveredContacts.add(key);
    }
    for (const fact of result.revealedFacts) {
      deps.state.knowledge.revealedFacts.add(fact.factId);
      deps.state.knowledge.heardFacts.set(fact.factId, {
        statedValue: fact.statedValue,
        tellerId: fact.tellerId,
        day: deps.state.day,
      });
    }
    if (result.greedyPriceCharged !== undefined) {
      deps.state.funds -= result.greedyPriceCharged;
    }

    deps.state.talkedToday.add(id);
    talkMessages.set(id, describeTalk(member, result));
    render();
  }

  /**
   * 대화 결과를 문장으로 조립한다. 산문은 전부 `narrate()`를 거친다.
   *
   * `realWealth` 사실도 `rumorTold`를 재사용한다 — `text.json`에 지불 여력 전용
   * 상황이 아직 없다. `rumorTold`의 문안이 "위험도가 ~쯤 될 겁니다" 식으로 위험
   * 전용 어휘라 지불 여력 사실에는 어색하다는 것을 이미 확인했다 (보고서 4번 참고).
   */
  function describeTalk(talker: Adventurer, result: TalkResult): string {
    if (result.revealedFacts.length === 0) {
      return narrate(deps.text, 'rumorRefused', talker.traits, { name: talker.name }, deps.state.rng);
    }

    return result.revealedFacts
      .map((fact) => {
        const contract = findOpenContract(fact.contractId);
        const clientName = contract === undefined ? '알 수 없는 의뢰인' : contract.client.name;
        return narrate(
          deps.text,
          'rumorTold',
          talker.traits,
          { name: talker.name, client: clientName, risk: Math.round(fact.statedValue) },
          deps.state.rng,
        );
      })
      .join(' ');
  }

  /**
   * 영입을 실행한다. `checkRecruit`을 먼저 다시 확인한다 — 비활성 버튼을 우회해도
   * (테스트가 그러듯) 규칙이 UI 상태보다 우선한다는 것을 코드로 보장한다.
   *
   * `member`는 `state.roster`에서 찾은 실제 참조를 그대로 넘긴다 — `recruitAdventurer`가
   * 그 객체를 제자리에서 mutate하므로 복사본을 넘기면 반영되지 않는다.
   */
  function handleRecruit(id: string): void {
    const member = memberById(id);
    if (member === undefined) return;

    const check = checkRecruit(member, deps.state.roster, deps.state.funds, deps.state.guildTier, deps.guild);
    if (!check.canRecruit) return;

    deps.state.funds = recruitAdventurer(
      member,
      deps.state.roster,
      deps.state.funds,
      deps.state.guildTier,
      deps.guild,
    );
    recruitMessages.set(
      id,
      narrate(deps.text, 'recruitGreeting', member.traits, { name: member.name }, deps.state.rng),
    );
    render();
  }

  /** 길드 확장을 실행한다. `guildTier`/`funds`는 순수 함수의 반환값을 그대로 적는다. */
  function handleExpand(): void {
    const check = checkExpand(deps.state.guildTier, deps.state.funds, deps.guild);
    if (!check.canExpand) return;

    const result = expandGuild(deps.state.guildTier, deps.state.funds, deps.guild);
    deps.state.guildTier = result.guildTier;
    deps.state.funds = result.funds;
    render();
  }

  /**
   * 이 사람이 아는, 현재 열린 의뢰의 의뢰인 이름들.
   *
   * `discoveredContacts`는 "누가 누구를 아는가"의 키 집합일 뿐이라 이름이 없다 —
   * 매번 `state.openContracts`를 돌며 키가 있는지 확인해서 이름으로 바꾼다. 닫힌
   * 의뢰의 의뢰인은 애초에 `openContracts`에 없으므로 별도 만료 처리 없이 자연히
   * 걸러진다.
   */
  function contactsFor(personId: string): string[] {
    const names: string[] = [];
    for (const contract of deps.state.openContracts) {
      if (deps.state.knowledge.discoveredContacts.has(discoveredContactKey(personId, contract.client.id))) {
        names.push(contract.client.name);
      }
    }
    return names;
  }

  function render(): void {
    if (destroyed) return;
    root.innerHTML = renderBody();
  }

  function renderBody(): string {
    const ids = [...deps.state.hallAttendance.guildMemberIds, ...deps.state.hallAttendance.visitorIds];
    const people = ids
      .map((id) => memberById(id))
      .filter((member): member is Adventurer => member !== undefined);
    const rows = people.map((member) => renderPerson(member)).join('');

    return `
      <section class="hall">
        <header class="hall__header">
          <h1 class="hall__day">${deps.state.day}일차 — 길드 홀</h1>
          <p class="hall__funds">자금 ${round(deps.state.funds)}G · 명성 ${round(deps.state.reputation)}</p>
        </header>

        <section class="hall__people">
          <h2 class="hall__section-title">오늘 홀에 온 사람들</h2>
          <ul class="hall-person-list">
            ${rows === '' ? '<li class="hall-person-list__empty">오늘은 아무도 오지 않았다.</li>' : rows}
          </ul>
        </section>

        ${renderExpandSection()}

        <footer class="hall__actions">
          <button class="hall__return" type="button" data-action="return">창구로 돌아간다</button>
          <button class="hall__end-day" type="button" data-action="end-day">하루를 마감한다</button>
        </footer>
      </section>
    `;
  }

  function renderPerson(member: Adventurer): string {
    const talked = deps.state.talkedToday.has(member.id);
    const affiliationClass = member.inGuild ? 'hall-person--guild' : 'hall-person--visitor';
    const affiliationLabel = member.inGuild ? '길드원' : '외부인';
    const grade = GRADE_LABELS[gradeOf(member.capability, deps.gradeThresholds)];
    const traits = member.traits.map((trait) => TRAIT_LABELS[trait]).join(' · ');
    const contacts = contactsFor(member.id);
    const recruitMessage = recruitMessages.get(member.id);

    return `
      <li class="hall-person ${affiliationClass}${talked ? ' hall-person--talked' : ''}" data-person-id="${member.id}">
        <div class="hall-person__header">
          <span class="hall-person__name">${escapeHtml(member.name)}</span>
          <span class="hall-person__grade">${grade}</span>
          <span class="hall-person__affiliation">${affiliationLabel}</span>
        </div>
        <p class="hall-person__traits">${escapeHtml(traits)}</p>
        <p class="hall-person__contacts">인맥: ${
          contacts.length === 0 ? '?' : contacts.map((name) => escapeHtml(name)).join(', ')
        }</p>
        ${recruitMessage === undefined ? '' : `<p class="hall-person__recruit-message">${escapeHtml(recruitMessage)}</p>`}
        ${renderTalkSection(member, talked)}
        ${member.inGuild ? '' : renderRecruitSection(member)}
      </li>
    `;
  }

  /**
   * 대화 영역. `greedy`는 값을 낼지 미리 고르는 두 버튼을 보여준다 — 신뢰가 모자라면
   * 값을 내도 침묵하지만(그때는 돈도 나가지 않는다, `rumor.ts` 참고), 성격 태그는
   * 항상 보이므로 플레이어는 미리 고를 수 있어야 한다.
   */
  function renderTalkSection(member: Adventurer, talked: boolean): string {
    if (talked) {
      const message = talkMessages.get(member.id);
      return `
        <p class="hall-person__status">오늘은 이미 대화했다.</p>
        ${message === undefined ? '' : `<p class="hall-person__reply">${escapeHtml(message)}</p>`}
      `;
    }

    if (member.traits.includes('greedy')) {
      const price = deps.rumor.greedyPrice;
      const canPay = deps.state.funds >= price;
      return `
        <div class="hall-person__actions">
          <button class="hall-person__talk" type="button" data-action="talk" data-id="${member.id}"
                  data-pay="true" ${canPay ? '' : 'disabled'}>값을 치르고 듣는다 (${price}G)</button>
          <button class="hall-person__talk" type="button" data-action="talk" data-id="${member.id}"
                  data-pay="false">거절한다</button>
        </div>
      `;
    }

    return `
      <div class="hall-person__actions">
        <button class="hall-person__talk" type="button" data-action="talk" data-id="${member.id}"
                data-pay="false">대화한다</button>
      </div>
    `;
  }

  /** 영입 영역. `!member.inGuild`일 때만 호출된다 — 홀에 온 외부인만 영입 대상이다. */
  function renderRecruitSection(member: Adventurer): string {
    const check = checkRecruit(member, deps.state.roster, deps.state.funds, deps.state.guildTier, deps.guild);
    const reason = check.reason === undefined ? '' : recruitReasonLabel(check.reason, check.cost);

    return `
      <div class="hall-person__recruit">
        <button class="hall-person__recruit-button" type="button" data-action="recruit" data-id="${member.id}"
                ${check.canRecruit ? '' : 'disabled'}>영입한다 (${round(check.cost)}G)</button>
        ${reason === '' ? '' : `<p class="hall-person__recruit-reason">${escapeHtml(reason)}</p>`}
      </div>
    `;
  }

  /** `RecruitBlockReason` 코드를 한국어 문구로. 사유 판정 자체는 `checkRecruit`이 한다. */
  function recruitReasonLabel(reason: RecruitBlockReason, cost: number): string {
    if (reason === 'alreadyInGuild') return '이미 길드원입니다';
    if (reason === 'rosterFull') {
      const cap = findGuildTier(deps.state.guildTier, deps.guild).rosterCap;
      const current = activeGuildRosterSize(deps.state.roster);
      return `정원이 찼습니다 (${current}/${cap})`;
    }
    return `자금이 부족합니다 (필요 ${round(cost)}G, 보유 ${round(deps.state.funds)}G)`;
  }

  function renderExpandSection(): string {
    const tier = findGuildTier(deps.state.guildTier, deps.guild);
    const check = checkExpand(deps.state.guildTier, deps.state.funds, deps.guild);
    const info = `
      <p class="hall-expand__info">
        현재 등급 ${tier.tier} · 정원 ${tier.rosterCap}명 · 홀 출석 최대 ${tier.hallAttendanceMax}명 ·
        동시 의뢰 ${tier.concurrentContracts}건
      </p>
    `;

    if (check.reason === 'maxTierReached') {
      return `
        <section class="hall-expand">
          <h2 class="hall__section-title">길드 확장</h2>
          ${info}
          <p class="hall-expand__reason">이미 최고 등급입니다</p>
        </section>
      `;
    }

    const cost = check.nextTier === undefined ? 0 : check.nextTier.cost;
    const reason = check.canExpand ? '' : `자금이 부족합니다 (필요 ${round(cost)}G)`;

    return `
      <section class="hall-expand">
        <h2 class="hall__section-title">길드 확장</h2>
        ${info}
        <button class="hall-expand__button" type="button" data-action="expand"
                ${check.canExpand ? '' : 'disabled'}>확장한다 (${round(cost)}G)</button>
        <p class="hall-expand__hint">효과는 다음 날부터 적용된다.</p>
        ${reason === '' ? '' : `<p class="hall-expand__reason">${escapeHtml(reason)}</p>`}
      </section>
    `;
  }
}

function round(value: number): number {
  return Math.round(value);
}
