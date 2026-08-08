# Story 011: 위험 고지 축 연동 (revealedFacts → 협상)

> **Day**: 2 | **Status**: Ready | **Layer**: Feature | **Type**: Integration
> **Estimate**: 1h
> **Spec**: `design/quick-specs/contract-negotiation-2026-08-08.md` §2
> **ADR**: N/A — 3일 마감으로 ADR 파이프라인 생략

## Context

**"정보 = 흥정력"이 코드가 되는 지점이다.** 다른 두 축은 정보 없이도 조작할 수 있지만
(불리할 뿐), 위험 고지 축은 **정보 없이는 존재하지 않는다.**

작은 스토리지만 이 게임의 핵심 원리가 실제로 작동하는지가 여기서 갈린다.

## Acceptance Criteria

- [ ] 위험 고지 축은 다음 **두 조건이 모두** 참일 때만 열린다:
      ① `PlayerKnowledge.revealedFacts`에 `` `${contractId}:realRisk` ``가 있다
      ② **실제 위험도 > 공개 위험도**
- [ ] 조건 미충족 시 축이 비활성이고, **어느 조건이 미충족인지에 따라 다른 사유**가 표시된다
- [ ] 축을 켜면 `evaluateOffer`에 `disclosed = true`가 전달되어 tolerance가 `disclosureBonus`만큼 넓어진다
- [ ] 왜곡된 값을 받았어도 축은 열린다 (게이트는 획득 여부로만 판정)
- [ ] 은폐폭이 0인 정직한 의뢰인의 의뢰에서는, 사실을 알아도 축이 열리지 않는다
- [ ] 실제 위험을 **알고도 고지하지 않은** 계약에 표식을 남긴다 (Story 013의 `wasDeceived` 판정용)

## Implementation Notes

- 파일: `src/domain/negotiation.ts`에 `canDisclose(contract, knowledge)` 추가
- **두 사유를 구분해서 보여주는 것이 중요하다:**
  - 정보 없음 → *"이 의뢰의 실제 위험을 모른다"* → 소문을 캐러 가라는 신호
  - 실제 ≤ 공개 → *"들은 그대로다. 더 요구할 근거가 없다"* → **이것도 정보다.**
    안심하고 진행해도 된다는 뜻이며, 정직한 의뢰인이 섞여 있다는 사실을 가르친다
- 침묵 표식은 계약 객체에 `knewRiskButConcealed: boolean`으로 남긴다. 파견 결과에서
  사망이 나면 이 표식이 `trust` 대폭 하락을 발동시킨다

## Out of Scope

- `trust` 하락 실행 — Story 013
- 협상 공식 자체 — Story 003 (완료 가정)

## QA Test Cases

- **AC: 두 조건 모두 필요**
  - Given: 사실 있음 + 실제(100) > 공개(70)
  - Then: 축이 열린다
  - Given: 사실 있음 + 실제(70) == 공개(70)
  - Then: 축이 **닫힌다**
  - Given: 사실 없음 + 실제 > 공개
  - Then: 축이 닫힌다
- **AC: 왜곡 무관**
  - Given: `boastful`에게서 얻어 표시값이 실제보다 낮음
  - Then: 축은 여전히 열린다
- **AC: 사유 구분**
  - Given: 위 두 가지 닫힘 케이스
  - Then: 반환되는 사유 코드가 서로 다르다
- **AC: 침묵 표식**
  - Given: 축이 열려 있는데 고지하지 않고 타결
  - Then: 계약에 `knewRiskButConcealed === true`
  - Edge: 축이 안 열린 상태로 타결하면 `false` (몰랐으니 속인 것이 아니다)

## Test Evidence

`tests/unit/domain/disclosure.test.ts`
**Status**: [ ] 미작성

## Dependencies

- Depends on: Story 003, 009
- Unlocks: Story 013
