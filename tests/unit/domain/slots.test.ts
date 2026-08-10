import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  SLOT_NAMES,
  sheetMark,
  slotProgressKey,
  slotProgressOf,
  type SheetMark,
} from '../../../src/domain/slots';
import type {
  Limiter,
  Reach,
  SlotName,
  SlotProgress,
  SlotState,
} from '../../../src/domain/types';

describe('contract slots', () => {
  it('test_slot_order_is_the_persisted_rng_schema', () => {
    expect(SLOT_NAMES, '슬롯 재정렬은 RNG와 저장 재구성을 바꾸는 스키마 변경이다').toEqual([
      'kind',
      'target',
      'scale',
      'place',
      'deadline',
      'route',
      'weakness',
    ]);
  });

  it('test_slot_vocabulary_and_state_types_are_closed', () => {
    expectTypeOf<SlotName>().toEqualTypeOf<
      'kind' | 'target' | 'scale' | 'place' | 'deadline' | 'route' | 'weakness'
    >();
    expectTypeOf<Reach>().toEqualTypeOf<'none' | 'vague' | 'certain'>();
    expectTypeOf<SlotState>().toEqualTypeOf<'unknown' | 'blocked' | 'vague' | 'certain'>();
    expectTypeOf<Limiter>().toEqualTypeOf<'knowledge' | 'disclosure'>();
    expectTypeOf<SheetMark>().toEqualTypeOf<'confirmed' | 'ambiguous' | 'unfilled'>();
  });

  it('test_limiter_only_exists_on_blocked_progress', () => {
    const blocked: SlotProgress = { state: 'blocked', limiter: 'knowledge' };
    expect(blocked.limiter).toBe('knowledge');

    // @ts-expect-error blocked progress requires its limiter
    const missingLimiter: SlotProgress = { state: 'blocked' };
    // @ts-expect-error non-blocked progress cannot carry a limiter
    const invalidLimiter: SlotProgress = { state: 'certain', limiter: 'disclosure' };
    expect([missingLimiter, invalidLimiter]).toHaveLength(2);
  });

  it('test_five_stored_states_survive_json_round_trip', () => {
    const stored: readonly SlotProgress[] = [
      { state: 'unknown' },
      { state: 'blocked', limiter: 'knowledge' },
      { state: 'blocked', limiter: 'disclosure' },
      { state: 'vague' },
      { state: 'certain' },
    ];

    const restored = JSON.parse(JSON.stringify(stored)) as SlotProgress[];
    expect(restored).toEqual(stored);
    expect(new Set(restored.map((value) => JSON.stringify(value))).size).toBe(5);
  });

  it('test_sheet_marks_are_one_way_collapsed_views', () => {
    expect(sheetMark({ state: 'unknown' })).toBe('unfilled');
    expect(sheetMark({ state: 'blocked', limiter: 'knowledge' })).toBe('unfilled');
    expect(sheetMark({ state: 'blocked', limiter: 'disclosure' })).toBe('unfilled');
    expect(sheetMark({ state: 'vague' })).toBe('ambiguous');
    expect(sheetMark({ state: 'certain' })).toBe('confirmed');
  });

  it('test_missing_progress_is_unknown_without_being_stored', () => {
    const progress = new Map<string, SlotProgress>();

    expect(slotProgressKey('ct-7', 'weakness')).toBe('ct-7:weakness');
    expect(slotProgressOf(progress, 'ct-7', 'weakness')).toEqual({ state: 'unknown' });
    expect(progress.size).toBe(0);
  });
});
