import type { SlotName, SlotProgress } from './types';

/**
 * 슬롯의 정식 스키마 순서. RNG 소비와 저장 재구성에 영향을 주므로 재정렬도 스키마 변경이다.
 */
export const SLOT_NAMES: readonly SlotName[] = [
  'kind',
  'target',
  'scale',
  'place',
  'deadline',
  'route',
  'weakness',
];

/** 의뢰서에 표시하는 파생 상태. 저장된 다섯 구별을 대체하지 않는다. */
export type SheetMark = 'confirmed' | 'ambiguous' | 'unfilled';

/** 저장 상태를 의뢰서의 세 표시 중 하나로 접는다. 역변환은 의도적으로 제공하지 않는다. */
export function sheetMark(progress: SlotProgress): SheetMark {
  if (progress.state === 'certain') return 'confirmed';
  if (progress.state === 'vague') return 'ambiguous';
  return 'unfilled';
}

/** `PlayerKnowledge.slotProgress`가 사용하는 충돌 없는 키를 만든다. */
export function slotProgressKey(contractId: string, slot: SlotName): string {
  return `${contractId}:${slot}`;
}

/** 없는 키는 묻지 않은 `unknown`으로 읽는다. 맵에는 묻기 전 항목을 미리 쓰지 않는다. */
export function slotProgressOf(
  progress: ReadonlyMap<string, SlotProgress>,
  contractId: string,
  slot: SlotName,
): SlotProgress {
  return progress.get(slotProgressKey(contractId, slot)) ?? { state: 'unknown' };
}
