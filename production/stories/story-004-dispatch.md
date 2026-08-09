# Story 004: 파견 판정 (마진 반비례 무작위)

> **Day**: 1 | **Status**: Superseded | **Layer**: Feature | **Type**: Logic
> **Estimate**: 1.5h | **Last Updated**: 2026-08-08
> **Spec**: `design/quick-specs/dispatch-resolution-2026-08-08.md` §2–3
> **ADR**: N/A — 3일 마감으로 ADR 파이프라인 생략

> **2026-08-09 전면 개정 영향** — 이 스토리는 3일 마감판의 as-built 기록이다.
> 본문은 당시 구현을 그대로 서술하며 수정하지 않는다.
>
> **폐기된 것**: `DispatchTarget = Pick<Contract, 'realRisk'>` — 즉 파견 판정이
> `statedRisk`를 보지 못하게 **타입으로 막은** 것.
> ⚠ **이것은 실수가 아니라 논증된 결정을 뒤집는 것이다.** Implementation Deviations
> 2번이 *"`statedRisk`가 의도적으로 빠져 있어 결과 판정이 공개 위험도에 손댈 수 없다 —
> 그 비대칭이 '내가 알고도 보냈다'는 문장을 성립시키므로 타입으로 지켰다"* 고 근거를
> 남겼다. 신설된 **기둥 6**(*"내가 쓴 것이 사람을 죽인다"*)이 정확히 그 반대를
> 요구한다 — 모험가는 **의뢰서에 적힌 것**을 보고 준비하므로, 플레이어가 적은 위험도가
> 판정에 개입해야 한다. 뒤집는 이유는 원래 결정이 틀려서가 아니라 **책임의 소재가
> 옮겨갔기 때문**이다: 3일 판에서는 "알고도 보냈다"가 머릿속 사실이었고, 이제는
> 종이에 적힌 문서다.
> **대체·확장**: `production/roadmap.md` **P2**(의뢰서 → 파견 판정 연동. 빈 슬롯이
> 추정 오차 폭을 키우고, 특이사항 토큰이 준비 시간과 위험 상쇄에 영향).
> 새 요구사항은 그쪽이 소유한다. 판정 공식(마진 반비례 무작위), 양 끝 확정 구간,
> 사상자 편향은 전부 생존한다.

## Context

**필수 테스트 2번**(`technical-preferences.md`)이 이 시스템이다. 사람이 죽는 곳이고,
MVP 핵심 가설이 검증되는 곳이다.

핵심은 **양 끝에 확정 구간이 있고 가운데만 도박**이라는 것. 그래야 죽음이 납득된다.

## Acceptance Criteria

- [x] `ratio = Σ(파티원 capability) / 실제 위험도`
- [x] `uncertainty = max(0, maxUncertainty × (1 − |ratio−1| / certaintyBand))`
- [x] `effective = ratio + rng.range(−uncertainty, +uncertainty)`
- [x] `effective ≥ successRatio` → `'success'` / `≥ injuryRatio` → `'injured'` / 그 외 `'dead'`
- [x] `ratio ≥ 1 + certaintyBand`이면 **항상** `'success'`
- [x] `ratio ≤ 1 − certaintyBand`이면 **항상** `'dead'`
- [x] `ratio == 1.0`에서 `'dead'`가 나오지 않는다
- [x] 사상자는 `1 / capability^casualtyBias` 가중으로 1명 선택된다
- [x] 같은 시드 + 같은 파티 + 같은 의뢰면 항상 같은 결과
- [x] 판정 근거(`ratio`, `uncertainty`, 실제 위험도, 파티 역량 합)를 결과 객체에 담아 반환한다
- [x] 모든 노브가 `balance.json`의 `dispatch` 섹션에서 읽힌다

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

`tests/unit/domain/dispatch.test.ts` — **필수 테스트 2번**. 테스트 24개, 전부 통과
(2026-08-08). 전체 스위트 113개 통과, `npx tsc --noEmit` 무경고.

**Status**: [x] 작성 완료 · 통과

## Implementation Deviations

1. **`src/domain/weighted.ts` 신설.** 사상자 선택(`1/역량^bias`)이 의뢰 생성의
   `knownBy` 추출(`근속^1.5`)과 같은 누적합 가중 추출이다. 10줄짜리지만 **복사해 두면
   조용히 갈라진다** — 확률 코드의 미묘한 차이는 테스트가 통과하는 채로 분포만
   어긋나므로 눈에 띄지 않는다. `contract.ts`의 비공개 함수를 여기로 옮기고 양쪽이
   공유한다. `contract.ts` 테스트 30개 전부 여전히 통과.

2. **`DispatchTarget`으로 입력을 좁혔다.** `Contract` 전체가 아니라
   `Pick<Contract, 'realRisk'>`를 받는다. `statedRisk`가 **의도적으로 빠져 있어**
   결과 판정이 공개 위험도에 손댈 수 없다 — 그 비대칭이 "내가 알고도 보냈다"는 문장을
   성립시키므로 타입으로 지켰다. (story-003의 `NegotiationClient`와 같은 방식.)

3. **입력 검증 추가** (AC 밖): 빈 파티, 실제 위험도 ≤ 0, 역량 ≤ 0이면 던진다.
   특히 역량 0은 사상자 가중치 `1/0^1.5 = Infinity`가 되어 추출 분포를 조용히
   망가뜨리므로 크게 터뜨린다. 테스트 3개로 고정.

### 확인된 거동: 확정 구간의 부동소수 잔차

`ratio`가 정확히 `1 ± certaintyBand`일 때 `uncertainty`가 비트 단위 0이 아니라
약 5.6e-17이 나온다 (`distance / certaintyBand`가 1.0000000000000002가 되기 때문).

**결과에는 영향이 없다.** 상단 경계는 ratio 1.4이고 성공 임계선이 1.0이라 1e-17의
흔들림으로는 넘어갈 수 없고, 하단도 0.6 vs 0.75로 마찬가지다. AC가 보장하는 것은
"항상 성공/사망"이고 그것은 100시드 × 2경계로 검증됐다. 테스트는 `toBeCloseTo(0, 12)`로
잔차를 허용한다 — 임계값 스냅을 넣으면 근거 없는 엡실론 상수가 생기고, 얻는 것은
없다.

### 범위 밖으로 남긴 것 (스토리 명시대로)

상태 전이(`onMission`/`injured`/`dead`), `trust`·`Memory` 갱신, 자금·명성 반영,
배정 거부 규칙(`goal === 'survival'`)은 전부 호출자와 후속 스토리의 몫이다.
`resolveDispatch`는 순수 함수로 남겼다.

## Dependencies

- Depends on: Story 001, 002
- Unlocks: Story 008, 012, 013, 014
