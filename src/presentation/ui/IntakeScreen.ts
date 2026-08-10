import {
  askSlot,
  useInsight,
  usePressure,
  type IntakeMaterial,
} from '../../domain/intake';
import type { SlotContent } from '../../domain/occupation';
import { resolveIntakeOffer } from '../../domain/intakeOffer';
import { sheetMark, SLOT_NAMES, slotProgressKey, slotProgressOf } from '../../domain/slots';
import type { GameState } from '../../domain/gameState';
import {
  RISK_GRADES,
  type Contract,
  type RiskGrade,
  type SlotName,
  type SlotProgress,
} from '../../domain/types';
import { escapeHtml, type ScreenHandle } from '../screen';

export interface IntakeScreenDeps {
  readonly state: GameState;
  readonly contract: Contract;
  readonly slotContent: Readonly<Record<string, SlotContent>>;
  readonly handbook: readonly IntakeMaterial[];
  readonly statedGrade: RiskGrade;
  readonly copy: IntakeCopy;
  readonly onSealed: (contract: Contract) => void;
}

export interface IntakeCopy {
  readonly firstAction: string;
  readonly questions: Readonly<Record<SlotName, string>>;
  readonly repeatQuestion: string;
  readonly repeatAnswers: readonly string[];
  readonly irrelevantAnswer: string;
  readonly blockedIgnoranceHint: string;
  readonly blockedDisclosureHint: string;
  readonly insightLine: string;
  readonly pressureLine: string;
  readonly materialSuccess: string;
  readonly materialFailure: string;
  readonly materialDeparture: string;
  readonly reward: {
    readonly title: string;
    readonly proposal: string;
    readonly acceptProposal: string;
    readonly askMarket: string;
    readonly askPremium: string;
    readonly comfortable: string;
    readonly strained: string;
    readonly countered: string;
    readonly acceptCounter: string;
    readonly backDown: string;
    readonly agreed: string;
  };
}

const SLOT_LABELS: Readonly<Record<SlotName, string>> = {
  kind: '의뢰 종류',
  target: '대상',
  scale: '규모',
  place: '장소',
  deadline: '기한',
  route: '경로',
  weakness: '특징 및 약점',
};

const BOOK_LABELS: Readonly<Record<IntakeMaterial['book'], string>> = {
  bestiary: '도감',
  region: '지역',
  order: '조직',
  rates: '시세',
};

