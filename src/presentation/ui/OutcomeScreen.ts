/**
 * 결과 대조 화면 — "당신이 알았던 것" vs "실제였던 것".
 *
 * 컨셉 문서가 **1순위 설계 리스크**로 지목한 것에 대한 최종 방어선이다 — *"창발이
 * 무작위처럼 느껴질 위험. 플레이어가 '내 판단이 결과를 바꿨다'고 느끼지 못하면 게임
 * 전체가 무너진다."* 이 화면은 **실력 성장의 유일한 피드백 채널**이므로, 판정에 쓰인
 * 값을 숨기지 않되 계산기 게임으로 만들지도 않는 것이 핵심 긴장이다.
 *
 * ## 숫자를 띠(band) 표현으로 바꾼다
 *
 * `ratio`와 `uncertainty`를 그대로 보여주면 플레이어가 다음 판단을 "역량 합 ÷ 위험도"
 * 암산으로 대체하게 된다. 그러면 이 화면이 배우라고 만들어진 감각(등급·인맥·성격을
 * 종합한 판단)이 계산으로 치환된다. 그래서 {@link marginBandOf}는 `certaintyBand`
 * 하나로 세 구간(여유/도박/무모)을 가르고, {@link luckBandOf}는 `effective`가
 * `ratio`보다 유리했는지만 말한다 — **`dispatch.ts`가 이미 정의한 확정 구간의 경계를
 * 그대로 재사용한 것**이라 새 밸런스 노브가 아니다.
 *
 * ## 파티 역량은 등급 나열로 대신한다
 *
 * AC는 "파티 역량 합"을 보여달라고 하지만, 이 프로젝트는 역량 원본 숫자를 화면에
 * 내보내지 않는다(`../screen`의 `GRADE_LABELS` 문서 참조). 숫자 합을 보여주면 그
 * 규칙이 뚫린다. 대신 파티 구성을 등급 배지로 나열한다 — "역량 합"이 실제로 하던 일
 * (이 조합이 이 위험을 감당할 만했는가)은 바로 아래의 마진 띠가 대신 말해준다.
 *
 * ## 붉은색은 위험·사망·미지급에만
 *
 * "믿었던 값이 실제와 달랐다"는 사실 자체는 **학습 신호이지 위험 신호가 아니다** —
 * 다르다고 해서 항상 나쁜 쪽으로 다른 것도 아니다. 그래서 대조 차이는 굵기와 테두리
 * (`--desk`)로만 강조하고, `--seal`(붉은 봉랍)은 사망·무모했던 판정·미지급·은폐
 * 경고에만 쓴다. 아껴야 그 색이 나타나는 순간 심장이 뛴다.
 *
 * ## 화자 정보 — 성격 필터를 학습 가능하게 만드는 연결
 *
 * *"당신은 카린의 말을 믿었다"* 는 대사가 아니라 시스템이 조립하는 분석 문장이라
 * `narrate()`를 거치지 않는다(변형이 필요 없다). 화자의 이름과 성격 태그를 항상 함께
 * 보여주는 이유는 {@link ../screen.TRAIT_LABELS}의 문서와 같다 — 왜곡이 체계적이라는
 * 것을 배우려면 "누가"가 항상 보여야 한다.
 *
 * ## 소문 상세는 아직 영구 저장소가 없다 — 콜론 아래 배선 노트 참고
 *
 * `PlayerKnowledge.revealedFacts`는 사실 id 집합일 뿐, 표시값과 화자를 담지 않는다
 * (`types.ts` 참고). 그래서 이 화면은 그 상세를 {@link HeardFact}로 **직접 주입받는다**
 * — 어디서 그 값을 모아 오는지는 이 화면이 몰라도 된다. 실제 배선(길드 홀 대화 결과를
 * 어디에 쌓을지)은 통합하는 쪽의 몫이다.
 */
import type { DispatchOutcome, DispatchResult } from '../../domain/dispatch';
import { narrate, type TextBank } from '../../domain/text';
import type {
  Adventurer,
  Contract,
  FactKind,
  GradeThresholds,
  Trait,
} from '../../domain/types';
import { gradeOf } from '../../domain/types';
import type { Rng } from '../../domain/rng';
import { escapeHtml, GRADE_LABELS, TRAIT_LABELS, type ScreenHandle } from '../screen';

export type { ScreenHandle };

/**
 * 소문으로 들은 사실 하나 — 결과 대조 화면이 좌변을 그리는 데 필요한 전부.
 *
 * `RevealedFact`(`rumor.ts`)와 모양이 거의 같지만, `factId`/`contractId` 대신
 * `tellerName`·`tellerTraits`가 이미 풀려 있다. 이 화면은 명부를 조회하지 않으므로
 * (파견 다녀온 파티만 알면 된다) 호출자가 화자를 미리 사람 이름으로 바꿔서 넘긴다.
 */
