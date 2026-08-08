# Story 004: 파견 판정 (마진 반비례 무작위)

> **Day**: 1 | **Status**: Ready | **Layer**: Feature | **Type**: Logic
> **Estimate**: 1.5h
> **Spec**: `design/quick-specs/dispatch-resolution-2026-08-08.md` §2–3
> **ADR**: N/A — 3일 마감으로 ADR 파이프라인 생략

## Context

**필수 테스트 2번**(`technical-preferences.md`)이 이 시스템이다. 사람이 죽는 곳이고,
MVP 핵심 가설이 검증되는 곳이다.

핵심은 **양 끝에 확정 구간이 있고 가운데만 도박**이라는 것. 그래야 죽음이 납득된다.

## Acceptance Criteria

- [ ] `ratio = Σ(파티원 capability) / 실제 위험도`
- [ ] `uncertainty = max(0, maxUncertainty × (1 − |ratio−1| / certaintyBand))`
- [ ] `effective = ratio + rng.range(−uncertainty, +uncertainty)`
- [ ] `effective ≥ successRatio` → `'success'` / `≥ injuryRatio` → `'injured'` / 그 외 `'dead'`
- [ ] `ratio ≥ 1 + certaintyBand`이면 **항상** `'success'`
- [ ] `ratio ≤ 1 − certaintyBand`이면 **항상** `'dead'`
- [ ] `ratio == 1.0`에서 `'dead'`가 나오지 않는다
- [ ] 사상자는 `1 / capability^casualtyBias` 가중으로 1명 선택된다
- [ ] 같은 시드 + 같은 파티 + 같은 의뢰면 항상 같은 결과
- [ ] 판정 근거(`ratio`, `uncertainty`, 실제 위험도, 파티 역량 합)를 결과 객체에 담아 반환한다
- [ ] 모든 노브가 `balance.json`의 `dispatch` 섹션에서 읽힌다

## Implementation Notes

- 파일: `src/domain/dispatch.ts` — `resolveDispatch(party, contract, rng, balance) → DispatchResult`
- **결과 객체에 `ratio`와 `uncertainty`를 반드시 담을 것.** 결과 대조 화면(Story 014)이
  "얼마나 아슬아슬했는지"를 보여주는 유일한 근거이며, 이것이 컨셉의 1순위 설계
  리스크("창발이 무작위처럼 느껴짐")에 대한 최종 방어선이다
- 상태 전이(`onMission`/`injured`/`dead`)는 이 함수가 직접 하지 말고 호출자가 결과를
  보고 적용한다. 순수 함수로 유지해야 테스트가 쉽다

## Out of Scope

- `trust`·`Memory` 갱신 — Story 013
- 자금·명성 반영 — Story 012
- 배정 거부 규칙(`goal === 'survival'` 등) — Story 008
- 결과 대조 화면 — Story 014

## QA Test Cases

- **AC: 상단 확정 구간**
  - Given: `ratio = 1.5` (certaintyBand 0.4)
  - When: 시드 100개로 시행
  - Then: 100회 전부 `'success'`
- **AC: 하단 확정 구간**
  - Given: `ratio = 0.55`
  - Then: 100회 전부 `'dead'`
- **AC: 동률에서 사망 없음**
  - Given: `ratio = 1.0`
  - When: 1000회 시행
  - Then: `'dead'`가 0회
- **AC: 사상자 편향**
  - Given: capability 20인 신입과 80인 베테랑 2인 파티, `'injured'` 결과
  - When: 1000회 시행
  - Then: 신입이 뽑힌 비율 > 50% (유의하게)
- **AC: 결정론**
  - Given: 동일 시드·파티·의뢰
  - Then: 결과와 `ratio`·`uncertainty`가 전부 동일

## Test Evidence

`tests/unit/domain/dispatch.test.ts` — **필수 테스트 2번**
**Status**: [ ] 미작성

## Dependencies

- Depends on: Story 001, 002
- Unlocks: Story 008, 012, 013, 014
