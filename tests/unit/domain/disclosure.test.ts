import { describe, expect, it } from "vitest";
import {
  canDisclose,
  concealedKnownRisk,
  type DisclosureContract,
  type DisclosureKnowledge,
} from "../../../src/domain/negotiation";

/** 격차가 있는 기준 계약 — 실제(100) > 공개(70). 각 테스트가 필요한 값만 덮어쓴다. */
function contract(overrides: Partial<DisclosureContract> = {}): DisclosureContract {
  return { id: "contract-1", statedRisk: 70, realRisk: 100, ...overrides };
}

/** 사실을 아무것도 모르는 기준 지식. */
function knowledge(revealedFactIds: readonly string[] = []): DisclosureKnowledge {
  return { revealedFacts: new Set(revealedFactIds) };
}

/** `Fact.id` 규약 — `${contractId}:realRisk`. */
function realRiskFactId(contractId: string): string {
  return `${contractId}:realRisk`;
}

describe("canDisclose", () => {
  it("test_gate_opens_when_fact_known_and_real_risk_exceeds_stated", () => {
    // Arrange
    const target = contract();
    const known = knowledge([realRiskFactId(target.id)]);

    // Act
    const gate = canDisclose(target, known);

    // Assert
    expect(gate.allowed).toBe(true);
  });

  it("test_gate_closes_when_real_risk_equals_stated_despite_known_fact", () => {
    // Arrange — 격차가 0. 사실은 얻었지만 숨긴 것이 없다.
    const target = contract({ statedRisk: 70, realRisk: 70 });
    const known = knowledge([realRiskFactId(target.id)]);

    // Act
    const gate = canDisclose(target, known);

    // Assert
    expect(gate.allowed).toBe(false);
  });

  it("test_gate_closes_when_fact_is_unknown_despite_gap", () => {
    // Arrange — 격차는 있지만 아직 아무 소문도 못 들었다.
    const target = contract();
    const nothingKnown = knowledge();

    // Act
    const gate = canDisclose(target, nothingKnown);

    // Assert
    expect(gate.allowed).toBe(false);
  });

  it("test_gate_opens_regardless_of_how_distorted_the_heard_value_was", () => {
    // Arrange — 게이트는 사실 id를 얻었는지만 본다. `boastful`이 표시값을 얼마나
    // 비틀었는지는 협상 판정(다른 곳)의 문제이고, 여기서는 진짜 realRisk/statedRisk의
    // 격차만으로 판정한다는 것을 확인한다.
    const target = contract({ statedRisk: 10, realRisk: 90 });
    const known = knowledge([realRiskFactId(target.id)]);

    // Act
    const gate = canDisclose(target, known);

    // Assert
    expect(gate.allowed).toBe(true);
  });

  it("test_closed_reasons_differ_between_unknown_and_no_gap", () => {
    // Arrange
    const gapButUnknown = canDisclose(contract(), knowledge());
    const knownButNoGap = canDisclose(
      contract({ statedRisk: 70, realRisk: 70 }),
      knowledge([realRiskFactId("contract-1")]),
    );

    // Assert — 두 사유가 실제로 다른 코드여야 한다
    if (gapButUnknown.allowed) throw new Error("expected the gate to be closed");
    if (knownButNoGap.allowed) throw new Error("expected the gate to be closed");
    expect(gapButUnknown.reason).toBe("unknownRisk");
    expect(knownButNoGap.reason).toBe("noGap");
    expect(gapButUnknown.reason).not.toBe(knownButNoGap.reason);
  });

  it("test_honest_client_with_zero_concealment_keeps_gate_closed_even_when_fact_is_known", () => {
    // Arrange — concealment 0 → realRisk === statedRisk. 사실을 알아도 숨길 격차가 없다.
    const honest = contract({ statedRisk: 50, realRisk: 50 });
    const known = knowledge([realRiskFactId(honest.id)]);

    // Act
    const gate = canDisclose(honest, known);

    // Assert
    expect(gate).toEqual({ allowed: false, reason: "noGap" });
  });
});

describe("concealedKnownRisk", () => {
  it("test_marks_concealment_when_gate_was_open_and_settled_without_disclosing", () => {
    // Arrange
    const target = contract();
    const known = knowledge([realRiskFactId(target.id)]);

    // Act
    const marked = concealedKnownRisk(target, known, false);

    // Assert
    expect(marked).toBe(true);
  });

  it("test_does_not_mark_concealment_when_the_offer_disclosed_the_risk", () => {
    // Arrange
    const target = contract();
    const known = knowledge([realRiskFactId(target.id)]);

    // Act
    const marked = concealedKnownRisk(target, known, true);

    // Assert
    expect(marked).toBe(false);
  });

  it("test_does_not_mark_concealment_when_the_gate_never_opened", () => {
    // Arrange — 몰랐으니 속인 것이 아니다: 사실을 모른 채 타결해도 표식은 남지 않는다.
    const target = contract();
    const nothingKnown = knowledge();

    // Act
    const marked = concealedKnownRisk(target, nothingKnown, false);

    // Assert
    expect(marked).toBe(false);
  });
});