export interface HeardFact {
  readonly kind: FactKind;
  /** 성격 필터를 거친, 플레이어가 실제로 들은 값 */
  readonly statedValue: number;
  readonly tellerId: string;
  readonly tellerName: string;
  readonly tellerTraits: readonly [Trait, Trait];
}

/**
 * 이 화면이 그릴 파견 결과 하나. `DispatchScreen`이 판정 직후에 조립해 넘긴다.
 */
export interface ResolvedOutcome {
  readonly contract: Contract;
  readonly result: DispatchResult;
  /** 이번에 나갔던 파티원. 판정 후 상태(사망/부상/가용)가 이미 반영돼 있다 */
  readonly party: readonly Adventurer[];
  /**
   * 실제 위험을 알고도 계약서에 적지 않았는가 (`ActiveDispatch.concealedKnownRisk`).
   *
   * 사망 여부와 무관하게 항상 보여준다 — 은폐했다는 사실 자체가 판단 근거의 일부다.
   */
  readonly concealedKnownRisk: boolean;
  /** 파견 전 소문으로 얻은 사실들. 얻지 못한 항목은 배열에 아예 없다 — "몰랐다"는 화면이 채운다 */
  readonly heardFacts: readonly HeardFact[];
}

export interface OutcomeScreenDeps {
  readonly outcome: ResolvedOutcome;
  readonly gradeThresholds: GradeThresholds;
  /**
   * 마진 띠의 경계. `balance.json`의 `dispatch.certaintyBand`를 그대로 재사용한다 —
   * **새 밸런스 노브가 아니다.** `dispatch.ts`가 이미 "확정 구간이 시작되는 거리"로
   * 정의해 둔 값과 이 화면의 "여유/도박/무모" 경계가 정확히 같은 개념이기 때문이다.
   */
  readonly certaintyBand: number;
  /** 사망 서술(`resultDead`/`lostComrade`) 조립에 쓴다. `GameState.rng`를 넘긴다 */
  readonly rng: Rng;
  readonly text: TextBank;
  /** 대조를 확인하고 다음으로 넘어갈 때 호출된다. 화면 전환 자체는 main.ts가 한다 */
  readonly onContinue: () => void;
}

const OUTCOME_LABELS: Readonly<Record<DispatchOutcome, string>> = {
  success: '성공',
  injured: '부상',
  dead: '사망',
};

type MarginBand = 'comfortable' | 'risky' | 'reckless';

const MARGIN_LABELS: Readonly<Record<MarginBand, string>> = {
  comfortable: '전력이 여유 있었다.',
  risky: '아슬아슬한 도박이었다.',
  reckless: '무모했다.',
};

/**
 * `ratio`를 세 구간으로 가른다. 경계는 `dispatch.ts`의 확정 구간과 같다 — `ratio`가
 * `1 ± certaintyBand` 밖이면 애초에 무작위가 개입하지 않았던 확정 결과다.
 */
function marginBandOf(ratio: number, certaintyBand: number): MarginBand {
  if (ratio >= 1 + certaintyBand) return 'comfortable';
  if (ratio <= 1 - certaintyBand) return 'reckless';
  return 'risky';
}

type LuckBand = 'none' | 'favorable' | 'unfavorable' | 'neutral';

const LUCK_LABELS: Readonly<Record<LuckBand, string>> = {
  none: '운은 개입하지 않았다 — 처음부터 정해진 결과였다.',
  favorable: '운이 따라주었다.',
  unfavorable: '운이 따라주지 않았다.',
  neutral: '운은 영향을 주지 않았다.',
};

/** `uncertainty`가 0이면 확정, 아니면 `effective`가 `ratio`보다 나았는지로 방향을 말한다. */
function luckBandOf(result: DispatchResult): LuckBand {
  if (result.uncertainty === 0) return 'none';
  if (result.effective > result.ratio) return 'favorable';
  if (result.effective < result.ratio) return 'unfavorable';
  return 'neutral';
}

