/**
 * 파견 화면 — 파티 배정 + 결과 (최소판, Week 1 종료 게이트).
 *
 * 이 화면이 끝나면 "의뢰 받고 사람 보내서 결과 보기"가 완주된다. "알았던 것 vs
 * 실제였던 것" 대조는 Story 014, `trust`·`Memory` 갱신은 Story 013, 자금·명성 반영은
 * Story 012의 몫이다 — 여기서는 배정과 "무슨 일이 일어났는가"만 보여준다.
 *
 * ## 회차 진행은 여기서 소유하지 않는다
 *
 * `advanceWeek(state, config)`를 이 화면이 직접 부르지 않는다. 한 주가 지나면 **다른
 * 파견도 조용히 판정되고 의뢰도 리필된다** — 그 전역 효과는 프레젠테이션 계층의
 * 소관이 아니다. 배정을 마치면 길드 홀로 돌아가며, 주 진행과 결과 큐 처리는 main.ts의
 * 길드 홀 마감 경로가 전담한다.
 *
 * ## 배정 꺼림은 대가이지 게이트가 아니다
 *
 * > 2026-08-09 개정 — 원래 이 문단의 제목은 *"배정 거부는 하드 게이트"* 였다.
 * > **그 게이트가 게임을 멈췄다.** 가용한 모험가가 전부 거부 상태가 되면 체크할 사람이
 * > 없어 확정 버튼이 영구히 비활성인데, 이 단계에는 나가는 버튼이 없었다.
 * >
 * > 원인은 임계값이 높은 것이 아니라 산술이었다 — 길드원은 0.5에서 시작하는데 사망
 * > 페널티가 **길드원 전체에게** 균일하게 적용되고(`reputation.ts`의 `bystanders`),
 * > 은폐 사망 한 번이면 `trustOnDeath`(−0.15) + `trustOnDeceit`(−0.35) = −0.5라서
 * > 전원이 정확히 0.0이 된다. 회복 수단인 `trustOnSurvive`는 파견을 나가야 받으므로
 * > 회복 경로까지 함께 닫힌다. **임계값이 0보다 크기만 하면 무엇이든 잠긴다.**
 * >
 * > 그래서 두 조건 모두 강제력을 잃었다. 꺼리는 사람도 배정할 수 있고, 대신
 * > `forcedAssignmentTrustPenalty`를 문다. 기록:
 * > `design/quick-specs/assignment-reluctance-2026-08-09.md`.
 *
 * 세 노브가 **여전히 서로 다른 값인 것**은 유지된다. 성격이 다르기 때문이다 —
 * `assignmentTrustThreshold`와 `survivalRefusalRisk`는 경고를 띄우고 대가를 물리는
 * 임계값이고, `gloryVolunteerRisk`는 강조 표시만 하는 힌트다. 같은 값을 재사용하면
 * 밸런스 패스에서 한쪽을 조정할 때 다른 쪽이 조용히 따라 움직인다.
 *
 * ## 모든 단계에 나가는 문이 있다
 *
 * 위 버그의 진짜 형태는 "거부 규칙"이 아니라 **"탈출구 없는 단계"** 였다. 꺼림을
 * 풀어도 가용 길드원이 0명이면(사망·부상·파견 중이 겹치면) 강행할 대상조차 없어
 * 같은 정지가 재현된다. 그래서 `assigning`과 `waiting`에도 `return`을 둔다 —
 * **이 화면의 네 단계 전부가 나가는 문을 가진다**는 것이 이제 이 파일의 불변식이다.
 *
 * ## 등급·성격·목표 라벨은 `../screen`에서 가져온다
 *
 * 화면이 여러 개 생기는데 각자 라벨을 하드코딩하면 "수다스러움"과 "수다스럽다"처럼
 * 화면마다 어휘가 갈린다. 그런 어긋남은 버그로 걸리지 않고 그냥 조잡해 보인다.
 */
