import { describe, expect, it } from "vitest";
import { gradeOf, type GradeThresholds } from "../../src/domain/types";
import balance from "../../src/data/balance.json";

const THRESHOLDS: GradeThresholds = balance.adventurer.gradeThresholds;

describe("gradeOf", () => {
  it("test_grade_below_steady_threshold_is_green", () => {
    // Arrange / Act
    const grade = gradeOf(THRESHOLDS.steady - 1, THRESHOLDS);

    // Assert
    expect(grade).toBe("green");
  });

  it("test_grade_at_each_threshold_promotes", () => {
    // 경계값이 곧 요점이므로 숫자를 직접 쓴다
    expect(gradeOf(THRESHOLDS.steady, THRESHOLDS)).toBe("steady");
    expect(gradeOf(THRESHOLDS.skilled, THRESHOLDS)).toBe("skilled");
    expect(gradeOf(THRESHOLDS.veteran, THRESHOLDS)).toBe("veteran");
  });

  it("test_grade_just_below_threshold_stays_lower", () => {
    expect(gradeOf(THRESHOLDS.skilled - 1, THRESHOLDS)).toBe("steady");
    expect(gradeOf(THRESHOLDS.veteran - 1, THRESHOLDS)).toBe("skilled");
  });

  it("test_grade_at_scale_extremes_does_not_fall_through", () => {
    expect(gradeOf(0, THRESHOLDS)).toBe("green");
    expect(gradeOf(100, THRESHOLDS)).toBe("veteran");
  });

  it("test_grade_uses_injected_thresholds_not_defaults", () => {
    // Arrange — 밸런싱 중 임계값을 갈아 끼우는 것이 실제 사용 사례다
    const strict: GradeThresholds = { steady: 50, skilled: 80, veteran: 95 };

    // Act / Assert — 기본값이었다면 skilled였을 값이 green이 된다
    expect(gradeOf(50, THRESHOLDS)).toBe("skilled");
    expect(gradeOf(50, strict)).toBe("steady");
    expect(gradeOf(30, strict)).toBe("green");
  });
});