/** 0~1 스케일인 지불 여력을 퍼센트로. `client.wealth`와 `RevealedFact(realWealth)` 모두 이 스케일이다 */
function formatWealth(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function round(value: number): number {
  return Math.round(value);
}

/**
 * 결과 대조 화면을 그린다. 상태가 없으므로(파견 하나의 결과만 보여주고 사라진다)
 * 재렌더 없이 한 번만 그리지만, 규약을 지키기 위해 `destroy()`는 그대로 구현한다.
 *
 * @param root 그려 넣을 요소. 기존 내용은 지워진다
 */
export function mountOutcomeScreen(root: HTMLElement, deps: OutcomeScreenDeps): ScreenHandle {
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
    if (button.dataset.action === 'continue') deps.onContinue();
  }

  function render(): void {
    if (destroyed) return;
    root.innerHTML = renderBody();
  }

  function renderBody(): string {
    const { contract, result, party } = deps.outcome;

    return `
      <section class="outcome">
        ${renderHeader(contract, result)}
        ${renderConcealedNotice()}
        <div class="outcome__compare">
          ${renderKnownSide(contract)}
          ${renderRealSide(contract)}
        </div>
        ${renderRationale(party, result)}
        ${renderPayment(result)}
        ${renderDeath(party, result)}
        <footer class="outcome__actions">
          <button class="outcome__continue" type="button" data-action="continue">창구로 돌아간다</button>
        </footer>
      </section>
    `;
  }

  function renderHeader(contract: Contract, result: DispatchResult): string {
    return `
      <header class="outcome__header">
        <h1 class="outcome__title">파견 결과 — ${escapeHtml(contract.client.name)}</h1>
        <span class="outcome__badge outcome__badge--${result.outcome}">${OUTCOME_LABELS[result.outcome]}</span>
      </header>
    `;
  }

  /** 실제 위험을 알고도 계약서에 적지 않았다는 것 자체가 위험 신호이므로 붉게 경고한다 */
  function renderConcealedNotice(): string {
    if (!deps.outcome.concealedKnownRisk) return '';
    return `<p class="outcome__concealed">당신은 실제 위험을 알고 있었지만 계약서에 적지 않았다.</p>`;
  }

  function heardFactFor(kind: FactKind): HeardFact | undefined {
    return deps.outcome.heardFacts.find((fact) => fact.kind === kind);
  }

  /** 파견 전 믿었던 위험도. 소문이 있으면 그 값, 없으면 의뢰인이 밝힌 값 그대로다 */
  function believedRisk(contract: Contract): number {
    return heardFactFor('realRisk')?.statedValue ?? contract.statedRisk;
  }

  /** 믿었던 값과 실제가 갈렸는가. 반올림 비교로 부동소수점 잡음을 무시한다 */
  function riskBeliefWasWrong(contract: Contract): boolean {
    return round(believedRisk(contract)) !== round(contract.realRisk);
  }

  function renderKnownSide(contract: Contract): string {
    const heardRisk = heardFactFor('realRisk');
    const heardWealth = heardFactFor('realWealth');
    // 소문이 없었는데도 값이 갈렸다면, 탓할 소문이 없으니 "공개 위험도" 항목 자체를 강조한다.
    const statedRowDiffers = heardRisk === undefined && riskBeliefWasWrong(contract);

    return `
      <div class="outcome__side outcome__side--known">
        <h2 class="outcome__side-title">당신이 알았던 것</h2>
        <dl class="outcome__facts">
          <div class="outcome__fact${statedRowDiffers ? ' outcome__fact--diff' : ''}">
            <dt>공개 위험도</dt>
            <dd>${round(contract.statedRisk)}</dd>
          </div>
          ${renderRumorRow('실제 위험에 대한 소문', heardRisk, heardRisk !== undefined && riskBeliefWasWrong(contract))}
          ${renderRumorRow('지불 여력에 대한 소문', heardWealth, false)}
        </dl>
      </div>
    `;
  }

  /**
   * 소문 한 줄. 얻지 못했으면 **빈칸이 아니라 "몰랐다" 문장**을 낸다 — 모른 채로
   * 결정했다는 사실 자체가 교훈이고, 빈칸은 그걸 전달하지 못한다.
   */
  function renderRumorRow(label: string, fact: HeardFact | undefined, differs: boolean): string {
    if (fact === undefined) {
      return `
        <div class="outcome__fact outcome__fact--unknown">
          <dt>${escapeHtml(label)}</dt>
          <dd>몰랐다 — 소문을 얻지 못한 채 판단했다.</dd>
        </div>
      `;
    }

    const value = fact.kind === 'realWealth' ? formatWealth(fact.statedValue) : String(round(fact.statedValue));
    const traits = fact.tellerTraits.map((trait) => TRAIT_LABELS[trait]).join('·');

    return `
      <div class="outcome__fact${differs ? ' outcome__fact--diff' : ''}">
        <dt>${escapeHtml(label)}</dt>
        <dd>${value}</dd>
        <p class="outcome__teller">${escapeHtml(fact.tellerName)}(${escapeHtml(traits)})에게서 들었다.</p>
      </div>
    `;
  }

  function renderRealSide(contract: Contract): string {
    const heardRisk = heardFactFor('realRisk');
    const wrong = riskBeliefWasWrong(contract);
    // "당신은 카린의 말을 믿었다" — 화자가 있었고 그 말이 틀렸을 때만 쓸 수 있는 문장이다.
    // 성격 필터를 학습 가능하게 만드는 연결이 여기서 완성된다.
    const trustedNote =
      heardRisk !== undefined && wrong
        ? `<p class="outcome__trusted">당신은 ${escapeHtml(heardRisk.tellerName)}의 말을 믿었다.</p>`
        : '';

    return `
      <div class="outcome__side outcome__side--real">
        <h2 class="outcome__side-title">실제였던 것</h2>
        <dl class="outcome__facts">
          <div class="outcome__fact${wrong ? ' outcome__fact--diff' : ''}">
            <dt>실제 위험도</dt>
            <dd>${round(contract.realRisk)}</dd>
            ${trustedNote}
          </div>
          <div class="outcome__fact">
            <dt>실제 지불 여력</dt>
            <dd>${formatWealth(contract.client.wealth)}</dd>
          </div>
        </dl>
      </div>
    `;
  }

  function renderRationale(party: readonly Adventurer[], result: DispatchResult): string {
    const members = party.map((member) => renderPartyMember(member, result)).join('');
    const margin = marginBandOf(result.ratio, deps.certaintyBand);
    const luck = luckBandOf(result);

    return `
      <section class="outcome__rationale">
        <h2 class="outcome__section-title">판정 근거</h2>
        <ul class="outcome__party">${members}</ul>
        <p class="outcome__band outcome__band--${margin}">${MARGIN_LABELS[margin]}</p>
        <p class="outcome__luck">${LUCK_LABELS[luck]}</p>
      </section>
    `;
  }

  /**
   * 파티원 한 명. **역량 원본 숫자는 절대 넣지 않는다** — 등급 배지가 이 화면에서
   * "파티 역량 합"을 대신하는 유일한 표현이다.
   */
  function renderPartyMember(member: Adventurer, result: DispatchResult): string {
    const isCasualty = member.id === result.casualtyId;
    const grade = GRADE_LABELS[gradeOf(member.capability, deps.gradeThresholds)];

    return `
      <li class="outcome__party-member${isCasualty ? ' outcome__party-member--dead' : ''}">
        <span class="outcome__party-name">${escapeHtml(member.name)}</span>
        <span class="outcome__party-grade">${grade}</span>
      </li>
    `;
  }

  /**
   * 보상이 들어왔는가.
   *
   * > 2026-08-09 개정 — 잔금 미지급 판정이 폐기되면서(`roadmap.md` P0 항목 2) 이
   * > 함수의 세 갈래가 둘로 줄었다. 사라진 것은 *"완수했으나 의뢰인이 못 냈다"*는
   * > 경우이며, 그와 함께 `wealth` 영구 공개 배너도 없어졌다. 남은 실패 경로는
   * > 결렬(창구)과 사망(파견) 둘뿐이다.
   * >
   * > "잔금"이라는 낱말도 함께 지웠다 — 선불이 있을 때만 뜻이 통하는 말이다.
   */
  function renderPayment(result: DispatchResult): string {
    if (result.outcome === 'dead') {
      return `<p class="outcome__payment">완수하지 못해 보상이 들어오지 않는다.</p>`;
    }
    return `<p class="outcome__payment">보상이 예정대로 들어왔다.</p>`;
  }

  function renderDeath(party: readonly Adventurer[], result: DispatchResult): string {
    if (result.outcome !== 'dead' || result.casualtyId === undefined) return '';

    const casualty = party.find((member) => member.id === result.casualtyId);
    if (casualty === undefined) return '';

    const line = narrate(deps.text, 'resultDead', casualty.traits, { name: casualty.name }, deps.rng);

    return `
      <section class="outcome__death">
        <h2 class="outcome__section-title outcome__section-title--dead">${escapeHtml(casualty.name)}</h2>
        <p class="outcome__death-line">${escapeHtml(line)}</p>
        ${renderComradeMemory(party, casualty)}
      </section>
    `;
  }

  /**
   * 생존자 중 이 사망을 `lostComrade` 기억으로 이미 들고 있는 사람이 있으면 그 반응을
   * 한 줄 더 보탠다. Story 013이 아직 배선되지 않았다면 `memories`가 비어 있을 뿐이라
   * 이 함수는 조용히 빈 문자열을 돌려준다 — 두 스토리의 완성 순서에 이 화면이 묶이지
   * 않는다.
   */
  function renderComradeMemory(party: readonly Adventurer[], casualty: Adventurer): string {
    const survivor = party.find(
      (member) =>
        member.id !== casualty.id &&
        member.memories.some((memory) => memory.kind === 'lostComrade' && memory.subjectId === casualty.id),
    );
    if (survivor === undefined) return '';

    const line = narrate(
      deps.text,
      'lostComrade',
      survivor.traits,
      { name: survivor.name, subject: casualty.name },
      deps.rng,
    );

    return `<p class="outcome__death-line">${escapeHtml(line)}</p>`;
  }
}
