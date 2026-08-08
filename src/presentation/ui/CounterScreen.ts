/**
 * 창구 화면 — 플레이어가 이 게임을 처음 보는 곳.
 *
 * 심사위원이 5분 안에 재미를 느껴야 한다는 제약의 최전선이다. 그래서 이 화면이
 * 가르쳐야 하는 것은 규칙이 아니라 **"모르면 손해다"** 하나다.
 *
 * ## 비활성 사유를 반드시 적는다
 *
 * 위험 고지 토글이 그냥 회색이면 플레이어는 **버그로 읽는다.** *"이 의뢰의 실제
 * 위험을 아직 모른다"* 라고 적혀 있어야 소문을 캐러 갈 이유가 생긴다 —
 * **정보 = 흥정력을 UI가 가르치는 유일한 지점이다.**
 *
 * ## 결렬하면 진실을 렌더하지 않는다
 *
 * 감추는 것이 아니라 **애초에 그리지 않는다.** DOM을 뒤져도 실제 위험도가 없어야
 * 한다. 결렬된 의뢰의 진실이 새어 나가면 "알아내는 것"의 값이 0이 된다.
 *
 * ## 화면 모듈의 규약
 *
 * UI 프레임워크를 쓰지 않으므로 규약을 코드로 세운다 — `mount...`가 루트에 그리고
 * {@link ScreenHandle}을 돌려주며, `destroy()`가 리스너와 DOM을 정리한다. 이후 화면도
 * 이 모양을 따른다. 리스너는 루트 하나에만 걸고 `data-action`으로 위임한다. 카드마다
 * 리스너를 걸면 다시 그릴 때 해제를 빠뜨려 새는 곳이 생긴다.
 */
import type { GameState } from '../../domain/gameState';
import {
  evaluateOffer,
  type NegotiationConfig,
  type NegotiationResult,
  type Offer,
} from '../../domain/negotiation';
import { narrate, type TextBank } from '../../domain/text';
import type { Contract } from '../../domain/types';

/** 모든 화면 모듈이 돌려주는 것. */
export interface ScreenHandle {
  /** 리스너와 DOM을 정리한다. 두 번 불러도 안전하다 */
  destroy(): void;
}

/**
 * 위험 고지 축을 열 수 있는가.
 *
 * 판정은 Story 011의 몫이고 이 화면은 결과를 렌더만 한다. `reason`이 비어 있으면
 * 플레이어가 비활성을 버그로 읽으므로, 막을 때는 **반드시 이유를 준다.**
 */
export interface DisclosureStatus {
  readonly allowed: boolean;
  readonly reason?: string;
}

/** 창구에서 부를 수 있는 범위. `balance.json`의 `negotiation` 절에서 온다. */
export interface OfferBounds {
  readonly rewardMin: number;
  readonly rewardMax: number;
  readonly step: number;
}

export interface CounterScreenDeps {
  readonly state: GameState;
  readonly negotiation: NegotiationConfig;
  readonly bounds: OfferBounds;
  readonly text: TextBank;
  /** Story 011이 주입한다. 없으면 항상 잠긴다 */
  readonly disclosureStatus: (contract: Contract) => DisclosureStatus;
  /** 타결되면 호출된다. 배정 화면(Story 008)이 이어받는다 */
  readonly onSettled: (settlement: Settlement) => void;
}

/** 타결된 계약. 배정 화면이 이것을 받아 파견으로 넘긴다. */
export interface Settlement {
  readonly contract: Contract;
  readonly offer: Offer;
  /** 흥정이 끝난 최종 보상 */
  readonly agreedReward: number;
  /** 선불로 받은 금액. **사망해도 남는다** */
  readonly advancePaid: number;
}

/** 화면이 들고 있는 제안 초안. 아직 내밀지 않은 조건이다. */
interface Draft {
  rewardMultiplier: number;
  advanceRatio: number;
  discloseRisk: boolean;
  /** 직전 제안의 판정 결과. 반박 문장을 그리는 근거다 */
  lastResult?: NegotiationResult;
  /** 의뢰인이 한 말 */
  message?: string;
  outcome?: 'countered' | 'broken' | 'settled';
}

const NEUTRAL_REWARD = 1;

/**
 * 창구 화면을 그린다.
 *
 * @param root 그려 넣을 요소. 기존 내용은 지워진다
 */
