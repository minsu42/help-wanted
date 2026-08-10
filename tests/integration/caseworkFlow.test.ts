/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it } from 'vitest';
import type { InterpretedTurn } from '../../src/domain/casework';
import type { ClientAgent } from '../../src/llm/clientAgent';
import { CaseworkApp } from '../../src/presentation/CaseworkApp';

const neutral: InterpretedTurn = {
  intent: 'ask', targetSlots: ['scale'], assertedFactIds: [], citedKnowledgeIds: [], tone: 'neutral', confidence: 0.9,
};

const agent: ClientAgent = {
  mode: 'development',
  checkHealth: async () => true,
  interpret: async () => neutral,
  respond: async ({ receipt }) => receipt.reaction,
};

describe('새 접수 수직 단면', () => {
  let root: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    root = document.querySelector('#app')!;
  });

  /** 업무 시작 → 아침 화면 → 창구 개점까지 밀어 놓는다. */
  async function openCounter(): Promise<void> {
    root.querySelector<HTMLButtonElement>('[data-action="skip"]')!.click();
    await Promise.resolve();
    await Promise.resolve();
    root.querySelector<HTMLButtonElement>('[data-action="open-counter"]')!.click();
  }

  it('업무 시작 후 고정 창구와 백과사전·진술 대조 도구를 연다', async () => {
    new CaseworkApp(root, { agent });
    await openCounter();
    expect(root.querySelector('#utterance')).not.toBeNull();
    expect(root.querySelectorAll('.utterance-form textarea')).toHaveLength(1);
    expect(root.querySelectorAll('.utterance-form select')).toHaveLength(0);
    expect(root.textContent).toContain('길드 백과사전');
    expect(root.textContent).toContain('진술 쪽지');
    expect(root.querySelector('[data-action="compare"]')).not.toBeNull();
  });

  it('백과사전은 실제 책 오버레이로 열리고 대조 문장을 선택할 수 있다', async () => {
    new CaseworkApp(root, { agent });
    await openCounter();
    root.querySelector<HTMLButtonElement>('[data-action="book"]')!.click();
    expect(root.querySelector('[aria-label="길드 백과사전"]')).not.toBeNull();
    expect(root.textContent).toContain('크기');
    expect(root.textContent).toContain('약점');
    root.querySelector<HTMLButtonElement>('[data-knowledge="k-mimic-scratches"]')!.click();
    expect(root.textContent).toContain('증거: 상자형 미믹');
  });

  it('백과사전을 종류 태그로 거르고 선택 문장은 입력창에 자동 복사하지 않는다', async () => {
    new CaseworkApp(root, { agent });
    await openCounter();
    root.querySelector<HTMLButtonElement>('[data-action="book"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-book-tag="거인종"]')!.click();
    expect(root.textContent).toContain('이끼 다리 트롤');
    expect(root.textContent).not.toContain('상자형 미믹');
    root.querySelector<HTMLButtonElement>('[data-knowledge="k-troll"]')!.click();
    expect(root.querySelector<HTMLTextAreaElement>('#utterance')!.value).toBe('');
  });

  it('물리적으로 선택한 대조 근거가 AI의 일반 슬롯 해석보다 우선한다', async () => {
    new CaseworkApp(root, { agent });
    await openCounter();
    root.querySelector<HTMLButtonElement>('[data-action="book"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-knowledge="k-mimic-scratches"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-claim="c1-scratch"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-action="compare"]')!.click();
    const textarea = root.querySelector<HTMLTextAreaElement>('#utterance')!;
    textarea.value = '쥐라면서 왜 이 흔적이 있습니까?';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    root.querySelector<HTMLFormElement>('[data-form="utterance"]')!.requestSubmit();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(root.textContent).toContain('평행한 긁힘과 금속성 침');
    expect(root.textContent).toContain('대조 완료');
  });

  it('자유 문장 응답 후 확인된 사실과 의뢰서 작성 경로가 갱신된다', async () => {
    new CaseworkApp(root, { agent });
    await openCounter();
    const textarea = root.querySelector<HTMLTextAreaElement>('#utterance')!;
    textarea.value = '몇 마리였습니까?';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    root.querySelector<HTMLFormElement>('[data-form="utterance"]')!.requestSubmit();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(root.textContent).toContain('미믹 1개체');
    expect(root.textContent).toContain('의뢰서 작성');
  });

  it('게시한 서류의 파견 결과는 그날 열리지 않고 다음 날 아침에 온다', async () => {
    // Arrange — 창구를 열고 곧장 의뢰서로 간다
    new CaseworkApp(root, { agent });
    await openCounter();
    root.querySelector<HTMLButtonElement>('[data-action="commission"]')!.click();

    // Act — 최소 요건만 채워 게시하고 지원 파티에 인계한다
    root.querySelector<HTMLSelectElement>('[name="fact-objective"]')!.value = 'f1-objective';
    root.querySelector<HTMLInputElement>('[name="preparation"][value="방패"]')!.checked = true;
    root.querySelector<HTMLFormElement>('[data-form="commission"]')!.requestSubmit();
    root.querySelector<HTMLButtonElement>('[data-party]')!.click();

    // Assert — 접수 확인만 보이고 성패는 감춰져 있다
    expect(root.textContent).toContain('내일 아침 보고서');
    expect(root.textContent).not.toContain('DISPATCH REPORT');
    expect(root.querySelector('.result-equation')).toBeNull();
  });

  it('오늘 마지막 의뢰를 넘기면 아침 화면에서 지난밤 보고와 새 공문이 함께 온다', async () => {
    // Arrange
    new CaseworkApp(root, { agent });
    await openCounter();

    // Act — 1일차 3건을 거절로 빠르게 넘긴다 (거절도 처리이므로 보고 대상이 된다)
    for (let index = 0; index < 3; index += 1) {
      root.querySelector<HTMLButtonElement>('[data-action="commission"]')!.click();
      root.querySelector<HTMLInputElement>('[name="decision"][value="reject"]')!.checked = true;
      root.querySelector<HTMLFormElement>('[data-form="commission"]')!.requestSubmit();
      root.querySelector<HTMLButtonElement>('[data-action="continue"]')!.click();
    }
    // 마지막 건을 넘기면 밤 급여 명세를 지나 다음 날 아침으로 간다.
    root.querySelector<HTMLButtonElement>('[data-action="continue"]')!.click();

    // Assert
    expect(root.textContent).toContain('2일차 근무');
    expect(root.textContent).toContain('지난밤 도착한 파견 보고');
    expect(root.textContent).toContain('오늘부터 적용되는 공문');
    expect(root.querySelectorAll('.overnight-item')).toHaveLength(3);
  });

  it('2일차 공문에 걸린 게시는 반려되고 서류가 잠기지 않는다', async () => {
    // Arrange — 2일차까지 진행한다
    new CaseworkApp(root, { agent });
    await openCounter();
    for (let index = 0; index < 3; index += 1) {
      root.querySelector<HTMLButtonElement>('[data-action="commission"]')!.click();
      root.querySelector<HTMLInputElement>('[name="decision"][value="reject"]')!.checked = true;
      root.querySelector<HTMLFormElement>('[data-form="commission"]')!.requestSubmit();
      root.querySelector<HTMLButtonElement>('[data-action="continue"]')!.click();
    }
    // 마지막 건을 넘기면 밤 급여 명세를 지나 다음 날 아침으로 간다.
    root.querySelector<HTMLButtonElement>('[data-action="continue"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-action="open-counter"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-action="commission"]')!.click();

    // Act — B급으로 기록하면서 응급 처치를 빠뜨린다
    root.querySelector<HTMLSelectElement>('[name="fact-objective"]')!.value = 'f4-objective';
    root.querySelector<HTMLInputElement>('[name="risk"][value="B"]')!.checked = true;
    root.querySelector<HTMLFormElement>('[data-form="commission"]')!.requestSubmit();

    // Assert — 반려 도장이 찍히고 지원 파티 화면으로 넘어가지 않는다
    expect(root.textContent).toContain('게시 반려');
    expect(root.textContent).toContain('응급 처치');
    expect(root.querySelector('.application-board')).toBeNull();
    expect(root.querySelector('[data-form="commission"]')).not.toBeNull();
  });
});
