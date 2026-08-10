import { describe, expect, it } from 'vitest';
import { CASES, KNOWLEDGE } from '../../../src/data/casework';
import { createSession, type InterpretedTurn } from '../../../src/domain/casework';
import { compareClaim, resolveTurn } from '../../../src/domain/intakeEngine';

const CASE = CASES[0]!;

function turn(overrides: Partial<InterpretedTurn> = {}): InterpretedTurn {
  return {
    intent: 'ask',
    targetSlots: ['trait'],
    assertedFactIds: [],
    citedKnowledgeIds: [],
    tone: 'neutral',
    confidence: 0.9,
    ...overrides,
  };
}

describe('한 문장 심문 규칙', () => {
  it('진술과 사건에 연결된 백과사전 문장을 유효한 대조로 판정한다', () => {
    const comparison = compareClaim(CASE, 'c1-scratch', 'k-mimic-scratches', KNOWLEDGE);
    expect(comparison.valid).toBe(true);
    expect(comparison.slot).toBe('trait');
  });

  it('무관한 규정 문장은 대조 근거가 되지 않는다', () => {
    expect(compareClaim(CASE, 'c1-rat', 'k-smuggling', KNOWLEDGE).valid).toBe(false);
  });
  it('은폐 사실은 자료 지식 없이 열리지 않는다', () => {
    const result = resolveTurn(CASE, createSession(CASE), 'turn-1', turn(), KNOWLEDGE);
    expect(result.receipt.revealedFactIds).toEqual([]);
    expect(result.session.disclosedFactIds).not.toContain('f1-trait');
  });

  it('문장 속 유효한 자료 지식이 은폐 사실을 연다', () => {
    const result = resolveTurn(CASE, createSession(CASE), 'turn-1', turn({ citedKnowledgeIds: ['k-mimic-scratches'] }), KNOWLEDGE);
    expect(result.receipt.revealedFactIds).toEqual(['f1-trait']);
    expect(result.session.disclosedFactIds).toContain('f1-trait');
    expect(result.receipt.guardDelta).toBe(-1);
  });

  it('존재하지 않는 지식 ID는 하드 판정에 영향을 주지 않는다', () => {
    const result = resolveTurn(CASE, createSession(CASE), 'turn-1', turn({ citedKnowledgeIds: ['invented-rule'] }), KNOWLEDGE);
    expect(result.receipt.validKnowledgeIds).toEqual([]);
    expect(result.receipt.revealedFactIds).toEqual([]);
  });

  it('같은 turnId 재전송은 동일한 영수증을 반환하고 상태를 중복 변경하지 않는다', () => {
    const first = resolveTurn(CASE, createSession(CASE), 'same-turn', turn({ citedKnowledgeIds: ['k-mimic-scratches'] }), KNOWLEDGE);
    const second = resolveTurn(CASE, first.session, 'same-turn', turn({ tone: 'hostile' }), KNOWLEDGE);
    expect(second.session).toBe(first.session);
    expect(second.receipt).toEqual(first.receipt);
    expect(second.session.disclosedFactIds.filter((id) => id === 'f1-trait')).toHaveLength(1);
  });

  it('예산 상한을 넘는 요구는 상한 금액으로 역제안한다', () => {
    const result = resolveTurn(CASE, createSession(CASE), 'turn-money', turn({ intent: 'negotiate', targetSlots: [], offerAmount: 99 }), KNOWLEDGE);
    expect(result.receipt.agreedReward).toBeUndefined();
    expect(result.receipt.counterOffer).toBe(CASE.budgetCap);
    expect(result.session.reward).toBe(CASE.budgetCap);
  });
});
