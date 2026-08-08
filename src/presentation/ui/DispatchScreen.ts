/**
 * 파견 화면 — 파티 배정 + 결과 (최소판, Day 1 종료 게이트).
 *
 * 이 화면이 끝나면 "의뢰 받고 사람 보내서 결과 보기"가 완주된다. "알았던 것 vs
 * 실제였던 것" 대조는 Story 014, `trust`·`Memory` 갱신은 Story 013, 자금·명성 반영은
 * Story 012의 몫이다 — 여기서는 배정과 "무슨 일이 일어났는가"만 보여준다.
 *
 * ## 회차 진행은 여기서 소유하지 않는다
 *
 * `advanceDay(state, config)`를 이 화면이 직접 부르지 않는다. 하루가 지나면 **다른
 * 파견도 조용히 판정되고 의뢰도 리필된다** — 그 전역 효과는 프레젠테이션 계층의
 * 소관이 아니다. 그래서 `onAdvanceDay`를 콜백으로 주입받는다. 실제 호출은 main.ts가
 * 하고, 이 화면은 반환된 `DayReport.resolved`에서 자기 계약 id만 찾는다. Story 010
 * (길드 홀)도 하루를 넘겨야 하므로, 진행의 주인을 하나로 유지하는 것이 이 경계의
 * 이유다.
 *
 * ## 배정 거부는 하드 게이트, glory 자원은 힌트
 *
 * `assignmentRules`가 이 둘을 서로 다른 노브로 받는 이유는 성격이 다르기 때문이다 —
 * `survivalRefusalRisk`는 넘으면 배정 자체가 막히는 게이트이고, `gloryVolunteerRisk`는
 * 강조 표시만 하는 힌트다. 같은 값을 재사용하면 밸런스 패스에서 거부 임계값을 조정할
 * 때 자원 표시가 조용히 따라 움직인다.
 *
 * ## 등급·성격·목표 라벨은 `../screen`에서 가져온다
 *
 * 화면이 여러 개 생기는데 각자 라벨을 하드코딩하면 "수다스러움"과 "수다스럽다"처럼
 * 화면마다 어휘가 갈린다. 그런 어긋남은 버그로 걸리지 않고 그냥 조잡해 보인다.
 */
import { dispatchParty, type DayReport, type GameState } from '../../domain/gameState';
import type { DispatchOutcome, DispatchResult } from '../../domain/dispatch';
import { narrate, type TextBank } from '../../domain/text';
import { gradeOf, type Adventurer, type Contract, type GradeThresholds } from '../../domain/types';
import { escapeHtml, GOAL_LABELS, GRADE_LABELS, TRAIT_LABELS, type ScreenHandle } from '../screen';
import type { Settlement } from './CounterScreen';

export type { ScreenHandle };

/**
 * 배정 화면이 쓰는 두 임계값. `balance.json`의 `dispatch` 절에서 온다.
 *
 * 파견 판정(`DispatchConfig`, `dispatch.ts`)과 분리돼 있다 — 판정은 이 값들을 몰라도
 * 되고, 이건 순전히 이 화면의 배정 규칙이다.
 */
export interface AssignmentRules {
  /** 이 위험도를 넘는 의뢰는 `goal === 'survival'`을 거부한다 (하드 게이트) */
  readonly survivalRefusalRisk: number;
  /** 이 아래로 신뢰가 떨어지면 목표와 무관하게 거부한다 */
  readonly assignmentTrustThreshold: number;
  /** 이 위험도를 넘는 의뢰에서 `goal === 'glory'`를 강조한다 (힌트일 뿐, 게이트 아님) */
  readonly gloryVolunteerRisk: number;
}

export interface DispatchScreenDeps {
  readonly state: GameState;
  /** 창구에서 막 타결된 의뢰 하나. 이 화면은 이 계약 하나의 배정~결과만 다룬다 */
  readonly settlement: Settlement;
  readonly gradeThresholds: GradeThresholds;
  readonly assignmentRules: AssignmentRules;
  readonly text: TextBank;
  /**
   * 하루를 넘긴다. 실제 `advanceDay(state, config)` 호출은 main.ts가 한다.
   *
   * 이 화면은 `GameConfig`를 몰라도 되고, 다른 파견까지 조용히 판정되는 전역 효과를
   * 소유하지 않는다.
   */
  readonly onAdvanceDay: () => DayReport;
  /** 결과를 확인하고 창구로 돌아갈 때 호출된다. 화면 전환 자체는 main.ts가 한다 */
  readonly onReturnToCounter: () => void;
}

