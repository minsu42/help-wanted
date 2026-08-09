/**
 * 창구 화면 — 의뢰인과 마주 앉아 조건을 흥정한다.
 *
 * 심사위원이 5분 안에 재미를 느껴야 한다는 제약의 최전선이다. 그래서 이 화면이
 * 가르쳐야 하는 것은 규칙이 아니라 **"모르면 손해다"** 하나다.
 *
 * ## 왜 슬라이더가 아니라 대사인가
 *
 * 축을 슬라이더로 맞추고 "제안한다"를 누르는 방식은 흥정을 **숫자 맞추기**로
 * 만든다. 그런데 이 게임에서 거부 응답은 장식이 아니라 **정보 채널이다** — 어느
 * 배율에서 반박이 돌아오는지가 곧 의뢰인의 숨은 상태(`wealth`·`urgency`)에 대한
 * 단서다. 슬라이더는 그 단서를 카드 한켠의 문장으로 흘려보내지만, 대화는 그것을
 * **다음 수를 고르는 근거**로 되돌려 놓는다. `negotiation.ts` 상단 주석이 "흥정
 * 과정이 그 정보 채널이 된다"고 적어 둔 설계가 인터페이스에서 실제로 성립하는
 * 지점이다.
 *
 * > 2026-08-09 개정 — 원래 이 문단은 `contestedAxis`가 **어느 축을 지목하는가**를
 * > 단서로 들었다("선불은 도저히 안 되겠소" → 현금이 없다). 선불 축이 폐기되면서
 * > 축이 하나만 남아 그 지목이 무정보가 됐다. 대화 인터페이스를 고른 이유 자체는
 * > 살아남지만 **단서의 종류가 "어느 축"에서 "어느 지점"으로 바뀌었다.**
 *
 * ## 판정은 하나도 바뀌지 않았다
 *
 * 선택지 하나가 곧 {@link Offer} 하나이고, 그것을 `evaluateOffer`에 그대로 넘긴다.
 * 도메인은 대화라는 것을 모른다 — 이 화면이 대사를 조건으로 번역할 뿐이다. 그래서
 * 흥정 판정 테스트(3대 필수 테스트 1번)는 이 변경에 손대지 않았다.
 *
 * ## 비활성 사유를 반드시 적는다
 *
 * 위험 고지 선택지가 그냥 회색이면 플레이어는 **버그로 읽는다.** *"이 의뢰의 실제
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
 * {@link ScreenHandle}을 돌려주며, `destroy()`가 리스너와 DOM을 정리한다. 리스너는
 * 루트 하나에만 걸고 `data-action`으로 위임한다. 카드마다 리스너를 걸면 다시 그릴 때
 * 해제를 빠뜨려 새는 곳이 생긴다.
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
import { escapeHtml, type ScreenHandle } from '../screen';

export type { ScreenHandle };

/**
 * 위험 고지 축을 열 수 있는가.
 *
 * 판정은 `canDisclose`(도메인)의 몫이고 이 화면은 결과를 렌더만 한다. `reason`이
 * 비어 있으면 플레이어가 비활성을 버그로 읽으므로, 막을 때는 **반드시 이유를 준다.**
 */
export interface DisclosureStatus {
  readonly allowed: boolean;
  readonly reason?: string;
}

/**
 * 흥정 선택지 하나의 수치. `balance.json`의 `negotiation.moves`에서 온다.
 *
 * `reward`는 **증분이 아니라 그 축이 도달할 절대값이다.** 생략하면 직전 상태를
 * 유지한다 — 그래서 "값을 올린다" 다음에 "크게 올린다"를 고르면 뒤엣것이 이기고,
 * "값 이야기는 접겠습니다"를 고르면 1배로 돌아간다. 증분으로 만들면 같은 선택지를
 * 두 번 눌렀을 때 어디까지 올라갔는지 플레이어가 셈해야 한다.
 *
 * > 2026-08-09 개정 — 선불 축(`advance`)이 폐기되면서 필드가 하나 빠졌다
 * > (`production/roadmap.md` P0 항목 1). 절대값 규약 자체는 축의 수와 무관하게
 * > 유효하며, P3의 「근거 기반 협상」이 축을 다시 늘릴 때 그대로 쓴다.
 */
