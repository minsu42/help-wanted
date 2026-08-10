import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  askSlot,
  completeness,
  openingProgress,
  respond,
  useInsight,
  usePressure,
  type IntakeMaterial,
} from '../../../src/domain/intake';
import type { SlotContent } from '../../../src/domain/occupation';
import type { Reach, SlotProgress, SlotTruth } from '../../../src/domain/types';

const reaches: readonly Reach[] = ['none', 'vague', 'certain'];
const rank: Readonly<Record<Reach, number>> = { none: 0, vague: 1, certain: 2 };
const truth = (knows: Reach, tells: Reach, weight = 1): SlotTruth => ({
  knows,
  tells,
  valueKey: 'test',
  weight,
});
const content: SlotContent = {
  topic: '대상',
  vague: '큰 흔적',
  certain: '발가락 셋',
  weight: 3,
  hintTags: ['tracks'],
};
const material = (overrides: Partial<IntakeMaterial> = {}): IntakeMaterial => ({
  id: 'hb',
  book: 'bestiary',
  title: '흔적',
  body: '읽을거리',
  hintTags: ['tracks'],
  leverageTag: 'procedure',
  ...overrides,
});

describe('청취 판정', () => {
  for (const target of ['vague', 'certain'] as const) {
    for (const knows of reaches) {
      for (const tells of reaches) {
        it(`${target}: knows=${knows}, tells=${tells}`, () => {
          const expected = rank[knows] < rank[target]
            ? 'ignorant'
            : rank[tells] < rank[target]
              ? 'evasive'
              : 'tells';
          expect(respond({ knows, tells }, target)).toBe(expected);
        });
      }
    }
  }

  it('무지와 은폐가 모두 낮으면 무지가 우선한다', () => {
    expect(respond({ knows: 'none', tells: 'none' }, 'vague')).toBe('ignorant');
  });

  it('질문은 무료이며 막힌 칸 재질문은 불변이다', () => {
    const blocked: SlotProgress = { state: 'blocked', limiter: 'knowledge' };
    expect(askSlot({ state: 'unknown' }, truth('none', 'none'))).toEqual(blocked);
    expect(askSlot(blocked, truth('certain', 'certain'))).toBe(blocked);
  });

  it('선제 진술은 min(knows,tells)까지만 연다', () => {
    expect(openingProgress(truth('certain', 'vague'), 'all')).toEqual({ state: 'vague' });
    expect(openingProgress(truth('certain', 'certain'), 'all')).toEqual({ state: 'certain' });
    expect(openingProgress(truth('certain', 'certain'), 'minimal')).toBeUndefined();
  });

  it('일깨우기와 들이대기는 성공 무료, 헛발만 인내를 쓴다', () => {
    const ignorance: SlotProgress = { state: 'blocked', limiter: 'knowledge' };
    const concealment: SlotProgress = { state: 'blocked', limiter: 'disclosure' };
    expect(useInsight(ignorance, truth('none', 'certain'), content, material(), 3)).toMatchObject({
      progress: { state: 'vague' }, patience: 3, success: true,
    });
    expect(useInsight(ignorance, truth('none', 'certain'), content, material({ hintTags: ['water'] }), 1)).toEqual({
      progress: ignorance, patience: 0, success: false, departed: true,
    });
    expect(usePressure(concealment, truth('certain', 'none'), material(), 'procedure', 3)).toMatchObject({
      progress: { state: 'vague' }, patience: 3, success: true,
    });
    expect(usePressure(concealment, truth('certain', 'none'), material(), null, 3)).toMatchObject({
      progress: concealment, patience: 2, success: false,
    });
  });

  it('정보 충실도 워크드 예제와 분모 0을 고정한다', () => {
    const slots = new Map([
      ['kind', truth('certain', 'certain', 0)],
      ['target', truth('certain', 'certain', 3)],
      ['scale', truth('certain', 'certain', 2)],
      ['place', truth('certain', 'certain', 1)],
    ] as const);
    const progress = new Map<string, SlotProgress>([
      ['target', { state: 'certain' }],
      ['scale', { state: 'vague' }],
      ['place', { state: 'unknown' }],
    ]);
    expect(completeness(slots, (slot) => progress.get(slot) ?? { state: 'unknown' })).toBeCloseTo(4 / 6);
    expect(completeness(new Map([['kind', truth('certain', 'certain', 0)]]), () => ({ state: 'unknown' }))).toBe(1);
  });

  it('판정 모듈은 난수·네트워크를 import하지 않는다', () => {
    const source = readFileSync('src/domain/intake.ts', 'utf8');
    expect(source).not.toMatch(/from ['"].*rng/);
    expect(source).not.toContain('fetch(');
    expect(source).not.toContain('Math.random');
  });
});