import { dispatchParty, type GameState } from '../../domain/gameState';
import { concealedKnownRisk } from '../../domain/negotiation';
import { gradeOf, type Adventurer, type Contract, type GradeThresholds } from '../../domain/types';
import { castIndexOf, escapeHtml, GOAL_LABELS, GRADE_LABELS, TRAIT_LABELS, type ScreenHandle } from '../screen';

export type { ScreenHandle };

export interface DispatchSettlement {
  readonly contract: Contract;
  readonly offer: { readonly rewardMultiplier: number; readonly discloseRisk: boolean };
  readonly agreedReward: number;
}

/**
 * 배정 화면이 쓰는 두 임계값. `balance.json`의 `dispatch` 절에서 온다.
 *
 * 파견 판정(`DispatchConfig`, `dispatch.ts`)과 분리돼 있다 — 판정은 이 값들을 몰라도
 * 되고, 이건 순전히 이 화면의 배정 규칙이다.
 */
export interface AssignmentRules {
  /** 이 위험도를 넘는 의뢰는 `goal === 'survival'`이 꺼린다 (경고 + 대가, 게이트 아님) */
  readonly survivalRefusalRisk: number;
  /** 이 아래로 신뢰가 떨어지면 목표와 무관하게 꺼린다 (경고 + 대가, 게이트 아님) */
  readonly assignmentTrustThreshold: number;
  /** 이 위험도를 넘는 의뢰에서 `goal === 'glory'`를 강조한다 (힌트일 뿐, 대가 없음) */
  readonly gloryVolunteerRisk: number;
  /** 꺼리는 사람을 강행 배정했을 때 그 사람의 신뢰 감소분(음수) */
  readonly forcedAssignmentTrustPenalty: number;
  /** 동시에 진행할 수 있는 파견 수. 길드 등급이 소유한다. */
  readonly maxConcurrentDispatches: number;
}

export interface DispatchScreenDeps {
  readonly state: GameState;
  /** 창구에서 막 타결된 의뢰 하나. 이 화면은 이 계약 하나의 배정~결과만 다룬다 */
  readonly settlement: DispatchSettlement;
  readonly gradeThresholds: GradeThresholds;
  readonly assignmentRules: AssignmentRules;
  /** 배정하거나 미룬 뒤 길드 홀 게시판으로 돌아간다. */
  readonly onReturnToHall: () => void;
}

type Phase = 'assigning' | 'dispatched' | 'error';

/**
 * 파견 화면을 그린다.
 *
 * @param root 그려 넣을 요소. 기존 내용은 지워진다
 */
