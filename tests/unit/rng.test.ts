import { describe, expect, it } from "vitest";
import { createRng } from "../../src/domain/rng";

const SEED = 1234;
const OTHER_SEED = 5678;

describe("createRng", () => {
  it("test_same_seed_produces_same_sequence", () => {
    const a = createRng(SEED);
    const b = createRng(SEED);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("test_different_seed_produces_different_sequence", () => {
    const a = createRng(SEED);
    const b = createRng(OTHER_SEED);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it("test_next_stays_within_unit_interval", () => {
    const rng = createRng(SEED);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("test_int_stays_within_inclusive_bounds", () => {
    const rng = createRng(SEED);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.int(3, 7);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(7);
    }
  });

  it("test_int_with_equal_bounds_returns_that_value", () => {
    const rng = createRng(SEED);
    expect(rng.int(5, 5)).toBe(5);
  });

  it("test_int_with_inverted_bounds_throws", () => {
    const rng = createRng(SEED);
    expect(() => rng.int(7, 3)).toThrow();
  });

  it("test_range_stays_within_half_open_bounds", () => {
    const rng = createRng(SEED);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.range(0.2, 0.8);
      expect(value).toBeGreaterThanOrEqual(0.2);
      expect(value).toBeLessThan(0.8);
    }
  });

  it("test_range_accepts_negative_bounds", () => {
    // 위험도 흔들림이 ±riskSpread 형태로 이 경로를 쓴다
    const rng = createRng(SEED);
    for (let i = 0; i < 1000; i += 1) {
      const value = rng.range(-0.2, 0.2);
      expect(value).toBeGreaterThanOrEqual(-0.2);
      expect(value).toBeLessThan(0.2);
    }
  });

  it("test_range_with_equal_bounds_returns_that_value", () => {
    const rng = createRng(SEED);
    expect(rng.range(0.5, 0.5)).toBe(0.5);
  });

  it("test_range_with_inverted_bounds_throws", () => {
    const rng = createRng(SEED);
    expect(() => rng.range(0.8, 0.2)).toThrow();
  });

  it("test_chance_zero_never_true_and_one_always_true", () => {
    const rng = createRng(SEED);
    for (let i = 0; i < 100; i += 1) {
      expect(rng.chance(0)).toBe(false);
    }
    for (let i = 0; i < 100; i += 1) {
      expect(rng.chance(1)).toBe(true);
    }
  });

  it("test_pick_returns_member_of_input", () => {
    const rng = createRng(SEED);
    const items = ["가", "나", "다"] as const;
    for (let i = 0; i < 100; i += 1) {
      expect(items).toContain(rng.pick(items));
    }
  });

  it("test_pick_on_empty_array_throws", () => {
    const rng = createRng(SEED);
    expect(() => rng.pick([])).toThrow();
  });
});
