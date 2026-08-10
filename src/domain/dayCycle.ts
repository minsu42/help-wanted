import type { Directive, DispatchResult, KnowledgeEntry } from './casework';

/** 하루에 창구가 받는 의뢰 수. 시연 경로는 1일차 3건으로 끝난다. */
export const CASES_PER_DAY = 3;

export function dayOfCase(caseIndex: number): number {
  return Math.floor(caseIndex / CASES_PER_DAY) + 1;
}

export function isLastCaseOfDay(caseIndex: number, totalCases: number): boolean {
  return caseIndex + 1 >= totalCases || dayOfCase(caseIndex + 1) !== dayOfCase(caseIndex);
}

/**
 * 그날 펼칠 수 있는 자료.
 *
 * 두 가지로 늘어난다 — 날짜가 지나 붙는 **공문**과, 파견 보고가 돌아와 추가되는
 * **현장 기록**이다. 후자는 자료집이 어디서 오는지에 대한 답이기도 하다:
 * 아무도 앉아서 쓰지 않았고, 누군가 다녀왔기 때문에 그 페이지가 있다.
 */
export function knowledgeForDay(
  knowledge: readonly KnowledgeEntry[],
  day: number,
  reportedCaseIds: readonly string[] = [],
): readonly KnowledgeEntry[] {
  return knowledge.filter((entry) => (entry.activeFromDay ?? 1) <= day
    && (entry.unlockedByCase === undefined || reportedCaseIds.includes(entry.unlockedByCase)));
}

/** 이번에 새로 자료집에 오른 현장 기록. 아침 화면에서 알린다. */
export function knowledgeUnlockedBy(
  knowledge: readonly KnowledgeEntry[],
  caseIds: readonly string[],
): readonly KnowledgeEntry[] {
  return knowledge.filter((entry) => entry.unlockedByCase !== undefined && caseIds.includes(entry.unlockedByCase));
}

export function directivesForDay(directives: readonly Directive[], day: number): readonly Directive[] {
  return directives.filter((directive) => directive.activeFromDay <= day);
}

/** 그날 아침 새로 붙은 공문. 아침 화면에서 강조한다. */
export function newDirectivesOn(directives: readonly Directive[], day: number): readonly Directive[] {
  return directives.filter((directive) => directive.activeFromDay === day);
}

export interface DirectiveRejection {
  directiveId: string;
  title: string;
  reason: string;
}

/**
 * 게시 도장을 찍기 전 활성 공문을 전부 검사한다.
 *
 * 하나라도 걸리면 반려하고 서류를 다시 쓰게 한다 — 어제 통하던 게시가 오늘 반려되는 것이
 * 일일 공문의 유일한 존재 이유다.
 */
export function checkDirectives(
  directives: readonly Directive[],
  day: number,
  sheet: Parameters<Directive['violation']>[0],
): DirectiveRejection[] {
  return directivesForDay(directives, day).flatMap((directive) => {
    const reason = directive.violation(sheet);
    return reason ? [{ directiveId: directive.id, title: directive.title, reason }] : [];
  });
}

/**
 * 실제로 사람이 다녀온 사건의 id만 고른다.
 *
 * 거절하거나 인계하지 못한 의뢰는 현장이 없다. 자료집에 새 쪽이 생기려면
 * 누군가 그곳에 갔다 와야 한다.
 */
export function dispatchedCaseIds(items: readonly PendingDispatch[], caseIdOf: (index: number) => string): string[] {
  return items
    .filter((item) => item.result.outcome !== 'rejected' && item.result.outcome !== 'unassigned')
    .map((item) => caseIdOf(item.caseIndex));
}

export interface PendingDispatch {
  caseIndex: number;
  clientName: string;
  premise: string;
  result: DispatchResult;
}