export function mountDispatchScreen(root: HTMLElement, deps: DispatchScreenDeps): ScreenHandle {
  const contract: Contract = deps.settlement.contract;
  const selected = new Set<string>();

  let phase: Phase = 'assigning';
  /** 확정 직후 `dispatchParty`가 돌려준 것. 결과가 나온 뒤에도 partyIds를 읽으려고 들고 있는다 */
  let confirmedPartyIds: readonly string[] = [];
  let message = '';
  let destroyed = false;

  const onClick = (event: Event): void => handleClick(event);
  const onInput = (event: Event): void => handleInput(event);

  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  render();

  return {
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      root.removeEventListener('click', onClick);
      root.removeEventListener('input', onInput);
      root.innerHTML = '';
    },
  };

  function handleClick(event: Event): void {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const button = target.closest<HTMLElement>('[data-action]');
    if (button === null) return;

    const action = button.dataset.action;
    if (action === 'confirm') confirmAssignment();
    else if (action === 'return') deps.onReturnToHall();
  }

  /**
   * 체크박스 토글. 슬라이더와 달리 연속 입력이 아니므로 전체 재렌더를 쓴다 —
   * "부분 갱신은 연속 입력에만" 규칙이 여기엔 적용되지 않는다.
   */
  function handleInput(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.dataset.field !== 'member') return;

    const id = input.dataset.id;
    if (id === undefined) return;

    if (input.checked) {
      const member = memberById(id);
      // 꺼림은 더 이상 여기서 막지 않는다 — 정원만 막는다. 꺼리는 사람을 체크하는 것이
      // 바로 "강행한다"는 결정이고, 그 대가는 확정할 때 치른다.
      const blocked =
        member === undefined || (!selected.has(id) && selected.size >= contract.maxPartySize);

      if (!blocked) selected.add(id);
      // 막힌 시도는 그냥 무시한다 — 재렌더가 체크박스를 selected 기준으로 다시 그리므로
      // 화면에 반영된 것처럼 보였던 체크 표시가 원상 복구된다.
    } else {
      selected.delete(id);
    }
    render();
  }

  function memberById(id: string): Adventurer | undefined {
    return deps.state.roster.find((member) => member.id === id);
  }

  /**
   * 배정 후보 — **길드원 중** 지금 나갈 수 있는 사람.
   *
   * `inGuild` 조건이 빠지면 월드 풀 22명이 통째로 나오고, 그러면 **영입(Story 015)이
   * 존재할 이유가 사라진다.** 돈을 내고 데려올 필요 없이 아무나 보내면 되기 때문이다.
   * 외부 모험가는 길드 홀에서 대화해 정보를 얻는 대상이지 파견 대상이 아니다.
   */
  function assignableMembers(): Adventurer[] {
    return deps.state.roster.filter((member) => member.inGuild && member.status === 'available');
  }

  /**
   * 이 배정을 꺼리는 사유. `undefined`면 순순히 간다.
   *
   * **막지 않는다 — 경고하고 값을 매긴다.** 문구가 *"받아들이지 않는다"* 가 아니라
   * *"강행하면 신뢰를 더 잃는다"* 인 것이 이 함수가 게이트가 아니라는 표시다.
   *
   * 사유 텍스트를 지우지 않고 남기는 것이 중요하다. 회색 체크박스가 아무 설명 없이
   * 사라지면 플레이어는 그런 규칙이 있다는 것조차 모른다 — `CounterScreen`의
   * 「비활성 사유를 반드시 적는다」와 같은 규약이다. 없애는 것은 정보가 아니라
   * 강제력이다.
   *
   * 신뢰 부족을 먼저 본다 — 신뢰가 없으면 목표가 무엇이든 애초에 이 길드의 말을
   * 듣지 않는다는 것이 더 근본적인 이유이기 때문이다.
   */
  function reluctanceReason(member: Adventurer): string | undefined {
    if (member.trust < deps.assignmentRules.assignmentTrustThreshold) {
      return '아직 이 길드를 믿지 않는다. 강행하면 신뢰를 더 잃는다.';
    }
    if (member.goal === 'survival' && contract.statedRisk > deps.assignmentRules.survivalRefusalRisk) {
      return `${GOAL_LABELS.survival}을 최우선으로 여긴다. 강행하면 신뢰를 더 잃는다.`;
    }
    return undefined;
  }

  /** 지금 선택된 사람 중 꺼리는 이들. 확정 시 대가를 무는 대상이다 */
  function reluctantSelection(): string[] {
    return [...selected].filter((id) => {
      const member = memberById(id);
      return member !== undefined && reluctanceReason(member) !== undefined;
    });
  }

  /** glory 강조 표시 대상인가 — 게이트가 아니라 힌트이므로 별도 임계값을 쓴다 */
  function isGloryVolunteer(member: Adventurer): boolean {
    return member.goal === 'glory' && contract.statedRisk > deps.assignmentRules.gloryVolunteerRisk;
  }

  function confirmAssignment(): void {
    if (phase !== 'assigning') return;
    if (selected.size < 1 || selected.size > contract.maxPartySize) return;

    const partyIds = [...selected];
    // 명부에 없는 id만 막는다. 꺼림은 더 이상 막지 않는다 — 대가를 물고 보낸다.
    if (partyIds.some((id) => memberById(id) === undefined)) return;
    const reluctantIds = reluctantSelection();

    // 실제 위험을 알고도 계약서에 적지 않았는가 — Story 013의 trust 하락폭이 이 값을 읽는다.
    //
    // 판정을 `negotiation.ts`에 맡기는 이유: 여기서 직접 `revealedFacts`만 보면
    // **정직한 의뢰인(`concealment === 0`)이 침묵으로 오판된다.** 숨긴 것이 없으면
    // 고지할 것도 없으므로 속인 것이 아니다. 위험 고지 축의 개폐 규칙과 침묵 표식은
    // 같은 두 조건을 쓰며, 그 규칙이 사는 곳은 도메인이다.
    const wasConcealed = concealedKnownRisk(
      contract,
      deps.state.knowledge,
      deps.settlement.offer.discloseRisk,
    );

    try {
      const dispatched = dispatchParty(deps.state, contract.id, partyIds, {
        // 타결액을 그대로 넘긴다. 완수하면 전액 들어오고 사망이면 한 푼도 못 받는다 —
        // 선불 축과 잔금 미지급 판정이 폐기되면서 그 사이의 중간 상태가 사라졌다.
        agreedReward: deps.settlement.agreedReward,
        concealedKnownRisk: wasConcealed,
        // 누가 꺼렸는지는 이 화면만 안다(임계값이 여기 있으므로). 도메인은 명단을
        // 받아 대가만 적용한다 — `gameState.ts`가 배정 규칙을 갖지 않는 경계 그대로다.
        reluctantIds,
        forcedAssignmentTrustPenalty: deps.assignmentRules.forcedAssignmentTrustPenalty,
        maxConcurrentDispatches: deps.assignmentRules.maxConcurrentDispatches,
      });
      confirmedPartyIds = dispatched.partyIds;
      phase = 'dispatched';
    } catch (error) {
      phase = 'error';
      message = error instanceof Error ? error.message : String(error);
    }
    render();
  }

  function render(): void {
    if (destroyed) return;
    root.innerHTML = renderBody();
  }

  function renderBody(): string {
    if (phase === 'assigning') return renderAssigning();
    if (phase === 'dispatched') return renderDispatched();
    if (phase === 'error') return renderMessageScreen('배정 실패', message);
    return renderMessageScreen('진행할 수 없다', message);
  }

  function renderHeader(title: string): string {
    return `
      <header class="dispatch__header">
        <h1 class="dispatch__title">${title}</h1>
        ${renderFacts()}
      </header>
    `;
  }

  function renderFacts(): string {
    return `
      <dl class="dispatch__facts">
        <div><dt>의뢰인</dt><dd>${escapeHtml(contract.client.name)}</dd></div>
        <div><dt>위험도</dt><dd>${round(contract.statedRisk)}</dd></div>
        <div><dt>보상</dt><dd>${round(deps.settlement.agreedReward)}G</dd></div>
        <div><dt>소요</dt><dd>${contract.durationWeeks}주</dd></div>
        <div><dt>정원</dt><dd>${contract.maxPartySize}명</dd></div>
      </dl>
    `;
  }

  /**
   * 배정 단계.
   *
   * 「나중에 배정한다」가 **이 단계에 반드시 있어야 한다.** 없으면 고를 사람이 하나도
   * 없을 때(전원 사망·부상·파견 중) 확정이 영구히 비활성이면서 나갈 문도 없어 게임이
   * 멈춘다. 그 정지가 실제로 발생했다 — 파일 상단의 개정 주석 참조.
   *
   * 의뢰는 나가도 **열린 채로 남는다.** `dispatchParty`가 `openContracts`에서 계약을
   * 빼는 것은 확정 시점이므로, 여기서 나가는 것만으로는 아무것도 잃지 않는다.
   * 타결 조건은 `GameState.settlements`가 들고 있어 창구에서 그대로 이어진다.
   */
  function renderAssigning(): string {
    const members = assignableMembers();
    const rows = members.map((member) => renderRosterRow(member)).join('');
    const atMissionCapacity = deps.state.activeDispatches.length >= deps.assignmentRules.maxConcurrentDispatches;
    const canConfirm = !atMissionCapacity && selected.size >= 1 && selected.size <= contract.maxPartySize;
    const forcing = reluctantSelection().length;

    return `
      <section class="dispatch dispatch--assignment">
        ${renderHeader('파견 배정')}
        <ul class="roster-list">
          ${rows === '' ? '<li class="roster-list__empty">배정 가능한 길드원이 없다.</li>' : rows}
        </ul>
        ${atMissionCapacity ? '<p class="dispatch__forcing">동시 파견 한도에 도달했다. 진행 중인 파견이 돌아온 뒤 배정할 수 있다.</p>' : ''}
        ${
          forcing === 0
            ? ''
            : `<p class="dispatch__forcing">내키지 않아 하는 ${forcing}명을 강행 배정한다. 그만큼 신뢰를 잃는다.</p>`
        }
        <footer class="dispatch__actions">
          <span class="dispatch__count">${selected.size} / ${contract.maxPartySize}명 선택</span>
          <button class="dispatch__return dispatch__return--aside" type="button"
                  data-action="return">나중에 배정한다</button>
          <button class="dispatch__confirm" type="button" data-action="confirm"
                  ${canConfirm ? '' : 'disabled'}>배정 확정</button>
        </footer>
      </section>
    `;
  }

  /**
   * 명부 한 줄.
   *
   * 꺼리는 사람도 **체크할 수 있다.** 비활성은 정원이 찼을 때뿐이다 — 그것만이 규칙상
   * 정말 불가능한 것이고, 꺼림은 가능하되 비싼 것이다. 체크된 꺼림은
   * `roster-row--forced`로 따로 표시해 "지금 내가 강행하고 있다"가 보이게 한다.
   */
  function renderRosterRow(member: Adventurer): string {
    const reason = reluctanceReason(member);
    const checked = selected.has(member.id);
    const atCapacity = !checked && selected.size >= contract.maxPartySize;
    const reluctant = reason !== undefined;

    const glory = isGloryVolunteer(member);
    const classes = [
      'roster-row',
      reluctant ? 'roster-row--reluctant' : '',
      reluctant && checked ? 'roster-row--forced' : '',
      glory ? 'roster-row--glory' : '',
    ]
      .filter((name) => name !== '')
      .join(' ');

    return `
      <li class="${classes}">
        <label class="roster-row__label">
          <input type="checkbox" class="roster-row__check" data-field="member" data-id="${member.id}"
                 ${checked ? 'checked' : ''} ${atCapacity ? 'disabled' : ''} />
          <span class="roster-row__portrait" style="--cast: ${castIndexOf(member.id)}" aria-hidden="true"></span>
          <span class="roster-row__name">${escapeHtml(member.name)}</span>
          <span class="roster-row__grade">${GRADE_LABELS[gradeOf(member.capability, deps.gradeThresholds)]}</span>
          <span class="roster-row__traits">${member.traits.map((trait) => TRAIT_LABELS[trait]).join(' · ')}</span>
          ${glory ? `<span class="roster-row__badge">${GOAL_LABELS.glory}를 좇아 자원한다</span>` : ''}
        </label>
        ${reason === undefined ? '' : `<p class="roster-row__reason">${escapeHtml(reason)}</p>`}
      </li>
    `;
  }

  function renderDispatched(): string {
    const names = confirmedPartyIds.flatMap((id) => {
      const member = memberById(id);
      return member === undefined ? [] : [member.name];
    }).join(', ');
    return `
      <section class="dispatch">
        ${renderHeader('파견 중')}
        <p class="dispatch__waiting">${escapeHtml(names)} 파티가 출발했다. 결과는 주 마감 뒤 도착한다.</p>
        <footer class="dispatch__actions">
          <button class="dispatch__return dispatch__return--aside" type="button"
                  data-action="return">길드 홀로 돌아간다</button>
        </footer>
      </section>
    `;
  }

  function renderMessageScreen(title: string, body: string): string {
    return `
      <section class="dispatch">
        <header class="dispatch__header">
          <h1 class="dispatch__title">${escapeHtml(title)}</h1>
        </header>
        ${body === '' ? '' : `<p class="dispatch__message">${escapeHtml(body)}</p>`}
        <footer class="dispatch__actions">
          <button class="dispatch__return" type="button" data-action="return">길드 홀로 돌아간다</button>
        </footer>
      </section>
    `;
  }
}

function round(value: number): number {
  return Math.round(value);
}
