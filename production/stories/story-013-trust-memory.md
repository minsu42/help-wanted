# Story 013: 신뢰·기억 갱신 (파견 결과 → trust / Memory)

> **Day**: 2 | **Status**: Ready | **Layer**: Feature | **Type**: Integration
> **Estimate**: 1h
> **Spec**: `design/quick-specs/dispatch-resolution-2026-08-08.md` §5,
> `design/quick-specs/rumor-network-2026-08-08.md` §6
> **ADR**: N/A — 3일 마감으로 ADR 파이프라인 생략

## Context

**착취가 정보망을 스스로 조이게 만드는 회로다.** MDA의 Expression 축("정직한 중개인이
될지 착취자가 될지")을 지탱하는 유일한 기계적 장치이며, 이것이 없으면 관대할 이유가
게임 안에 존재하지 않게 된다.

## Acceptance Criteria

- [ ] 파견 결과에 따라 `trust`가 갱신된다: 생존 `+0.05`, 부상 `−0.10`, 사망 `−0.15`(생존 길드원 전체에게)
- [ ] **`knewRiskButConcealed`인 계약에서 사망이 나면 `−0.35`**가 추가 적용된다
- [ ] `trust`는 0~1 범위로 클램프된다
- [ ] `Memory`가 기록된다:
      파티 전원에게 `sentToDanger` 또는 `sentSafe`(공개 위험도 기준),
      결과에 따라 `survived` / `wounded`,
      생존자 전원에게 `lostComrade`(`subjectId` = 사망자),
      침묵했으면 `wasDeceived`
- [ ] `Memory`는 덧붙이기만 하고 지우지 않는다
- [ ] 신뢰가 임계값 아래로 내려간 사람은 다음 날부터 소문을 말하지 않는다 (Story 009와 연결)
- [ ] 사망자 본인에게는 `Memory`를 기록하지 않는다

## Implementation Notes

- 파일: `src/domain/reputation.ts` 또는 `dispatch.ts`의 후처리 단계
- **파견 판정(Story 004)은 순수 함수로 유지한다.** 이 스토리는 그 결과를 받아 상태를
  바꾸는 별도 단계다. 섞으면 판정 테스트가 어려워진다
- 침묵 페널티(`−0.35`)가 다른 모든 변동보다 큰 것이 의도다. 한 번의 은폐가 정보망
  전체를 눈에 띄게 조인다
- `Memory`는 지금은 결과 대조 화면(Story 014)과 서술 텍스트만 소비한다. 과하게 만들지
  말 것 — 필드가 늘면 소비처 없이 죽는다

## Out of Scope

- 결과 대조 화면 렌더 — Story 014
- 소문 판정에서의 신뢰 사용 — Story 009 (완료 가정)

## QA Test Cases

- **AC: 침묵 페널티가 가장 크다**
  - Given: 동일한 사망 사건, `knewRiskButConcealed` true / false
  - Then: true 쪽의 `trust` 하락폭이 유의하게 크다 (−0.50 vs −0.15)
- **AC: 클램프**
  - Given: `trust` 0.1에서 침묵 후 사망 (−0.50)
  - Then: `trust === 0` (음수 아님)
  - Edge: `trust` 0.98에서 생존 (+0.05) → 1.0
- **AC: 동료 상실 기록**
  - Given: 3인 파티에서 1명 사망
  - Then: 생존 2명에게 `lostComrade`가 기록되고 `subjectId`가 사망자 id
  - Edge: 1인 파티에서 사망 시 `lostComrade`가 아무에게도 안 남는다
- **AC: 사망자 기록 없음**
  - Then: 사망자의 `memories`에 결과 관련 항목이 추가되지 않는다
- **AC: 신뢰 하락이 소문을 막는다**
  - Given: `cautious`(임계 0.6)이고 `trust` 0.65인 인물
  - When: 침묵 후 사망으로 `trust`가 0.15로 하락
  - Then: 다음 날 대화에서 사실을 말하지 않는다

## Test Evidence

`tests/integration/trustMemory.test.ts`
**Status**: [ ] 미작성

## Dependencies

- Depends on: Story 004, 009, 011
- Unlocks: Story 014
