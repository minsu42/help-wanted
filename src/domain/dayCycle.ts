import type { Directive, DispatchResult, KnowledgeEntry } from './casework';

/** 하루에 창구가 받는 의뢰 수. 시연 경로는 1일차 3건으로 끝난다. */
export const CASES_PER_DAY = 3;

export function dayOfCase(caseIndex: number): number {
  return Math.floor(caseIndex / CASES_PER_DAY) + 1;
}

export function isLastCaseOfDay(caseIndex: number, totalCases: number): boolean {
  return caseIndex + 1 >= totalCases || dayOfCase(caseIndex + 1) !== dayOfCase(caseIndex);
}

/** 그날까지 유효한 자료만 남긴다. 아직 붙지 않은 조항은 백과사전에도 보이지 않는다. */
export function knowledgeForDay(knowledge: readonly KnowledgeEntry[], day: number): readonly KnowledgeEntry[] {
  return knowledge.filter((entry) => (entry.activeFromDay ?? 1) <= day);
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

export interface PendingDispatch {
  caseIndex: number;
  clientName: string;
  premise: string;
  result: DispatchResult;
}
