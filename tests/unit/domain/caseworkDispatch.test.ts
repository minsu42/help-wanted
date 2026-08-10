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
      full.entries[slot] = fact.id;
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
    sheet.entries.trait = 'f1-trait';
    const result = resolveDispatch(caseData, sheet, PARTIES[0], 18, ['f1-objective']);
    expect(result.completeness).toBe(0);
  });

  it('준비 선택지는 사건과 무관하게 같은 순서이며 정답을 앞으로 당기지 않는다', () => {
    // Arrange · Act
    const positions = CASES.map((item) =>
      item.requiredPreparations.map((need) => PREPARATION_OPTIONS.indexOf(need)));
    const leadingBlocks = CASES.map((item) => ({
      required: [...item.requiredPreparations].sort().join('|'),
      leading: [...PREPARATION_OPTIONS.slice(0, item.requiredPreparations.length)].sort().join('|'),
    }));

    // Assert — 모든 필수 준비가 선택지에 있다
    expect(positions.every((row) => row.every((index) => index >= 0))).toBe(true);
    // Assert — 어떤 사건에서도 정답 묶음이 목록 맨 앞 칸을 그대로 차지하지 않는다 (순서만 다른 경우 포함)
    expect(leadingBlocks.every((row) => row.required !== row.leading)).toBe(true);
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

  it('빈 칸은 현장 진술서에서 이름과 함께 지목되고, 진실은 사후에 나온다', () => {
    // Arrange — 목표만 적고 나머지를 비운 서류
    const caseData = CASES[0]!;
    const sheet = emptyCommission();
    sheet.entries.objective = caseData.facts.find((fact) => fact.slot === 'objective')!.id;
    const disclosed = caseData.facts.map((fact) => fact.id);

    // Act
    const report = resolveDispatch(caseData, sheet, PARTIES[0], 18, disclosed).report!;

    // Assert — 비운 네 칸이 모두 진술에 나오고, 채운 칸은 나오지 않는다
    const body = report.lines.join('\n');
    for (const label of ['대상', '규모', '장소·경로', '특징·약점']) expect(body).toContain(`「${label}」 칸이 비어 있었습니다`);
    expect(body).not.toContain('「목표」');
    // 진실은 진술서에서만 공개된다 — 파견 전 화면이 아니라
    expect(body).toContain(caseData.facts.find((fact) => fact.slot === 'target')!.value);
    expect(report.speaker).toContain(PARTIES[0]!.name);
  });

  it('서류가 완전하면 진술서는 접수원을 탓하지 않는다', () => {
    // Arrange — 모든 칸·등급·준비를 맞춘 서류
    const caseData = CASES[0]!;
    const sheet = emptyCommission();
    sheet.risk = caseData.correctRisk;
    sheet.preparations = [...caseData.requiredPreparations];
    for (const slot of COMMISSION_SLOTS) sheet.entries[slot] = caseData.facts.find((fact) => fact.slot === slot)!.id;

    // Act
    const report = resolveDispatch(caseData, sheet, PARTIES[0], 18, caseData.facts.map((fact) => fact.id)).report!;

    // Assert
    expect(report.lines.join('\n')).not.toContain('비어 있었습니다');
    expect(report.lines.length).toBeGreaterThan(1);
  });

  it('거절과 미인계에는 진술할 사람이 없다', () => {
    const caseData = CASES[0]!;
    const rejected = emptyCommission();
    rejected.accepted = false;
    const unassigned = emptyCommission();
    unassigned.accepted = true;
    expect(resolveDispatch(caseData, rejected, undefined, 18, []).report).toBeUndefined();
    expect(resolveDispatch(caseData, unassigned, undefined, 18, []).report).toBeUndefined();
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