export interface NegotiationMove {
  readonly id: string;
  readonly reward?: number;
  readonly disclose?: boolean;
}

/**
 * `text.json`에 이 화면이 추가한 `moves` 절.
 *
 * {@link TextBank}(도메인 소유, `text.ts`)는 이 키를 모른다 — `situations` 하나만
 * 안다. `EndingScreen`이 `endings`를 같은 방식으로 확장한 것과 같은 경계다.
 *
 * 선택지 문안이 `situations`가 아닌 이유: 말하는 사람이 **플레이어**이고 플레이어에게는
 * 성격 태그가 없다. 성격 필터를 거칠 대상이 없으므로 `narrate()`를 통과시키지 않는다.
 */
export interface CounterTextBank extends TextBank {
  readonly moves: Readonly<Record<string, string>>;
}

export interface CounterScreenDeps {
  readonly state: GameState;
  readonly negotiation: NegotiationConfig;
  /** 고를 수 있는 수의 목록. `balance.json`의 `negotiation.moves` */
  readonly moves: readonly NegotiationMove[];
  readonly text: CounterTextBank;
  /** `canDisclose`를 감싼 것이 주입된다. 없으면 항상 잠긴다 */
  readonly disclosureStatus: (contract: Contract) => DisclosureStatus;
  /** 타결되면 호출된다. 배정 화면이 이어받는다 */
  readonly onSettled: (settlement: Settlement) => void;
  /**
   * 길드 홀로 간다. **창구가 홀로 가는 유일한 문이다** — 정보를 캐는 창이 여기서만
   * 열리므로, 이 버튼이 없으면 "정보 = 흥정력"의 앞쪽 절반에 도달할 방법이 없다.
   */
  readonly onVisitHall: () => void;
  /**
   * 하루를 마감한다. 실제 `advanceDay` 호출과 이후 화면 전환은 main.ts가 한다 —
   * 이 화면은 회차 진행의 전역 효과를 소유하지 않는다.
   */
  readonly onEndDay: () => void;
}

/** 타결된 계약. 배정 화면이 이것을 받아 파견으로 넘긴다. */
export interface Settlement {
  readonly contract: Contract;
  readonly offer: Offer;
  /** 흥정이 끝난 최종 보상. 완수하면 전액 들어온다 */
  readonly agreedReward: number;
}

/** 이 의뢰와의 대화가 어디까지 왔는가. */
interface Talk {
  /** 지금까지 쌓인 조건 */
  rewardMultiplier: number;
  discloseRisk: boolean;
  /** 의뢰인이 마지막으로 한 말 */
  message: string;
  /** 직전 제안의 판정 결과. 반박 축을 강조하는 근거다 */
  lastResult?: NegotiationResult;
  outcome?: 'broken' | 'settled';
}

const NEUTRAL_REWARD = 1;

/**
 * 창구 화면을 그린다.
 *
 * @param root 그려 넣을 요소. 기존 내용은 지워진다
 */