export function mountCounterScreen(root: HTMLElement, deps: CounterScreenDeps): ScreenHandle {
  const drafts = new Map<string, Draft>();
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

  function draftFor(contractId: string): Draft {
    let draft = drafts.get(contractId);
    if (draft === undefined) {
      draft = { rewardMultiplier: NEUTRAL_REWARD, advanceRatio: 0, discloseRisk: false };
      drafts.set(contractId, draft);
    }
    return draft;
  }

  function findContract(contractId: string): Contract | undefined {
    return deps.state.openContracts.find((contract) => contract.id === contractId);
  }

  /**
   * 슬라이더는 다시 그리지 않고 숫자 표시만 갱신한다.
   *
   * 드래그 중에 전체를 다시 그리면 슬라이더가 손에서 빠져나간다. 그리고 이쪽이
   * 훨씬 싸다 — 100ms 예산은 이렇게 지킨다.
   */
  function handleInput(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;

    const contractId = input.dataset.contract;
    const field = input.dataset.field;
    if (contractId === undefined || field === undefined) return;

    const draft = draftFor(contractId);
    if (field === 'reward') draft.rewardMultiplier = Number(input.value);
    else if (field === 'advance') draft.advanceRatio = Number(input.value);
    else if (field === 'disclose') draft.discloseRisk = input.checked;
    else return;

    updateReadouts(contractId);
  }

  function handleClick(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const button = target.closest<HTMLElement>('[data-action]');
    if (button === null) return;

    const contractId = button.dataset.contract;
    if (button.dataset.action === 'offer' && contractId !== undefined) {
      submitOffer(contractId);
    }
  }

  function submitOffer(contractId: string): void {
    const contract = findContract(contractId);
    if (contract === undefined) return;

    const draft = draftFor(contractId);
    if (draft.outcome === 'broken' || draft.outcome === 'settled') return;

    const offer: Offer = {
      rewardMultiplier: draft.rewardMultiplier,
      advanceRatio: draft.advanceRatio,
      // 잠긴 축은 초안이 켜져 있어도 무시한다. UI 상태를 규칙보다 믿으면 안 된다.
      discloseRisk: draft.discloseRisk && deps.disclosureStatus(contract).allowed,
    };

    const attempt = (deps.state.offersMade[contractId] ?? 0) + 1;
    deps.state.offersMade[contractId] = attempt;

    const result = evaluateOffer(offer, contract.client, deps.negotiation, attempt);
    draft.lastResult = result;

    if (result.outcome === 'accepted') {
      settle(contract, offer, draft);
      return;
    }

    if (result.outcome === 'broken') {
      draft.outcome = 'broken';
      draft.message = say(contract, 'negotiationBroken');
      // 카드를 걷어낸다. 숨은 진실은 끝내 그려지지 않는다.
      deps.state.openContracts = deps.state.openContracts.filter((c) => c.id !== contractId);
      render();
      return;
    }

    draft.outcome = 'countered';
    draft.message = say(
      contract,
      result.contestedAxis === 'advance' ? 'counterAdvance' : 'counterReward',
    );
    render();
  }

  function settle(contract: Contract, offer: Offer, draft: Draft): void {
    draft.outcome = 'settled';
    draft.message = say(contract, 'negotiationSettled');

    const agreedReward = contract.baseReward * offer.rewardMultiplier;
    render();

    deps.onSettled({
      contract,
      offer,
      agreedReward,
      advancePaid: agreedReward * offer.advanceRatio,
    });
  }

  function say(contract: Contract, situation: string): string {
    return narrate(deps.text, situation, contract.client.traits, {
      client: contract.client.name,
    }, deps.state.rng);
  }

  function updateReadouts(contractId: string): void {
    const contract = findContract(contractId);
    if (contract === undefined) return;
    const draft = draftFor(contractId);

    setText(`[data-readout="reward"][data-contract="${contractId}"]`, rewardLabel(contract, draft));
    setText(`[data-readout="advance"][data-contract="${contractId}"]`, advanceLabel(contract, draft));
  }

  function setText(selector: string, value: string): void {
    const node = root.querySelector(selector);
    if (node !== null) node.textContent = value;
  }

  function rewardLabel(contract: Contract, draft: Draft): string {
    return `${round(contract.baseReward * draft.rewardMultiplier)}G (×${draft.rewardMultiplier.toFixed(2)})`;
  }

  function advanceLabel(contract: Contract, draft: Draft): string {
    const reward = contract.baseReward * draft.rewardMultiplier;
    return `${round(reward * draft.advanceRatio)}G (${Math.round(draft.advanceRatio * 100)}%)`;
  }

  function render(): void {
    if (destroyed) return;

    const cards = deps.state.openContracts.map((contract) => renderCard(contract)).join('');
    const broken = [...drafts.entries()]
      .filter(([id, draft]) => draft.outcome === 'broken' && findContract(id) === undefined)
      .map(([, draft]) => `<p class="counter__broken">${escapeHtml(draft.message ?? '')}</p>`)
      .join('');

    root.innerHTML = `
      <section class="counter">
        <header class="counter__header">
          <h1 class="counter__day">${deps.state.day}일차</h1>
          <p class="counter__funds">자금 ${round(deps.state.funds)}G · 명성 ${round(deps.state.reputation)}</p>
        </header>
        ${broken}
        ${cards === '' ? '<p class="counter__empty">오늘은 더 이상 찾아온 사람이 없다.</p>' : cards}
      </section>
    `;
  }

  function renderCard(contract: Contract): string {
    const draft = draftFor(contract.id);
    const disclosure = deps.disclosureStatus(contract);
    const attempts = deps.state.offersMade[contract.id] ?? 0;
    const remaining = deps.negotiation.maxOffers - attempts;
    const closed = draft.outcome === 'settled';

    return `
      <article class="contract-card${closed ? ' contract-card--settled' : ''}" data-card="${contract.id}">
        <h2 class="contract-card__client">${escapeHtml(contract.client.name)}</h2>
        <dl class="contract-card__facts">
          <div><dt>위험도</dt><dd>${round(contract.statedRisk)}</dd></div>
          <div><dt>기본 보상</dt><dd>${round(contract.baseReward)}G</dd></div>
          <div><dt>소요</dt><dd>${contract.durationDays}일</dd></div>
          <div><dt>정원</dt><dd>${contract.maxPartySize}명</dd></div>
        </dl>

        ${closed ? '' : renderAxes(contract, draft, disclosure)}

        ${draft.message === undefined ? '' : `<p class="contract-card__reply">${escapeHtml(draft.message)}</p>`}

        ${
          closed
            ? '<p class="contract-card__stamp">계약 성립</p>'
            : `<footer class="contract-card__actions">
                 <button class="contract-card__offer" type="button"
                         data-action="offer" data-contract="${contract.id}">제안한다</button>
                 <span class="contract-card__attempts">남은 기회 ${remaining}회</span>
               </footer>`
        }
      </article>
    `;
  }

  function renderAxes(
    contract: Contract,
    draft: Draft,
    disclosure: DisclosureStatus,
  ): string {
    const { rewardMin, rewardMax, step } = deps.bounds;

    return `
      <div class="axis">
        <label class="axis__label" for="reward-${contract.id}">보상</label>
        <input class="axis__slider" type="range" id="reward-${contract.id}"
               min="${rewardMin}" max="${rewardMax}" step="${step}"
               value="${draft.rewardMultiplier}"
               data-field="reward" data-contract="${contract.id}" />
        <output class="axis__value" data-readout="reward" data-contract="${contract.id}"
        >${rewardLabel(contract, draft)}</output>
      </div>

      <div class="axis">
        <label class="axis__label" for="advance-${contract.id}">선불</label>
        <input class="axis__slider" type="range" id="advance-${contract.id}"
               min="0" max="1" step="${step}"
               value="${draft.advanceRatio}"
               data-field="advance" data-contract="${contract.id}" />
        <output class="axis__value" data-readout="advance" data-contract="${contract.id}"
        >${advanceLabel(contract, draft)}</output>
      </div>

      <div class="axis axis--toggle${disclosure.allowed ? '' : ' axis--locked'}">
        <label class="axis__label" for="disclose-${contract.id}">위험 고지</label>
        <input class="axis__check" type="checkbox" id="disclose-${contract.id}"
               ${draft.discloseRisk && disclosure.allowed ? 'checked' : ''}
               ${disclosure.allowed ? '' : 'disabled'}
               data-field="disclose" data-contract="${contract.id}" />
        ${
          disclosure.allowed
            ? '<span class="axis__hint">실제 위험을 계약서에 적는다.</span>'
            : `<span class="axis__hint axis__hint--locked">${escapeHtml(disclosure.reason ?? '')}</span>`
        }
      </div>
    `;
  }
}

function round(value: number): number {
  return Math.round(value);
}

/**
 * 이름은 생성된 것이지만 그대로 innerHTML에 넣지 않는다.
 *
 * `names.json`이 안전하다는 것은 **오늘의 사실**이지 구조적 보장이 아니다. 표를 늘리는
 * 사람이 이 함수의 존재를 모를 수 있다.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
