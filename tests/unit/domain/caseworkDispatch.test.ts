import { describe, expect, it } from 'vitest';
import { CASES, PARTIES, PREPARATION_OPTIONS } from '../../../src/data/casework';
import { COMMISSION_SLOTS, emptyCommission } from '../../../src/domain/casework';
import { getPartyApplications, resolveDispatch } from '../../../src/domain/dispatchEngine';

describe('의뢰서와 파견 판정', () => {
  it('파티는 실제 위협이 아니라 게시된 등급·보수·준비를 보고 지원한다', () => {
    const sheet = emptyCommission();
    sheet.risk = 'D';
    sheet.preparations = ['방패'];
    const applications = getPartyApplications(sheet, PARTIES, 18);
    expect(applications.find((item) => item.partyId === 'party-pawn')?.status).toBe('applied');
    expect(applications.find((item) => item.partyId === 'party-stag')?.status).toBe('refused');
  });
  it('충실한 의뢰서는 같은 파티에서 빈 의뢰서보다 나쁜 결과를 만들지 않는다', () => {
    const caseData = CASES[0]!;
    const party = PARTIES[0]!;
    const empty = emptyCommission();
    empty.partyId = party.id;
    const full = emptyCommission();
    full.partyId = party.id;
    full.risk = caseData.correctRisk;
    full.preparations = [...caseData.requiredPreparations];
    for (const slot of COMMISSION_SLOTS) {
      const fact = caseData.facts.find((candidate) => candidate.slot === slot)!;
      full.entries[slot] = { factId: fact.id, confidence: 'confirmed' };
    }
    const disclosed = caseData.facts.map((fact) => fact.id);
    const emptyResult = resolveDispatch(caseData, empty, party, 30, disclosed);
    const fullResult = resolveDispatch(caseData, full, party, 30, disclosed);
    expect(fullResult.score).toBeGreaterThan(emptyResult.score);
    expect(fullResult.completeness).toBe(4);
  });

  it('공개되지 않은 사실을 조작해 제출해도 충실도에 포함하지 않는다', () => {
    const caseData = CASES[0]!;
    const sheet = emptyCommission();
    sheet.entries.trait = { factId: 'f1-trait', confidence: 'confirmed' };
    const result = resolveDispatch(caseData, sheet, PARTIES[0], 18, ['f1-objective']);
    expect(result.completeness).toBe(0);
  });

  it('준비 선택지는 사건과 무관하게 같은 순서이며 정답을 앞으로 당기지 않는다', () => {
    // Arrange · Act
    const positions = CASES.map((item) =>
      item.requiredPreparations.map((need) => PREPARATION_OPTIONS.indexOf(need)));

    // Assert — 모든 필수 준비가 선택지에 있고, 어떤 사건도 정답이 목록 맨 앞을 차지하지 않는다
    expect(positions.every((row) => row.every((index) => index >= 0))).toBe(true);
    expect(positions.every((row) => row.join('|') !== row.map((_, index) => index).join('|'))).toBe(true);
  });

  it('게시했으나 인계하지 않으면 파견 없이 미인계로 마감한다', () => {
    // Arrange
    const caseData = CASES[0]!;
    const sheet = emptyCommission();
    sheet.accepted = true;

    // Act
    const result = resolveDispatch(caseData, sheet, undefined, 24, []);

    // Assert
    expect(result.outcome).toBe('unassigned');
    expect(result.reward).toBe(0);
  });

  it('불법 의뢰 거절은 파견 없이 규정 준수 결과를 만든다', () => {
    const caseData = CASES[1]!;
    const sheet = emptyCommission();
    sheet.accepted = false;
    const result = resolveDispatch(caseData, sheet, undefined, 20, []);
    expect(result.outcome).toBe('rejected');
    expect(result.notes[0]).toContain('규정');
  });
});
