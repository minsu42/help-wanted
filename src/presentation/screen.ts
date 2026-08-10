/**
 * 화면 모듈의 공통 기반 — 규약과 표시 어휘.
 *
 * UI 프레임워크를 쓰지 않으므로 규약을 코드로 세운다. 화면이 넷 이상 생기는데
 * 각자 `escapeHtml`을 복사하고 등급 이름을 따로 적으면, 어느 화면에서는
 * "수다스러움"이고 다른 화면에서는 "수다스럽다"가 된다. 그 종류의 어긋남은 버그로
 * 잡히지 않고 그냥 조잡해 보인다.
 */
import type { Goal, Grade, Trait } from '../domain/types';
import hallLayout from '../data/hall-layout.json';

/**
 * 모든 화면 모듈이 돌려주는 것.
 *
 * `mount<이름>Screen(root, deps) => ScreenHandle` 이 이 프로젝트의 화면 규약이다.
 * `destroy()`는 리스너와 DOM을 정리하며 두 번 불러도 안전해야 한다.
 */
export interface ScreenHandle {
  destroy(): void;
}

/**
 * 생성된 문자열을 innerHTML에 넣기 전에 반드시 통과시킨다.
 *
 * 이름이 `names.json`에서 조합된 것이라 안전하다는 것은 **이번 주의 사실**이지 구조적
 * 보장이 아니다. 표를 늘리는 사람이 이 함수의 존재를 모를 수 있다.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 같은 인물은 창구 밖 모든 화면에서 같은 캐스트 아틀라스 칸을 쓴다. */
export function castIndexOf(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return hash % hallLayout.castCount;
}

/**
 * 장부에 적히는 역량 등급의 표시 이름.
 *
 * **화면에 나가는 유일한 역량 표현이다.** 원본 숫자(`Adventurer.capability`)는 절대
 * 렌더하지 않는다 — 숫자가 보이면 배정이 뺄셈이 되고, 뺄셈은 판단이 아니다.
 */
export const GRADE_LABELS: Readonly<Record<Grade, string>> = {
  green: '풋내기',
  steady: '한몫',
  skilled: '숙련',
  veteran: '베테랑',
};

/**
 * 성격 태그의 표시 이름.
 *
 * **항상 보인다.** 왜곡이 무작위가 아니라 체계적이라는 것을 플레이어가 배우려면
 * 누가 어떤 성격인지 늘 보여야 한다 — *"저 친구 말은 늘 과장이니 좀 깎아 듣자"* 가
 * 성립하는 근거다.
 */
export const TRAIT_LABELS: Readonly<Record<Trait, string>> = {
  talkative: '수다스럽다',
  cautious: '신중하다',
  greedy: '탐욕스럽다',
  loyal: '의리 있다',
  bitter: '냉소적이다',
  boastful: '허풍스럽다',
};

/** 인물이 원하는 것의 표시 이름. 장식이 아니라 실제로 배정 거부와 자원을 가른다. */
export const GOAL_LABELS: Readonly<Record<Goal, string>> = {
  money: '보수',
  glory: '명예',
  survival: '생존',
  revenge: '복수',
};
