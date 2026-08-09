# Story 003: 계약 협상 판정 (3축 burden/tolerance)

> **Day**: 1 | **Status**: Superseded | **Layer**: Feature | **Type**: Logic
> **Estimate**: 1.5h | **Last Updated**: 2026-08-08
> **Spec**: `design/quick-specs/contract-negotiation-2026-08-08.md` §3–4
> **ADR**: N/A — 3일 마감으로 ADR 파이프라인 생략

> **2026-08-09 전면 개정 영향** — 이 스토리는 3일 마감판의 as-built 기록이다.
> 본문은 당시 구현을 그대로 서술하며 수정하지 않는다.
>
> **폐기된 것**: **3축 전제 전체.** 흥정은 보상/위험 고지 2축이 된다. 구체적으로
> AC-1의 `burden`에서 `wAdvance × 선불비율` 항, `NegotiationAxis`의 `'advance'`와
> QA 케이스가 고정한 `contestedAxis === 'advance'` 지목, `Offer.advanceRatio`와
> Implementation Deviations 3번의 `advanceRatio ∈ [0,1]` 입력 검증이 전부 사라진다.
> 잔금 미지급이 함께 폐지되므로 선불 축의 페이오프도 없다 — 둘은 같이 서고 같이 눕는다.
> **대체·확장**: `production/roadmap.md` **P0**(선불 축 제거) 및 **P3**(근거 기반
> 협상 — 알아낸 사실을 근거로 들 때마다 요구 배율 상한이 오른다).
> 새 요구사항은 그쪽이 소유한다. `tolerance` 공식과 결정론 요구는 생존한다.

## Context

**필수 테스트 1번**(`technical-preferences.md`)이 이 시스템이다.

판정은 **완전히 결정론적**이어야 한다. 난수가 들어가면 정보가 흥정력이 되지 못하고,
그러면 이 게임의 핵심 원리가 무너진다.

## Acceptance Criteria

- [x] `burden = wReward × max(0, 보상배율 − 1) + wAdvance × 선불비율`
- [x] `tolerance = toleranceBase + wealthWeight×wealth + urgencyWeight×urgency − alternativePenalty(조건부) + disclosureBonus(조건부)`
- [x] `burden ≤ tolerance`면 타결
- [x] 같은 의뢰인 + 같은 제안이면 **항상 같은 결과** (난수 미개입)
- [x] `urgency`가 높으면 더 큰 `burden`을 수락한다
- [x] `hasAlternative`면 동일 조건에서 더 적은 `burden`만 수락한다
- [x] 위험 고지를 켜면 수용 범위가 `disclosureBonus`만큼 넓어진다
- [x] 1회차 거부 시 **기여도 최대 축**을 지목해 반환한다
- [x] `maxOffers`(2)회 거부되면 결렬
- [x] `hasAlternative` + 위험 고지 + 1회차 거부 → 반박 없이 즉시 결렬
- [x] 모든 노브가 `balance.json`의 `negotiation` 섹션에서 읽힌다

## Implementation Notes

- 파일: `src/domain/negotiation.ts`
- 순수 함수로 짤 것: `evaluateOffer(offer, client, disclosed, balance) → Result`
  난수도 상태도 받지 않는다. 테스트가 쉬워지고 결정론이 타입으로 보장된다
- 기여도 최대 축 판정: `burden`의 각 항을 계산해 가장 큰 항의 이름을 반환
- **위험 고지 축의 개폐 조건은 이 스토리 밖이다** (Story 011). 여기서는
  `disclosed: boolean`을 인자로 받기만 한다

## Out of Scope

- 위험 고지 축을 열지 말지 판정 (`revealedFacts` 조회) — Story 011
- 잔금 미지급 판정 — Story 012
- 창구 UI — Story 007

## QA Test Cases

- **AC: 결정론**
  - Given: 동일 client + 동일 offer
  - When: 100회 호출
  - Then: 결과가 전부 동일
