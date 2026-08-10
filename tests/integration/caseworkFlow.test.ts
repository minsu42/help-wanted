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

  it('업무 시작 후 고정 창구와 백과사전·진술 대조 도구를 연다', async () => {
    new CaseworkApp(root, { agent });
    root.querySelector<HTMLButtonElement>('[data-action="start"]')!.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(root.querySelector('#utterance')).not.toBeNull();
    expect(root.querySelectorAll('.utterance-form textarea')).toHaveLength(1);
    expect(root.querySelectorAll('.utterance-form select')).toHaveLength(0);
    expect(root.textContent).toContain('길드 백과사전');
    expect(root.textContent).toContain('진술 쪽지');
    expect(root.querySelector('[data-action="compare"]')).not.toBeNull();
  });

  it('백과사전은 실제 책 오버레이로 열리고 대조 문장을 선택할 수 있다', async () => {
    new CaseworkApp(root, { agent });
    root.querySelector<HTMLButtonElement>('[data-action="start"]')!.click();
    await Promise.resolve(); await Promise.resolve();
    root.querySelector<HTMLButtonElement>('[data-action="book"]')!.click();
    expect(root.querySelector('[aria-label="길드 백과사전"]')).not.toBeNull();
    expect(root.textContent).toContain('크기');
    expect(root.textContent).toContain('약점');
    root.querySelector<HTMLButtonElement>('[data-knowledge="k-mimic-scratches"]')!.click();
    expect(root.textContent).toContain('증거: 상자형 미믹');
  });

  it('백과사전을 종류 태그로 거르고 선택 문장은 입력창에 자동 복사하지 않는다', async () => {
    new CaseworkApp(root, { agent });
    root.querySelector<HTMLButtonElement>('[data-action="start"]')!.click();
    await Promise.resolve(); await Promise.resolve();
    root.querySelector<HTMLButtonElement>('[data-action="book"]')!.click();
    root.querySelector<HTMLButtonElement>('[data-book-tag="거인종"]')!.click();
    expect(root.textContent).toContain('이끼 다리 트롤');
    expect(root.textContent).not.toContain('상자형 미믹');
    root.querySelector<HTMLButtonElement>('[data-knowledge="k-troll"]')!.click();
    expect(root.querySelector<HTMLTextAreaElement>('#utterance')!.value).toBe('');
  });

  it('물리적으로 선택한 대조 근거가 AI의 일반 슬롯 해석보다 우선한다', async () => {
    new CaseworkApp(root, { agent });
    root.querySelector<HTMLButtonElement>('[data-action="start"]')!.click();
    await Promise.resolve(); await Promise.resolve();
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
    root.querySelector<HTMLButtonElement>('[data-action="start"]')!.click();
    await Promise.resolve();
    await Promise.resolve();
    const textarea = root.querySelector<HTMLTextAreaElement>('#utterance')!;
    textarea.value = '몇 마리였습니까?';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    root.querySelector<HTMLFormElement>('[data-form="utterance"]')!.requestSubmit();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(root.textContent).toContain('미믹 1개체');
    expect(root.textContent).toContain('의뢰서 작성');
  });
});