type Phase = 'assigning' | 'waiting' | 'result' | 'ended' | 'error';

/** 파견 결과 판정을 어느 서술 상황으로 조립할지. `text.json`에 셋 다 이미 있다. */
const RESULT_SITUATION: Readonly<Record<DispatchOutcome, string>> = {
  success: 'resultSuccess',
  injured: 'resultInjured',
  dead: 'resultDead',
};

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
  let resolveOnDay = 0;
  let resolvedResult: DispatchResult | undefined;
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
    if (!(target instanceof HTMLElement)) return;

    const button = target.closest<HTMLElement>('[data-action]');
    if (button === null) return;

    const action = button.dataset.action;
    if (action === 'confirm') confirmAssignment();
    else if (action === 'advance-day') advanceOnce();
    else if (action === 'return') deps.onReturnToCounter();
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
      const blocked =
        member === undefined ||
        refusalReason(member) !== undefined ||
        (!selected.has(id) && selected.size >= contract.maxPartySize);

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

  function assignableMembers(): Adventurer[] {
    return deps.state.roster.filter((member) => member.status === 'available');
  }

  /**
   * 배정 거부 사유. `undefined`면 배정 가능하다.
   *
   * 신뢰 부족을 먼저 본다 — 신뢰가 없으면 목표가 무엇이든 애초에 이 길드의 말을
   * 듣지 않는다는 것이 더 근본적인 이유이기 때문이다.
   */
  function refusalReason(member: Adventurer): string | undefined {
    if (member.trust < deps.assignmentRules.assignmentTrustThreshold) {
      return '아직 이 길드를 믿지 않아 배정을 받아들이지 않는다.';
    }
    if (member.goal === 'survival' && contract.statedRisk > deps.assignmentRules.survivalRefusalRisk) {
      return `${GOAL_LABELS.survival}을 최우선으로 여겨 이만큼 위험한 배정은 사양한다.`;
    }
    return undefined;
  }

  /** glory 강조 표시 대상인가 — 게이트가 아니라 힌트이므로 별도 임계값을 쓴다 */
  function isGloryVolunteer(member: Adventurer): boolean {
    return member.goal === 'glory' && contract.statedRisk > deps.assignmentRules.gloryVolunteerRisk;
  }

  function confirmAssignment(): void {
    if (phase !== 'assigning') return;
    if (selected.size < 1 || selected.size > contract.maxPartySize) return;

    const partyIds = [...selected];
    const anyBlocked = partyIds.some((id) => {
      const member = memberById(id);
      return member === undefined || refusalReason(member) !== undefined;
    });
    if (anyBlocked) return;

    // 실제 위험을 알고도 계약서에 적지 않았는가 — Story 013의 trust 하락폭이 이 값을 읽는다.
    const concealedKnownRisk =
      deps.state.knowledge.revealedFacts.has(`${contract.id}:realRisk`) &&
      !deps.settlement.offer.discloseRisk;

    try {
      const dispatched = dispatchParty(deps.state, contract.id, partyIds, {
        advancePaid: deps.settlement.advancePaid,
        // story-012(경제) 통합 후 ActiveDispatch가 요구하는 필드. gameState.ts 쪽 타입
        // 반영은 별도로 진행 중이라 지금은 tsc가 이 프로퍼티를 초과 속성으로 잡는다.
        remainingReward: deps.settlement.agreedReward - deps.settlement.advancePaid,
        concealedKnownRisk,
      });
      confirmedPartyIds = dispatched.partyIds;
      resolveOnDay = dispatched.resolveOnDay;
      phase = 'waiting';
    } catch (error) {
      phase = 'error';
      message = error instanceof Error ? error.message : String(error);
    }
    render();
  }

  /**
   * 하루를 넘겨 달라고 바깥에 요청한다.
   *
   * `onAdvanceDay`가 무엇을 하는지 이 화면은 모른다 — 그저 `DayReport`를 받아서 자기
   * 계약 id가 판정됐는지만 확인한다. 세션이 이미 끝났거나 하는 예외는 콜백이 던질 수
   * 있고, 그때 화면이 죽지 않도록 잡아서 'ended'로 접는다.
   */
  function advanceOnce(): void {
    if (phase !== 'waiting') return;

    try {
      const report = deps.onAdvanceDay();
      const found = report.resolved.find((entry) => entry.dispatch.contract.id === contract.id);
      if (found !== undefined) {
        resolvedResult = found.result;
        phase = 'result';
      }
    } catch (error) {
      phase = 'ended';
      message = error instanceof Error ? error.message : '회차가 끝나 더 이상 진행할 수 없다.';
    }
    render();
  }

  function render(): void {
    if (destroyed) return;
    root.innerHTML = renderBody();
  }

  function renderBody(): string {
    if (phase === 'assigning') return renderAssigning();
    if (phase === 'waiting') return renderWaiting();
    if (phase === 'result') return renderResult();
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
        <div><dt>소요</dt><dd>${contract.durationDays}일</dd></div>
        <div><dt>정원</dt><dd>${contract.maxPartySize}명</dd></div>
      </dl>
    `;
  }

  function renderAssigning(): string {
    const members = assignableMembers();
    const rows = members.map((member) => renderRosterRow(member)).join('');
    const canConfirm = selected.size >= 1 && selected.size <= contract.maxPartySize;

    return `
      <section class="dispatch">
        ${renderHeader('파견 배정')}
        <ul class="roster-list">
          ${rows === '' ? '<li class="roster-list__empty">배정 가능한 길드원이 없다.</li>' : rows}
        </ul>
        <footer class="dispatch__actions">
          <span class="dispatch__count">${selected.size} / ${contract.maxPartySize}명 선택</span>
          <button class="dispatch__confirm" type="button" data-action="confirm"
                  ${canConfirm ? '' : 'disabled'}>배정 확정</button>
        </footer>
      </section>
    `;
  }

  function renderRosterRow(member: Adventurer): string {
    const reason = refusalReason(member);
    const atCapacity = !selected.has(member.id) && selected.size >= contract.maxPartySize;
    const disabled = reason !== undefined || atCapacity;
    const glory = isGloryVolunteer(member);

    return `
      <li class="roster-row${reason !== undefined ? ' roster-row--refused' : ''}${glory ? ' roster-row--glory' : ''}">
        <label class="roster-row__label">
          <input type="checkbox" class="roster-row__check" data-field="member" data-id="${member.id}"
                 ${selected.has(member.id) ? 'checked' : ''} ${disabled ? 'disabled' : ''} />
          <span class="roster-row__name">${escapeHtml(member.name)}</span>
          <span class="roster-row__grade">${GRADE_LABELS[gradeOf(member.capability, deps.gradeThresholds)]}</span>
          <span class="roster-row__traits">${member.traits.map((trait) => TRAIT_LABELS[trait]).join(' · ')}</span>
          ${glory ? `<span class="roster-row__badge">${GOAL_LABELS.glory}를 좇아 자원한다</span>` : ''}
        </label>
        ${reason !== undefined ? `<p class="roster-row__reason">${escapeHtml(reason)}</p>` : ''}
      </li>
    `;
  }

  function renderWaiting(): string {
    const remaining = Math.max(0, resolveOnDay - deps.state.day);

    return `
      <section class="dispatch">
        ${renderHeader('파견 중')}
        <p class="dispatch__waiting">돌아올 때까지 ${remaining}일 남았다.</p>
        <footer class="dispatch__actions">
          <button class="dispatch__advance" type="button" data-action="advance-day">하루가 지난다</button>
        </footer>
      </section>
    `;
  }

  function renderResult(): string {
    if (resolvedResult === undefined) return renderMessageScreen('결과 없음', '');

    const result = resolvedResult;
    const rows = confirmedPartyIds.map((id) => renderResultRow(id, result)).join('');

    return `
      <section class="dispatch">
        ${renderHeader('파견 결과')}
        <ul class="result-list">${rows}</ul>
        <footer class="dispatch__actions">
          <button class="dispatch__return" type="button" data-action="return">창구로 돌아간다</button>
        </footer>
      </section>
    `;
  }

  function renderResultRow(memberId: string, result: DispatchResult): string {
    const member = memberById(memberId);
    if (member === undefined) return '';

    const outcome: DispatchOutcome = member.id === result.casualtyId ? result.outcome : 'success';
    const line = narrate(
      deps.text,
      RESULT_SITUATION[outcome],
      member.traits,
      { name: member.name },
      deps.state.rng,
    );

    return `
      <li class="result-row${outcome === 'dead' ? ' result-row--dead' : ''}">
        <span class="result-row__name">${escapeHtml(member.name)}</span>
        <p class="result-row__line">${escapeHtml(line)}</p>
      </li>
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
          <button class="dispatch__return" type="button" data-action="return">창구로 돌아간다</button>
        </footer>
      </section>
    `;
  }
}

function round(value: number): number {
  return Math.round(value);
}