export function mountIntakeScreen(root: HTMLElement, deps: IntakeScreenDeps): ScreenHandle {
  const session = deps.state.intakeSessions[deps.contract.id];
  const sheet = deps.state.commissionSheets[deps.contract.id];
  if (session === undefined || sheet === undefined) {
    throw new Error(`청취 상태가 없는 의뢰다 (${deps.contract.id})`);
  }

  const firstVisit = !deps.state.ratesIntroduced;
  // 첫 방문 안내문은 남기되 책을 자동으로 펼치지는 않는다. 펼친 책이 의뢰서를
  // 가려 첫 질문을 가로막는 문제가 있으므로, 플레이어가 필요할 때 직접 연다.
  let handbookOpen = false;
  let activeBook: IntakeMaterial['book'] = firstVisit ? 'rates' : 'bestiary';
  let stampOpen = false;
  if (handbookOpen) deps.state.ratesIntroduced = true;
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
    if (!(target instanceof Element)) return;
    const control = target.closest<HTMLElement>('[data-action]');
    if (control === null) return;

    const action = control.dataset.action;
    if (action === 'slot') {
      const slot = control.dataset.slot as SlotName | undefined;
      if (slot !== undefined) selectSlot(slot);
    } else if (action === 'material') {
      const material = deps.handbook.find((entry) => entry.id === control.dataset.material);
      if (material !== undefined) applyMaterial(material);
    } else if (action === 'grade' && !sheet.sealed) {
      const grade = control.dataset.grade as RiskGrade | undefined;
      if (grade !== undefined && RISK_GRADES.includes(grade)) sheet.playerGrade = grade;
      render();
    } else if (action === 'offer') {
      const amount = Number(control.dataset.amount);
      if (Number.isFinite(amount)) makeOffer(amount, control.dataset.kind ?? 'market');
    } else if (action === 'accept-counter') {
      agreeReward(session.reward.counter, deps.copy.reward.acceptCounter);
    } else if (action === 'back-down') {
      agreeReward(session.reward.proposed, deps.copy.reward.backDown);
    } else if (action === 'toggle-stamp' && !sheet.sealed && session.reward.status === 'agreed') {
      stampOpen = !stampOpen;
      render();
    } else if (action === 'seal' && !sheet.sealed) {
      sheet.sealed = true;
      deps.onSealed(deps.contract);
    } else if (action === 'toggle-handbook') {
      handbookOpen = !handbookOpen;
      render();
    } else if (action === 'book') {
      const book = control.dataset.book as IntakeMaterial['book'] | undefined;
      if (book !== undefined) activeBook = book;
      handbookOpen = true;
      render();
    } else if (action === 'close-materials') {
      session.materialMode = undefined;
      render();
    }
  }

  function selectSlot(slot: SlotName): void {
    if (!session.clientPresent || sheet.sealed) return;
    const truth = deps.contract.slots.get(slot);
    if (truth === undefined) {
      exchange(deps.copy.questions[slot], deps.copy.irrelevantAnswer);
      session.expression = 'neutral';
      render();
      return;
    }

    const current = progress(slot);
    session.selectedSlot = slot;
    const count = (session.askCounts[slot] ?? 0) + 1;
    session.askCounts[slot] = count;
    if (current.state === 'blocked') {
      session.materialMode = current.limiter === 'knowledge' ? 'insight' : 'pressure';
      exchange(
        deps.copy.repeatQuestion,
        current.limiter === 'knowledge'
          ? deps.copy.blockedIgnoranceHint
          : deps.copy.blockedDisclosureHint,
      );
      render();
      return;
    }

    if (current.state === 'certain') {
      const answer = deps.copy.repeatAnswers[Math.min(count - 1, deps.copy.repeatAnswers.length - 1)];
      exchange(deps.copy.repeatQuestion, answer);
      render();
      return;
    }

    const next = askSlot(current, truth);
    deps.state.knowledge.slotProgress.set(slotProgressKey(deps.contract.id, slot), next);
    session.materialMode = undefined;
    const content = deps.slotContent[truth.valueKey];
    if (next.state === 'blocked') {
      const ignorance = next.limiter === 'knowledge';
      session.materialMode = ignorance ? 'insight' : 'pressure';
      session.expression = ignorance ? 'ignorance' : 'concealment';
      exchange(deps.copy.questions[slot], ignorance
        ? '“그건… 저도 정확히는 모르겠습니다.”'
        : '의뢰인의 시선이 비껴갔다. “그 이야기까지 해야 합니까?”');
    } else if (next.state === 'vague' || next.state === 'certain') {
      session.expression = 'tell';
      exchange(
        deps.copy.questions[slot],
        `“${next.state === 'certain' ? content?.certain : content?.vague}”`,
      );
    } else {
      session.expression = 'neutral';
      exchange(deps.copy.questions[slot], deps.copy.repeatAnswers[0]);
    }
    render();
  }

  function applyMaterial(material: IntakeMaterial): void {
    const slot = session.selectedSlot;
    if (slot === undefined || !session.clientPresent || session.materialMode === undefined) return;
    const truth = deps.contract.slots.get(slot);
    if (truth === undefined) return;
    const current = progress(slot);
    const content = deps.slotContent[truth.valueKey];
    if (content === undefined) return;

    const materialMode = session.materialMode;
    const result = materialMode === 'insight'
      ? useInsight(current, truth, content, material, session.patience)
      : usePressure(current, truth, material, deps.contract.client.keyLeverage, session.patience);
    deps.state.knowledge.slotProgress.set(slotProgressKey(deps.contract.id, slot), result.progress);
    session.patience = result.patience;
    session.clientPresent = !result.departed;
    session.materialMode = undefined;
    const playerLine = interpolate(
      materialMode === 'pressure' ? deps.copy.pressureLine : deps.copy.insightLine,
      { material: material.title },
    );
    if (result.success) {
      session.expression = 'tell';
      const revealed = result.progress.state === 'certain' ? content.certain : content.vague;
      exchange(playerLine, `${deps.copy.materialSuccess} “${revealed}”`);
    } else {
      session.expression = current.state === 'blocked' && current.limiter === 'knowledge'
        ? 'ignorance'
        : 'concealment';
      exchange(
        playerLine,
        result.departed ? deps.copy.materialDeparture : deps.copy.materialFailure,
      );
    }
    render();
  }

  function makeOffer(amount: number, kind: string): void {
    if (session.reward.status === 'agreed') return;
    const line = kind === 'proposal'
      ? deps.copy.reward.acceptProposal
      : kind === 'premium'
        ? deps.copy.reward.askPremium
        : deps.copy.reward.askMarket;
    const result = resolveIntakeOffer(amount, session.reward);
    if (result.outcome === 'countered') {
      session.reward.status = 'countered';
      exchange(
        interpolate(line, { amount }),
        interpolate(deps.copy.reward.countered, { amount: result.counter }),
      );
    } else {
      session.reward.status = 'agreed';
      session.reward.agreedReward = result.agreedReward;
      exchange(
        interpolate(line, { amount }),
        result.outcome === 'comfortable' ? deps.copy.reward.comfortable : deps.copy.reward.strained,
      );
    }
    render();
  }

  function agreeReward(amount: number, line: string): void {
    session.reward.status = 'agreed';
    session.reward.agreedReward = amount;
    exchange(interpolate(line, { amount }), deps.copy.reward.comfortable);
    render();
  }

  function exchange(player: string, client: string): void {
    session.dialogue.push({ speaker: 'player', text: player }, { speaker: 'client', text: client });
  }

  function progress(slot: SlotName): SlotProgress {
    return slotProgressOf(deps.state.knowledge.slotProgress, deps.contract.id, slot);
  }

  function render(): void {
    if (destroyed) return;
    root.innerHTML = `
      <section class="intake">
        <header class="intake__header">
          <h1>${deps.state.week}주차 · 의뢰 접수</h1>
          <p>자금 ${Math.round(deps.state.funds)}G · 명성 ${Math.round(deps.state.reputation)}</p>
        </header>
        ${firstVisit ? `<p class="intake__guide">${escapeHtml(deps.copy.firstAction)}</p>` : ''}
        <div class="intake__booth">
          <div class="intake__window" data-expression="${session.expression}">
            <span class="intake__portrait" aria-hidden="true"></span>
            <strong>${escapeHtml(deps.contract.client.name)}</strong>
            <span>${occupationLabel(deps.contract.client.occupation)}</span>
          </div>
          <div class="intake__dialogue" aria-live="polite">
            ${session.dialogue.slice(-6).map((line) => `<p class="intake__line intake__line--${line.speaker}"><b>${line.speaker === 'player' ? '나' : escapeHtml(deps.contract.client.name)}</b>${escapeHtml(line.text)}</p>`).join('')}
          </div>
          <div class="intake__desk">
            <aside class="intake__notebook" aria-label="응대 기록">
              <h2>응대 기록</h2>
              <div class="intake__patience" aria-label="남은 인내 ${session.patience}">
                ${[0, 1, 2].map((index) => `<span class="${index >= session.patience ? 'is-spent' : ''}"></span>`).join('')}
              </div>
              <p>${session.clientPresent ? '의뢰인이 답을 기다린다.' : '빈 의자와 의뢰서만 남았다.'}</p>
            </aside>
            ${renderCommissionForm()}
            <aside class="intake__handbook-tool">
              <button type="button" data-action="toggle-handbook" aria-expanded="${handbookOpen}">
                길드마스터북
              </button>
              ${handbookOpen ? renderHandbook() : ''}
            </aside>
          </div>
        </div>
      </section>
    `;
  }

  function renderCommissionForm(): string {
    const slots = SLOT_NAMES.map((slot) => {
      const truth = deps.contract.slots.get(slot);
      const current = progress(slot);
      const mark = sheetMark(current);
      const content = truth === undefined ? undefined : deps.slotContent[truth.valueKey];
      const value = current.state === 'certain'
        ? content?.certain
        : current.state === 'vague'
          ? content?.vague
          : '미확인';
      const blocker = current.state === 'blocked' ? ` slot--${current.limiter}` : '';
      return `
        <button type="button" class="slot slot--${mark}${blocker}"
                data-action="slot" data-slot="${slot}" ${sheet.sealed ? 'disabled' : ''}>
          <span>${SLOT_LABELS[slot]}</span><strong>${escapeHtml(value ?? '미확인')}</strong>
        </button>`;
    }).join('');

    return `
      <article class="commission-form">
        <header><span>의뢰인 진술: <b>${deps.statedGrade}</b></span><span>길드 판정: <b>${sheet.playerGrade ?? ''}</b></span></header>
        <div class="commission-form__slots">${slots}</div>
        ${renderMaterials()}
        ${renderReward()}
        <div class="commission-form__stamp-area">
          ${stampOpen && !sheet.sealed ? `<fieldset class="commission-form__grades">
            <legend>도장 면을 고른다</legend>
            ${RISK_GRADES.map((grade) => `<button type="button" data-action="grade" data-grade="${grade}" class="${sheet.playerGrade === grade ? 'is-selected' : ''}">${grade}</button>`).join('')}
          </fieldset>` : ''}
          <button type="button" class="commission-form__stamp-tool" data-action="${stampOpen ? 'seal' : 'toggle-stamp'}"
                  aria-expanded="${stampOpen}" ${sheet.sealed || session.reward.status !== 'agreed' ? 'disabled' : ''}>
            ${sheet.sealed ? '도장 완료' : session.reward.status !== 'agreed' ? '보수 합의 후 날인' : stampOpen ? `${sheet.playerGrade ?? '등급 없이'} 날인` : '위험도 도장'}
          </button>
        </div>
      </article>`;
  }

  function renderReward(): string {
    const reward = session.reward;
    if (reward.status === 'agreed') {
      return `<section class="intake__reward intake__reward--agreed"><strong>${escapeHtml(deps.copy.reward.title)}</strong><p>${escapeHtml(interpolate(deps.copy.reward.agreed, { amount: reward.agreedReward ?? reward.proposed }))}</p></section>`;
    }
    if (reward.status === 'countered') {
      return `<section class="intake__reward"><strong>${escapeHtml(deps.copy.reward.title)}</strong><p>${escapeHtml(interpolate(deps.copy.reward.countered, { amount: reward.counter }))}</p><div>
        <button type="button" data-action="accept-counter">${escapeHtml(interpolate(deps.copy.reward.acceptCounter, { amount: reward.counter }))}</button>
        <button type="button" data-action="back-down">${escapeHtml(interpolate(deps.copy.reward.backDown, { amount: reward.proposed }))}</button>
      </div></section>`;
    }
    return `<section class="intake__reward"><strong>${escapeHtml(deps.copy.reward.title)}</strong><p>${escapeHtml(interpolate(deps.copy.reward.proposal, { amount: reward.proposed }))}</p><div>
      <button type="button" data-action="offer" data-kind="proposal" data-amount="${reward.proposed}">${escapeHtml(interpolate(deps.copy.reward.acceptProposal, { amount: reward.proposed }))}</button>
      <button type="button" data-action="offer" data-kind="market" data-amount="${reward.market}">${escapeHtml(interpolate(deps.copy.reward.askMarket, { amount: reward.market }))}</button>
      <button type="button" data-action="offer" data-kind="premium" data-amount="${reward.premium}">${escapeHtml(interpolate(deps.copy.reward.askPremium, { amount: reward.premium }))}</button>
    </div></section>`;
  }

  function renderMaterials(): string {
    if (session.materialMode === undefined || session.selectedSlot === undefined) return '';
    const candidates = deps.handbook.filter((entry) =>
      entry.book !== 'rates' && (session.materialMode === 'insight' ? entry.hintTags.length > 0 : entry.leverageTag !== null),
    );
    if (candidates.length === 0) return '';
    return `<section class="intake__materials" aria-label="수첩에서 사실 고르기">
      <header><strong>${session.materialMode === 'insight' ? '일깨울 사실' : '들이댈 사실'}</strong><button type="button" data-action="close-materials">닫기</button></header>
      <div>${candidates.map((entry) => `<button type="button" data-action="material" data-material="${entry.id}">${escapeHtml(entry.title)}</button>`).join('')}</div>
    </section>`;
  }

  function renderHandbook(): string {
    return `<section class="handbook">
      <header><strong>길드마스터북</strong><button type="button" data-action="toggle-handbook">책 닫기</button></header>
      <nav>${(['bestiary', 'region', 'order', 'rates'] as const).map((book) => `<button type="button" data-action="book" data-book="${book}" class="${activeBook === book ? 'is-active' : ''}">${BOOK_LABELS[book]}</button>`).join('')}</nav>
      <div>${deps.handbook.filter((entry) => entry.book === activeBook).map((entry) => `
        <article><h3>${escapeHtml(entry.title)}</h3><p>${escapeHtml(entry.body)}</p>
        ${entry.criteria?.map((criterion) => `<small>${escapeHtml(criterion.when)} → ${criterion.grade}${criterion.open ? ' 이상' : ''}</small>`).join('') ?? ''}</article>`).join('')}</div>
    </section>`;
  }
}

function interpolate(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

function occupationLabel(occupation: Contract['client']['occupation']): string {
  return { resident: '주민', merchant: '상인', official: '관리', noble: '귀족', gang: '갱단' }[occupation];
}
