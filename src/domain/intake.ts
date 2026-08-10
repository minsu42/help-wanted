import type { SlotContent } from './occupation';
import type {
  LeverageTag,
  Reach,
  SlotName,
  SlotProgress,
  SlotTruth,
} from './types';

export type IntakeResponse = 'ignorant' | 'evasive' | 'tells';

export interface IntakeMaterial {
  readonly id: string;
  readonly book: 'bestiary' | 'region' | 'order' | 'rates';
  readonly title: string;
  readonly body: string;
  readonly hintTags: readonly string[];
  readonly leverageTag: LeverageTag | null;
  readonly criteria?: readonly {
    readonly when: string;
    readonly grade: 'D' | 'C' | 'B' | 'A' | 'S';
    readonly open?: boolean;
  }[];
  readonly caution?: string;
}

export interface MaterialResult {
  readonly progress: SlotProgress;
  readonly patience: number;
  readonly success: boolean;
  readonly departed: boolean;
}

const REACH_VALUE: Readonly<Record<Reach, number>> = { none: 0, vague: 1, certain: 2 };

/** 무지를 먼저 판정한다. 모르는 것은 숨길 수도 없다. */
export function respond(
  truth: Pick<SlotTruth, 'knows' | 'tells'>,
  target: Exclude<Reach, 'none'>,
): IntakeResponse {
  if (REACH_VALUE[truth.knows] < REACH_VALUE[target]) return 'ignorant';
  if (REACH_VALUE[truth.tells] < REACH_VALUE[target]) return 'evasive';
  return 'tells';
}

/** 무료 질문 한 번의 상태 전이. 이미 막히거나 확정된 칸은 불변이다. */
export function askSlot(progress: SlotProgress, truth: SlotTruth): SlotProgress {
  if (progress.state === 'blocked' || progress.state === 'certain') return progress;
  const target = progress.state === 'vague' ? 'certain' : 'vague';
  const response = respond(truth, target);
  if (response === 'ignorant') return { state: 'blocked', limiter: 'knowledge' };
  if (response === 'evasive') return { state: 'blocked', limiter: 'disclosure' };
  return { state: target };
}

/** 착석 즉시 순순히 말할 수 있는 깊이를 계산한다. */
export function openingProgress(
  truth: SlotTruth,
  depth: 'all' | 'firstRung' | 'minimal',
): SlotProgress | undefined {
  if (depth === 'minimal') return undefined;
  const reach = Math.min(REACH_VALUE[truth.knows], REACH_VALUE[truth.tells]);
  if (reach === 0) return undefined;
  if (reach === 1 || depth === 'firstRung') return { state: 'vague' };
  return { state: 'certain' };
}

/** 무지 벽에 외부 지식을 건넨다. 성공은 무료, 헛발만 인내를 쓴다. */
export function useInsight(
  progress: SlotProgress,
  truth: SlotTruth,
  content: SlotContent,
  material: IntakeMaterial,
  patience: number,
): MaterialResult {
  if (progress.state !== 'blocked' || progress.limiter !== 'knowledge') {
    return unchanged(progress, patience);
  }
  const success = material.hintTags.some((tag) => content.hintTags.includes(tag));
  if (!success) return failed(progress, patience);
  return {
    progress: { state: truth.knows === 'none' ? 'vague' : 'certain' },
    patience,
    success: true,
    departed: false,
  };
}

/** 은폐 벽에 사람의 약점과 맞는 범주의 사실을 들이댄다. */
export function usePressure(
  progress: SlotProgress,
  truth: SlotTruth,
  material: IntakeMaterial,
  keyLeverage: LeverageTag | null,
  patience: number,
): MaterialResult {
  if (progress.state !== 'blocked' || progress.limiter !== 'disclosure') {
    return unchanged(progress, patience);
  }
  const success = keyLeverage !== null && material.leverageTag === keyLeverage;
  if (!success) return failed(progress, patience);
  return {
    progress: { state: truth.tells === 'none' ? 'vague' : 'certain' },
    patience,
    success: true,
    departed: false,
  };
}

/** 종류를 제외한 자동 기록의 가중 충실도. 저장하지 않고 필요할 때 계산한다. */
export function completeness(
  slots: ReadonlyMap<SlotName, SlotTruth>,
  progressOf: (slot: SlotName) => SlotProgress,
): number {
  let weighted = 0;
  let total = 0;
  for (const [slot, truth] of slots) {
    if (slot === 'kind') continue;
    total += truth.weight;
    const progress = progressOf(slot);
    const score = progress.state === 'certain' ? 1 : progress.state === 'vague' ? 0.5 : 0;
    weighted += truth.weight * score;
  }
  return total === 0 ? 1 : weighted / total;
}

function failed(progress: SlotProgress, patience: number): MaterialResult {
  const nextPatience = Math.max(0, patience - 1);
  return { progress, patience: nextPatience, success: false, departed: nextPatience === 0 };
}

function unchanged(progress: SlotProgress, patience: number): MaterialResult {
  return { progress, patience, success: false, departed: false };
}
