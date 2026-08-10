/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest';
import { CASES, KNOWLEDGE } from '../../../src/data/casework';
import { createSession } from '../../../src/domain/casework';
import { createClientAgent, createDevelopmentAgent, createResilientAgent, type ClientAgent } from '../../../src/llm/clientAgent';

it('예선 사건은 정직·오해·기만형을 포함한 6종이다', () => {
  expect(CASES).toHaveLength(6);
  expect(CASES.some((item) => item.demeanor.includes('정직'))).toBe(true);
  expect(CASES.some((item) => item.demeanor.includes('기만'))).toBe(true);
  expect(CASES.every((item) => item.opening.length >= 100 && item.openingClaims.length >= 3)).toBe(true);
});

describe('개발용 한 문장 해석기', () => {
  it('질문과 자료 인용을 한 문장에서 구조화한다', async () => {
    const agent = createClientAgent({ development: true });
    const caseData = CASES[0]!;
    const parsed = await agent.interpret({
      turnId: 't1',
      utterance: '도감에는 평행한 긁힘이 미믹 흔적이라는데 바닥에 그런 자국이 있었습니까?',
      caseData,
      session: createSession(caseData),
      knowledge: KNOWLEDGE,
    });
    expect(parsed.targetSlots).toContain('trait');
    expect(parsed.citedKnowledgeIds).toContain('k-mimic-scratches');
    expect(parsed.intent).toBe('challenge');
  });

  it('협상 금액을 숫자로 추출한다', async () => {
    const agent = createClientAgent({ development: true });
    const caseData = CASES[0]!;
    const parsed = await agent.interpret({
      turnId: 't2', utterance: 'C급 시세에 맞춰 은화 28닢을 요구합니다.', caseData,
      session: createSession(caseData), knowledge: KNOWLEDGE,
    });
    expect(parsed.intent).toBe('negotiate');
    expect(parsed.offerAmount).toBe(28);
  });
});

describe('원격 AI 의뢰인 연결 계약', () => {
  it('최신 문장·최근 대화·인물 태도를 Worker 응답 에이전트에 전달한다', async () => {
    const bodies: unknown[] = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      if (init?.body) bodies.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ utterance: '확인해 보니 그렇군요.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    const caseData = CASES[0]!;
    const session = createSession(caseData);
    const agent = createClientAgent({ endpoint: 'https://agent.example', fetchImpl });
    expect(agent.mode).toBe('remote');
    await agent.respond({
      turnId: 'remote-1', utterance: '상자가 움직인 것을 직접 봤습니까?', caseData, session,
      receipt: { turnId: 'remote-1', revealedFactIds: [], validKnowledgeIds: [], patienceDelta: 0, guardDelta: 0, reaction: '직접 보지는 못했습니다.' },
    });
    expect(bodies[0]).toMatchObject({
      playerUtterance: '상자가 움직인 것을 직접 봤습니까?',
      persona: { demeanor: caseData.demeanor },
      conversation: [{ speaker: 'client', text: caseData.opening }],
    });
  });
});

describe('AI 연결 실패 시 규칙 폴백', () => {
  const deadRemote: ClientAgent = {
    mode: 'remote',
    checkHealth: async () => false,
    interpret: async () => { throw new Error('agent_http_503'); },
    respond: async () => { throw new Error('agent_http_503'); },
  };

  it('헬스체크가 실패해도 업무를 시작할 수 있고 폴백 모드를 노출한다', async () => {
    // Arrange
    const agent = createResilientAgent(deadRemote, createDevelopmentAgent());

    // Act
    const healthy = await agent.checkHealth();

    // Assert
    expect(healthy).toBe(true);
    expect(agent.mode).toBe('development');
  });

  it('턴 중 원격 호출이 죽어도 규칙 해석으로 같은 턴을 완주한다', async () => {
    // Arrange
    const caseData = CASES[0]!;
    const agent = createResilientAgent(deadRemote, createDevelopmentAgent());

    // Act
    const parsed = await agent.interpret({
      turnId: 'fallback-1',
      utterance: '바닥에 나란한 긁힘이 있었습니까?',
      caseData,
      session: createSession(caseData),
      knowledge: KNOWLEDGE,
    });

    // Assert
    expect(parsed.targetSlots).toContain('trait');
    expect(agent.mode).toBe('development');
  });

  it('엔드포인트가 없으면 연결 불가가 아니라 규칙 폴백으로 시작한다', async () => {
    // Arrange · Act
    const agent = createClientAgent({});

    // Assert
    expect(agent.mode).toBe('development');
    await expect(agent.checkHealth()).resolves.toBe(true);
  });
});
