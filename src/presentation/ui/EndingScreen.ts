/**
 * 결산 화면 — 15일 회차의 마지막 정지점.
 *
 * 이 화면이 없으면 20~40분짜리 세션이 그냥 멈춘 것처럼 느껴진다. 그래서 숫자만
 * 늘어놓지 않는다 — **사망자 명단이 이 화면의 핵심이다.** "사망 2명"이라고만 쓰면
 * 아무 감정도 남지 않는다. 이름과 그가 마지막으로 무엇을 겪었는지가 있어야
 * 컨셉의 목표 문장(*"이 숲이 위험하다는 걸 알고도 보상이 좋아서 신입을 보냈다.
 * 안 돌아왔다."*)이 회수된다.
 *
 * ## 사망 서술은 `resultDead`를 그대로 재사용한다
 *
 * `Adventurer.memories`는 이 화면이 만들어지는 시점에 아직 아무도 채우지 않는다
 * (Story 013이 그 몫이다). 그래서 "마지막에 무엇을 겪었는가"를 재구성할 데이터가
 * 없고, 대신 파견 화면(`DispatchScreen`)이 죽음을 알릴 때 쓰는 것과 같은 상황
 * (`resultDead`, `text.json`)을 성격 태그와 함께 재사용한다. 이후 `memories`가
 * 채워지면 마지막 기억의 종류로 상황을 더 정확히 고를 수 있지만, 지금은 존재하지
 * 않는 데이터를 읽는 척하지 않는다.
 *
 * ## 운명 텍스트는 산문 금지 규칙의 유일한 예외
 *
 * `text.json`의 `endings` 3종은 손으로 쓴 문장이다. 회차당 정확히 한 번만 보이고
 * 성격에 따라 달라질 이유가 없으므로 `narrate()`(성격 필터 + rng 선택)를 거치지
 * 않고 명성 구간에 맞는 문자열 하나를 그대로 낸다.
 *
 * ## 화면 모듈의 규약
 *
 * 다른 화면과 같은 모양이다 — `mountEndingScreen(root, deps) => ScreenHandle`,
 * `destroy()`가 리스너와 DOM을 정리하며 두 번 불러도 안전하다. 리스너는 루트
 * 하나에만 걸고 `data-action`으로 위임한다.
 */
import type { GameState } from '../../domain/gameState';
import { narrate, type TextBank } from '../../domain/text';
import type { Adventurer } from '../../domain/types';
import { castIndexOf, escapeHtml, type ScreenHandle } from '../screen';

export type { ScreenHandle };

/** 명성 구간의 경계. `balance.json`에서 온다 — 숫자를 이 화면에 박지 않는다. */
export interface ReputationTierBounds {
  /** 이 값 미만이면 낮음 운명. */
  readonly low: number;
  /** 이 값 이상이면 높음 운명. 그 사이는 중간 운명이다. */
  readonly high: number;
}

/**
 * `text.json`에 이 스토리가 추가한 `endings` 절.
 *
 * `TextBank`(도메인 소유, `text.ts`)는 이 키를 모른다 — `situations` 하나만 안다.
 * 그 인터페이스를 건드리지 않고 화면 쪽에서만 확장해서 쓴다.
 */
export interface EndingTextBank extends TextBank {
  readonly endings: Readonly<Record<'low' | 'mid' | 'high', string>>;
}

export interface EndingScreenDeps {
  readonly state: GameState;
  readonly text: EndingTextBank;
  readonly reputationTiers: ReputationTierBounds;
  /**
   * 이번 회차를 만든 시드. 재현 가능성이 요점이므로 그대로 화면에 낸다 — 심사·
   * 디버깅·동영상 촬영(좋은 회차 재현)에 쓰인다.
   */
  readonly seed: number;
  /**
   * 다시 시작 버튼을 누르면 호출된다. **새 시드를 고르는 것도, 실제로
   * `createGameState`를 다시 부르는 것도 이 화면의 일이 아니다** — `main.ts`가
   * `Math.random()`을 쓰지 않고 시드 가능한 방식으로 새 시드를 만들고, 이 화면은
   * 그 신호만 보낸다.
   */
  readonly onRestart: () => void;
}

/** 명성 구간 셋. `endings` 텍스트의 키와 그대로 맞는다. */
type FateTier = 'low' | 'mid' | 'high';

/**
 * 결산 화면을 그린다.
 *
 * @param root 그려 넣을 요소. 기존 내용은 지워진다
 */
export function mountEndingScreen(root: HTMLElement, deps: EndingScreenDeps): ScreenHandle {
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
    if (button?.dataset.action === 'restart') deps.onRestart();
  }

  /** 길드에 남아 살아 있는 사람 수. 죽은 이는 여전히 명부에 있지만 세지 않는다. */
  function livingGuildMembers(): Adventurer[] {
    return deps.state.roster.filter((member) => member.inGuild && member.status !== 'dead');
  }

  function deadMembers(): Adventurer[] {
    return deps.state.roster.filter((member) => member.status === 'dead');
  }

  function fateTier(): FateTier {
    const { reputation } = deps.state;
    if (reputation < deps.reputationTiers.low) return 'low';
    if (reputation >= deps.reputationTiers.high) return 'high';
    return 'mid';
  }

  function render(): void {
    if (destroyed) return;

    root.innerHTML = `
      <section class="ending">
        <header class="ending__header">
          <h1 class="ending__title">회차 결산</h1>
          <p class="ending__seed">시드 ${escapeHtml(String(deps.seed))}</p>
        </header>

        <dl class="ending__summary">
          <div><dt>명성</dt><dd>${round(deps.state.reputation)}</dd></div>
          <div><dt>자금</dt><dd>${round(deps.state.funds)}G</dd></div>
          <div><dt>길드 등급</dt><dd>${deps.state.guildTier}등급</dd></div>
          <div><dt>길드원</dt><dd>${livingGuildMembers().length}명</dd></div>
        </dl>

        <section class="ending__fate">
          <p class="ending__fate-text">${escapeHtml(deps.text.endings[fateTier()])}</p>
        </section>

        ${renderRoll()}

        <footer class="ending__actions">
          <button class="ending__restart" type="button" data-action="restart">다시 시작한다</button>
        </footer>
      </section>
    `;
  }

  function renderRoll(): string {
    const dead = deadMembers();

    return `
      <section class="ending__roll">
        <h2 class="ending__roll-title">돌아오지 못한 이들</h2>
        ${
          dead.length === 0
            ? '<p class="ending__roll-empty">이번 회차 동안 아무도 잃지 않았다.</p>'
            : `<ul class="ending__roll-list">${dead.map((member) => renderRollRow(member)).join('')}</ul>`
        }
      </section>
    `;
  }

  function renderRollRow(member: Adventurer): string {
    const line = narrate(deps.text, 'resultDead', member.traits, { name: member.name }, deps.state.rng);

    return `
      <li class="ending__roll-row">
        <span class="ending__roll-portrait" style="--cast: ${castIndexOf(member.id)}" aria-hidden="true"></span>
        <span class="ending__roll-name">${escapeHtml(member.name)}</span>
        <p class="ending__roll-line">${escapeHtml(line)}</p>
      </li>
    `;
  }
}

function round(value: number): number {
  return Math.round(value);
}