- **AC: urgency 단조성**
  - Given: urgency 0.2인 의뢰인과 0.8인 의뢰인, 나머지 동일
  - When: 동일 offer
  - Then: urgency 0.8이 수락하는 burden 상한이 더 크다
  - Edge: urgency 0과 1
- **AC: hasAlternative 페널티**
  - Given: hasAlternative만 다른 두 의뢰인
  - Then: `true`인 쪽의 tolerance가 `alternativePenalty`만큼 작다
- **AC: 고지 보너스**
  - Given: 동일 조건, disclosed false/true
  - Then: tolerance 차이가 정확히 `disclosureBonus`
- **AC: 반박 축 지목**
  - Given: 보상배율 1.0 + 선불 0.9인 제안 (선불 기여도가 압도적)
  - Then: 지목된 축이 `'advance'`

## Test Evidence

`tests/unit/domain/negotiation.test.ts` — **필수 테스트 1번**. 테스트 25개, 전부 통과
(2026-08-08). 전체 스위트 89개 통과, `npx tsc --noEmit` 무경고.

**Status**: [x] 작성 완료 · 통과

## Implementation Deviations

스토리가 지목한 `src/domain/negotiation.ts` **한 파일만** 추가했다. 다른 파일은 손대지
않았고 `balance.json`도 그대로다 — `negotiation` 절의 노브 8개가 이미 전부 있었다.

1. **`disclosed`를 `Offer` 안에 넣었다.** Implementation Notes의 시그니처는
   `evaluateOffer(offer, client, disclosed, balance)`로 `disclosed`가 별도 인자였으나,
   `Offer.discloseRisk`로 옮겼다. 스펙이 "**세 축으로** 계약 조건을 제안한다"고 정의하는데
   그중 하나만 따로 떼면 타입이 설계를 반영하지 못한다. **개폐 판정이 Story 011의 몫이라는
   것은 그대로다** — 이 모듈은 이미 정해진 값을 받기만 하고, 켤 수 있는지는 묻지 않는다.
   대신 `offerNumber`가 인자로 추가됐다 (`maxOffers` 판정에 필요).

2. **`NegotiationClient`로 좁혔다.** `Client` 전체가 아니라
   `Pick<Client, 'wealth' | 'urgency' | 'hasAlternative'>`를 받는다. 판정이 읽는 것이
   그 셋뿐이므로 **"이름이나 성격은 흥정에 영향을 주지 않는다"가 타입으로 못박힌다.**

3. **입력 검증을 추가했다** (AC 밖). `offerNumber < 1`과 `advanceRatio ∉ [0,1]`이면
   던진다. 검증이 없으면 잘못된 선불 비율이 조용히 이상한 밸런스를 만들어내고, 그것은
   화면에서 버그로 보이지 않는다. 테스트 2개로 고정했다.

### 설계 판단: 동점 시 지목 축

`rewardBurden === advanceBurden`일 때 어느 축을 지목할지 스펙에 없다. **보상 축으로
고정**했다 — 결정론이 요구사항이므로 어느 쪽이든 고정되어야 하고, 보상이 기준축이라
반박이 덜 뜬금없다. `test_contested_axis_is_stable_when_contributions_tie`가 고정한다.

### 확인된 규칙 해석

"`hasAlternative` + 위험 고지 + 1회차 거부 → 즉시 결렬"은 **거부됐을 때만**의 규칙이다.
고지를 켠 제안이 수용 범위 안이면 정상 타결된다 (`disclosureBonus`가 오히려 계약을
살린다). 테스트 `test_disclosure_still_wins_the_deal_for_a_client_with_alternative`가
이 해석을 고정한다 — 뒤집히면 정직이 언제나 손해가 되어 Expression 축이 죽는다.

## Dependencies

- Depends on: Story 002
- Unlocks: Story 007, 011
