# Story 011: 위험 고지 축 연동 (revealedFacts → 협상)

> **Day**: 2 | **Status**: Superseded | **Layer**: Feature | **Type**: Integration
> **Estimate**: 1h
> **Spec**: `design/quick-specs/contract-negotiation-2026-08-08.md` §2
> **ADR**: N/A — 3일 마감으로 ADR 파이프라인 생략

> **2026-08-09 전면 개정 영향** — 이 스토리는 3일 마감판의 as-built 기록이다.
> 본문은 당시 구현을 그대로 서술하며 수정하지 않는다.
>
> **폐기된 것**: **게이트가 은폐 축 하나만 전제한다는 것.** AC-1의 두 조건
> (① `revealedFacts`에 `${contractId}:realRisk`가 있다 ② 실제 위험도 > 공개 위험도)은
> 격차가 **은폐 하나뿐**이고 그 격차가 **위험도라는 단일 숫자**일 때만 성립한다.
> 개정 후 격차는 은폐/무지 두 갈래이고, 고지의 대상도 위험도 한 값이 아니라 의뢰서의
> 여러 슬롯이다. 그리고 위험 고지는 독립된 축이 아니라 **여러 근거 중 하나**가 된다 —
> *"그곳은 당신이 적어 온 것보다 위험합니다"* 는 흥정 근거의 한 종류일 뿐이다.
> AC-2의 사유 코드 2종(`'unknownRisk'` / `'noGap'`)도 채널이 둘로 늘면 부족해진다.
> **대체·확장**: `production/roadmap.md` **P3**(근거 기반 협상 — 알아낸 사실의 개수가
> 곧 흥정력이 되고 고지가 그 안으로 흡수된다). 새 요구사항은 그쪽이 소유한다.
> `concealedKnownRisk` 침묵 표식과 그것이 신뢰 하락을 발동시키는 회로는 생존한다.

## Context

**"정보 = 흥정력"이 코드가 되는 지점이다.** 다른 두 축은 정보 없이도 조작할 수 있지만
(불리할 뿐), 위험 고지 축은 **정보 없이는 존재하지 않는다.**

작은 스토리지만 이 게임의 핵심 원리가 실제로 작동하는지가 여기서 갈린다.

## Acceptance Criteria

- [x] 위험 고지 축은 다음 **두 조건이 모두** 참일 때만 열린다:
      ① `PlayerKnowledge.revealedFacts`에 `` `${contractId}:realRisk` ``가 있다
      ② **실제 위험도 > 공개 위험도**
- [x] 조건 미충족 시 축이 비활성이고, **어느 조건이 미충족인지에 따라 다른 사유**가 표시된다
      (`canDisclose`가 `'unknownRisk'` | `'noGap'` 사유 코드를 반환한다. 실제 UI 표시
      문구 매핑은 프레젠테이션 계층 배선 — 이 스토리는 도메인 판정만 소유한다)
- [ ] 축을 켜면 `evaluateOffer`에 `disclosed = true`가 전달되어 tolerance가 `disclosureBonus`만큼 넓어진다
      — `evaluateOffer`의 이 동작 자체는 Story 003에서 이미 구현/검증됨
      (`test_disclosure_widens_tolerance_by_exactly_the_bonus`). 이 스토리는 `canDisclose`의
      결과를 실제로 `Offer.discloseRisk`에 배선하는 지점(`main.ts`/`CounterScreen.ts`)은
      건드리지 않았다 — 소유 파일 범위 밖이라 배선은 요청자에게 위임
- [x] 왜곡된 값을 받았어도 축은 열린다 (게이트는 획득 여부로만 판정)
- [x] 은폐폭이 0인 정직한 의뢰인의 의뢰에서는, 사실을 알아도 축이 열리지 않는다
- [x] 실제 위험을 **알고도 고지하지 않은** 계약에 표식을 남긴다 (Story 013의 `wasDeceived` 판정용)
      — `concealedKnownRisk` 순수 함수로 구현. `DispatchScreen.ts`가 같은 로직을
      인라인으로 이미 구현해 두었으나 격차 조건(②)을 검사하지 않는다 — 배선 시 이 함수로
      교체 권장 (보고서 참조)

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
**Status**: [x] 작성 완료 — 10개 테스트, 전부 통과
(`npx vitest run tests/unit/domain/disclosure.test.ts tests/unit/domain/negotiation.test.ts` → 34/34 통과, 기존 negotiation 테스트 무손상)

## Dependencies

- Depends on: Story 003, 009
- Unlocks: Story 013