export function mountCounterScreen(root: HTMLElement, deps: CounterScreenDeps): ScreenHandle {
  const talks = new Map<string, Talk>();
  /** 지금 창구에 앉아 있는 의뢰인. 나머지는 대기줄에 선다 */
  let activeId = deps.state.openContracts[0]?.id;
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

  function findContract(contractId: string | undefined): Contract | undefined {
    if (contractId === undefined) return undefined;
    return deps.state.openContracts.find((contract) => contract.id === contractId);
  }

  /** 이 의뢰와의 대화. 처음이면 의뢰인의 첫마디부터 시작한다. */
  function talkFor(contract: Contract): Talk {
    let talk = talks.get(contract.id);
    if (talk === undefined) {
      talk = {
        rewardMultiplier: NEUTRAL_REWARD,
        discloseRisk: false,
        message: say(contract, 'clientOpening'),
      };
      talks.set(contract.id, talk);
    }
    return talk;
  }

  function handleClick(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const button = target.closest<HTMLElement>('[data-action]');
    if (button === null) return;

    const action = button.dataset.action;

    if (action === 'select') {
      const contractId = button.dataset.contract;
      if (contractId !== undefined && findContract(contractId) !== undefined) {
        activeId = contractId;
        render();
      }
      return;
    }
    if (action === 'move') {
      const moveId = button.dataset.move;
      if (moveId !== undefined) playMove(moveId);
      return;
    }
    if (action === 'visit-hall') {
      deps.onVisitHall();
      return;
    }
    if (action === 'end-day') {
      deps.onEndDay();
    }
  }

  /**
   * 선택지 하나를 둔다 — 조건을 갱신하고 그것을 곧바로 제안한다.
   *
   * **한 수가 곧 제안 한 번이다.** 조건을 다 맞춘 뒤 따로 "제안한다"를 누르는 단계를
   * 두지 않는 이유는, 그 단계가 있으면 다시 숫자 맞추기가 되고 반박이 다음 수의
   * 근거가 되지 못하기 때문이다.
   */
  function playMove(moveId: string): void {
    const contract = findContract(activeId);
    if (contract === undefined) return;

    const talk = talkFor(contract);
    if (talk.outcome !== undefined) return;

    const move = deps.moves.find((candidate) => candidate.id === moveId);
    if (move === undefined) return;

    const disclosure = deps.disclosureStatus(contract);
    // 잠긴 축은 선택지가 눌려도 무시한다. UI 상태를 규칙보다 믿으면 안 된다.
    if (move.disclose === true && !disclosure.allowed) return;

    if (move.reward !== undefined) talk.rewardMultiplier = move.reward;
    if (move.disclose === true) talk.discloseRisk = true;

    const offer: Offer = {
      rewardMultiplier: talk.rewardMultiplier,
      discloseRisk: talk.discloseRisk && disclosure.allowed,
    };

    const attempt = (deps.state.offersMade[contract.id] ?? 0) + 1;
    deps.state.offersMade[contract.id] = attempt;

    const result = evaluateOffer(offer, contract.client, deps.negotiation, attempt);
    talk.lastResult = result;

    if (result.outcome === 'accepted') {
      settle(contract, offer, talk);
      return;
    }

    if (result.outcome === 'broken') {
      talk.outcome = 'broken';
      talk.message = say(contract, 'negotiationBroken');
      // 카드를 걷어낸다. 숨은 진실은 끝내 그려지지 않는다.
      deps.state.openContracts = deps.state.openContracts.filter((c) => c.id !== contract.id);
      // 창구가 비었으니 대기줄의 다음 사람을 앉힌다.
      activeId = deps.state.openContracts[0]?.id;
      render();
      return;
    }

    // 축이 보상 하나뿐이므로 반박 문안도 하나다. 삼항이 아니라 고정인 이유가 그것이며,
    // P3이 축을 다시 늘리면 `result.contestedAxis`로 갈라지는 자리로 되돌아온다.
    talk.message = say(contract, 'counterReward');
    render();
  }

  function settle(contract: Contract, offer: Offer, talk: Talk): void {
    talk.outcome = 'settled';
    talk.message = say(contract, 'negotiationSettled');

    const agreedReward = contract.baseReward * offer.rewardMultiplier;
    render();

    deps.onSettled({ contract, offer, agreedReward });
  }

  function say(contract: Contract, situation: string): string {
    return narrate(
      deps.text,
      situation,
      contract.client.traits,
      { client: contract.client.name },
      deps.state.rng,
    );
  }

  /**
   * 이 수를 지금 둘 수 있는가.
   *
   * 규칙은 하나다 — **조건이 실제로 달라지는 수만 보여준다.** 이미 보상이 1배인데
   * "값 이야기는 접겠습니다"가 떠 있으면 그건 선택지가 아니라 소음이다. 위험 고지만
   * 예외적으로 게이트를 추가로 본다.
   *
   * `takeAsIs`는 이 규칙에서 면제된다 — 조건이 이미 중립이어도 "그대로 받겠다"는
   * 언제나 유효한 수이고, 이것이 빠지면 고를 것이 하나도 없는 상태가 생길 수 있다.
   *
   * > 2026-08-09 — **이 면제가 이제 막다른 길을 막는 유일한 장치다.** 선불 축이
   * > 폐기되면서 남은 축이 보상 하나뿐이 됐고, 보상이 중립인 상태에서 `backDownReward`는
   * > 아무것도 바꾸지 않아 사라진다. 축이 둘일 때는 다른 축이 늘 대안을 하나 남겼지만
   * > 지금은 아니다. **이 조건을 지우면 조용히 막다른 길이 열린다.**
   * > `tests/unit/presentation/counterScreen.test.ts`가 이것을 검사한다.
   */
  function isPlayable(move: NegotiationMove, talk: Talk, disclosure: DisclosureStatus): boolean {
    if (move.disclose === true) return disclosure.allowed && !talk.discloseRisk;
    if (move.id === TAKE_AS_IS) return true;

    return move.reward !== undefined && move.reward !== talk.rewardMultiplier;
  }

  function render(): void {
    if (destroyed) return;

    const contract = findContract(activeId);
    const broken = [...talks.entries()]
      .filter(([id, talk]) => talk.outcome === 'broken' && findContract(id) === undefined)
      .map(([, talk]) => `<p class="counter__broken">${escapeHtml(talk.message)}</p>`)
      .join('');

    root.innerHTML = `
      <section class="counter">
        <header class="counter__header">
          <h1 class="counter__day">${deps.state.day}일차</h1>
          <p class="counter__funds">자금 ${round(deps.state.funds)}G · 명성 ${round(deps.state.reputation)}</p>
        </header>
        ${broken}
        ${renderQueue()}
        ${contract === undefined ? renderEmpty() : renderBooth(contract)}
        <footer class="counter__actions">
          <button type="button" class="counter__nav" data-action="visit-hall">길드 홀에 가본다</button>
          <button type="button" class="counter__nav" data-action="end-day">하루를 마감한다</button>
        </footer>
      </section>
    `;
  }

  function renderEmpty(): string {
    return '<p class="counter__empty">오늘은 더 이상 찾아온 사람이 없다.</p>';
  }

  /**
   * 대기줄. 의뢰가 하나뿐이면 그리지 않는다 — 고를 것이 없는 탭 줄은 화면만 먹는다.
   */
  function renderQueue(): string {
    const waiting = deps.state.openContracts;
    if (waiting.length < 2) return '';

    const tabs = waiting
      .map((contract) => {
        const talk = talks.get(contract.id);
        const settled = talk?.outcome === 'settled';
        const active = contract.id === activeId;
        return `
          <button type="button"
                  class="queue__tab${active ? ' queue__tab--active' : ''}${settled ? ' queue__tab--settled' : ''}"
                  data-action="select" data-contract="${contract.id}">
            <span class="queue__name">${escapeHtml(contract.client.name)}</span>
            <span class="queue__risk">위험 ${round(contract.statedRisk)}</span>
          </button>
        `;
      })
      .join('');

    return `
      <nav class="queue" aria-label="오늘 찾아온 의뢰인">
        <span class="queue__label">대기</span>
        ${tabs}
      </nav>
    `;
  }

  function renderBooth(contract: Contract): string {
    const talk = talkFor(contract);
    const settled = talk.outcome === 'settled';

    return `
      <article class="booth${settled ? ' booth--settled' : ''}" data-card="${contract.id}">
        <div class="booth__window">
          ${clientFigure(contract.client.id)}
        </div>

        <div class="booth__talk">
          <h2 class="booth__client">${escapeHtml(contract.client.name)}</h2>
          <dl class="booth__facts">
            <div><dt>위험도</dt><dd>${round(contract.statedRisk)}</dd></div>
            <div><dt>기본 보상</dt><dd>${round(contract.baseReward)}G</dd></div>
            <div><dt>소요</dt><dd>${contract.durationDays}일</dd></div>
            <div><dt>정원</dt><dd>${contract.maxPartySize}명</dd></div>
          </dl>

          <p class="booth__line">${escapeHtml(talk.message)}</p>

          ${renderTerms(contract, talk)}
          ${settled ? '<p class="booth__stamp">계약 성립</p>' : renderMoves(contract, talk)}
        </div>
      </article>
    `;
  }

  /**
   * 지금 테이블에 올라와 있는 조건.
   *
   * 반박당한 축을 강조하는 것이 이 영역의 핵심이다 — 의뢰인의 말과 숫자가 같은 축을
   * 가리켜야 "저 사람은 현금이 없구나"가 읽힌다.
   */
  function renderTerms(contract: Contract, talk: Talk): string {
    const contested = talk.lastResult?.contestedAxis;
    const reward = round(contract.baseReward * talk.rewardMultiplier);

    return `
      <dl class="terms">
        <div class="terms__item${contested === 'reward' ? ' terms__item--contested' : ''}">
          <dt>보상</dt><dd>${reward}G <span class="terms__mul">×${talk.rewardMultiplier.toFixed(2)}</span></dd>
        </div>
        <div class="terms__item${talk.discloseRisk ? ' terms__item--disclosed' : ''}">
          <dt>위험 고지</dt><dd>${talk.discloseRisk ? '했다' : '안 했다'}</dd>
        </div>
      </dl>
    `;
  }

  function renderMoves(contract: Contract, talk: Talk): string {
    const disclosure = deps.disclosureStatus(contract);
    const attempts = deps.state.offersMade[contract.id] ?? 0;
    const remaining = deps.negotiation.maxOffers - attempts;

    const buttons = deps.moves
      .filter((move) => isPlayable(move, talk, disclosure))
      .map((move) => renderMove(move))
      .join('');

    // 잠긴 이유는 선택지가 사라진 자리에 반드시 남는다. 회색 버튼도 없이 그냥
    // 없어지면 플레이어는 그런 수가 있다는 것조차 모른다.
    const locked = disclosure.allowed
      ? ''
      : `<p class="moves__locked">위험 고지 — ${escapeHtml(disclosure.reason ?? '')}</p>`;

    return `
      <div class="moves">
        ${buttons}
        ${locked}
        <p class="moves__attempts">이야기를 이어갈 수 있는 횟수 ${remaining}회</p>
      </div>
    `;
  }

  function renderMove(move: NegotiationMove): string {
    const label = deps.text.moves[move.id] ?? move.id;
    const risky = move.disclose === true;

    return `
      <button type="button" class="move${risky ? ' move--disclose' : ''}"
              data-action="move" data-move="${move.id}">${escapeHtml(label)}</button>
    `;
  }
}

