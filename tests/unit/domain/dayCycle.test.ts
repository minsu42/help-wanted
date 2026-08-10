import { describe, expect, it } from 'vitest';
import { CASES, DIRECTIVES, KNOWLEDGE } from '../../../src/data/casework';
import { emptyCommission } from '../../../src/domain/casework';
import {
  CASES_PER_DAY, checkDirectives, dayOfCase, dispatchedCaseIds, isLastCaseOfDay, knowledgeForDay,
  knowledgeUnlockedBy, newDirectivesOn,
} from '../../../src/domain/dayCycle';

describe('하루 주기', () => {
  it('시연 경로인 첫 3사건이 1일차 안에서 끝난다', () => {
    // Arrange · Act
    const days = CASES.map((_, index) => dayOfCase(index));

    // Assert
    expect(CASES_PER_DAY).toBe(3);
    expect(days.slice(0, 3)).toEqual([1, 1, 1]);
    expect(isLastCaseOfDay(2, CASES.length)).toBe(true);
    expect(isLastCaseOfDay(1, CASES.length)).toBe(false);
  });

  it('마지막 사건은 다음 날을 열지 않고 근무를 끝낸다', () => {
    expect(isLastCaseOfDay(CASES.length - 1, CASES.length)).toBe(true);
  });
});

describe('일일 공문', () => {
  it('내일 붙을 조항은 오늘 백과사전에 없다', () => {
    // Arrange · Act
    const dayOne = knowledgeForDay(KNOWLEDGE, 1);
    const dayTwo = knowledgeForDay(KNOWLEDGE, 2);

    // Assert
    expect(dayOne.some((entry) => entry.id === 'k-medic-mandate')).toBe(false);
    expect(dayTwo.some((entry) => entry.id === 'k-medic-mandate')).toBe(true);
    expect(dayTwo.length).toBeGreaterThan(dayOne.length);
  });

  it('어제 통하던 게시가 오늘 공문에 걸려 반려된다', () => {
    // Arrange — B급으로 기록하고 응급 처치를 요구하지 않은 의뢰서
    const sheet = emptyCommission();
    sheet.entries.objective = 'f1-objective';
    sheet.risk = 'B';
    sheet.preparations = ['방패'];

    // Act
    const dayOne = checkDirectives(DIRECTIVES, 1, sheet);
    const dayTwo = checkDirectives(DIRECTIVES, 2, sheet);

    // Assert
    expect(dayOne).toHaveLength(0);
    expect(dayTwo.map((item) => item.directiveId)).toContain('d-medic-for-high-risk');
  });

  it('첫날에도 목표와 대상이 모두 미상인 백지 의뢰서는 반려된다', () => {
    // Arrange
    const blank = emptyCommission();

    // Act
    const rejections = checkDirectives(DIRECTIVES, 1, blank);

    // Assert
    expect(rejections.map((item) => item.directiveId)).toContain('d-blank-sheet');
  });

  it('공문은 의뢰서에 적힌 내용만 보고 판정한다', () => {
    // Arrange — 사건의 실제 진실을 참조하면 반려 문구가 곧 정답 공개가 된다
    const sheet = emptyCommission();
    sheet.entries.target = 'f1-target';

    // Act — 같은 서류는 어떤 사건에서 냈든 같은 판정을 받아야 한다
    const verdicts = CASES.map(() => checkDirectives(DIRECTIVES, 2, sheet).map((item) => item.directiveId).join(','));

    // Assert
    expect(new Set(verdicts).size).toBe(1);
  });

  it('아침에 새로 붙는 공문만 강조 대상이 된다', () => {
    expect(newDirectivesOn(DIRECTIVES, 1).every((item) => item.activeFromDay === 1)).toBe(true);
    expect(newDirectivesOn(DIRECTIVES, 2).length).toBeGreaterThan(0);
    expect(newDirectivesOn(DIRECTIVES, 2).some((item) => item.id === 'd-blank-sheet')).toBe(false);
  });
});

describe('자료집의 출처', () => {
  it('실제로 다녀온 사건만 현장 기록을 연다', () => {
    // Arrange — 같은 사건을 하나는 파견, 하나는 거절로 처리한다
    const base = { caseIndex: 0, clientName: '마라', premise: '술통' };
    const dispatched = { ...base, result: { caseId: 'case-rat-cellar', score: 3, completeness: 4, preparation: 2, outcome: 'success' as const, reward: 18, notes: [] } };
    const refused = { ...base, result: { caseId: 'case-rat-cellar', score: 0, completeness: 0, preparation: 0, outcome: 'rejected' as const, reward: 0, notes: [] } };
    const caseIdOf = () => 'case-rat-cellar';

    // Act
    const wentThere = dispatchedCaseIds([dispatched], caseIdOf);
    const nobodyWent = dispatchedCaseIds([refused], caseIdOf);

    // Assert
    expect(knowledgeUnlockedBy(KNOWLEDGE, wentThere).map((entry) => entry.id)).toContain('k-mimic-aftermath');
    expect(knowledgeUnlockedBy(KNOWLEDGE, nobodyWent)).toHaveLength(0);
  });

  it('현장 기록은 보고가 오기 전 자료집에 없다', () => {
    expect(knowledgeForDay(KNOWLEDGE, 2, []).some((entry) => entry.id === 'k-mimic-aftermath')).toBe(false);
    expect(knowledgeForDay(KNOWLEDGE, 1, ['case-rat-cellar']).some((entry) => entry.id === 'k-mimic-aftermath')).toBe(true);
  });
});