/**
 * "그 조건대로 받겠습니다"의 id. 이 수만 {@link isPlayable}의 변화 규칙에서 면제된다.
 *
 * 밸런스 수치가 아니라 구조 상수다 — `balance.json`이 이 id를 가진 항목을 반드시
 * 하나 가져야 한다는 계약을 코드 쪽에서 표현한 것이다.
 */
const TAKE_AS_IS = 'takeAsIs';

/** 의뢰인의 실루엣. 인물마다 다르되 같은 사람은 늘 같아야 하므로 id에서 유도한다. */
const FIGURE_COLORS = ['#4a3a26', '#3f4f5a', '#4a3f2a', '#553a3a', '#3f5040', '#4c4356'] as const;

function clientFigure(clientId: string): string {
  let hash = 0;
  for (let i = 0; i < clientId.length; i += 1) {
    hash = (hash * 31 + clientId.charCodeAt(i)) >>> 0;
  }
  const robe = FIGURE_COLORS[hash % FIGURE_COLORS.length];
  const hooded = hash % 2 === 0;

  return `
    <svg class="booth__figure" viewBox="0 0 64 88" shape-rendering="crispEdges" aria-hidden="true">
      <rect x="18" y="44" width="28" height="44" fill="${robe}" />
      <rect x="12" y="52" width="6" height="26" fill="${robe}" />
      <rect x="46" y="52" width="6" height="26" fill="${robe}" />
      <rect x="22" y="54" width="20" height="3" fill="#6b5a45" />
      <rect x="23" y="20" width="18" height="26" fill="#d9b98c" />
      <rect x="20" y="12" width="24" height="${hooded ? 16 : 11}" fill="#2b2118" />
      <rect x="20" y="24" width="3" height="${hooded ? 14 : 8}" fill="#2b2118" />
      <rect x="41" y="24" width="3" height="${hooded ? 14 : 8}" fill="#2b2118" />
      <rect x="27" y="31" width="3" height="3" fill="#2b2118" />
      <rect x="35" y="31" width="3" height="3" fill="#2b2118" />
    </svg>
  `;
}

function round(value: number): number {
  return Math.round(value);
}
