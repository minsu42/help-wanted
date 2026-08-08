# Story 005: 게임 상태 + 일일 진행 (15일)

> **Day**: 1 | **Status**: Ready | **Layer**: Feature | **Type**: Logic
> **Estimate**: 1h
> **Spec**: 인라인 정의 (별도 quick-spec 없음 — 3일 스코프 결정)
> **ADR**: N/A — 3일 마감으로 ADR 파이프라인 생략

## Context

세션 전체를 담는 그릇이다. **`WorldState`(진실)와 `PlayerKnowledge`(플레이어가 아는
것)를 분리해서 보관**하는 것이 이 스토리의 핵심 책임이며, 이 분리가 결과 대조
화면(Story 014)을 두 객체 렌더링으로 끝나게 만든다.

## Acceptance Criteria

- [ ] `GameState`가 다음을 보유한다: `day`, `reputation`, `funds`, `guildTier`,
      `roster`(월드 풀), `openContracts`, `activeDispatches`, `knowledge`(`PlayerKnowledge`), `rng`
- [ ] 시작값: `day = 1`, `reputation = economy.startingReputation`(10),
      `funds = economy.startingFunds`(200), `guildTier = 1`
- [ ] `advanceDay()`가 하루를 넘긴다 — 만료된 파견 판정 실행, 새 의뢰 생성, 홀 출석 갱신
- [ ] 열린 의뢰 수가 `guildTiers[guildTier-1].concurrentContracts`를 넘지 않는다
- [ ] `day > 15`가 되면 세션 종료 상태로 전이한다
- [ ] `injured` 모험가는 `injuredDays` 경과 후 `available`로 돌아온다
- [ ] `onMission` 모험가는 `durationDays` 경과 후 판정을 거쳐 상태가 바뀐다
- [ ] **같은 시드로 같은 입력을 넣으면 15일 전체가 동일하게 재현된다**

## Implementation Notes

- 파일: `src/domain/gameState.ts`
- `rng`를 `GameState` 안에 보관한다. 전역 싱글턴을 만들지 않는다 — 코딩 표준의
  "의존성 주입 우선" 요건이며, 시드 재현성의 전제다
- `advanceDay()`의 순서가 중요하다: **① 파견 만료 판정 → ② 부상 회복 → ③ 새 의뢰 생성
  → ④ 홀 출석 결정**. 판정을 먼저 해야 그날 돌아온 사람이 홀 출석 후보가 된다
- 15일 종료는 여기서 상태 전이만 하고 화면은 Story 016이 그린다

## Out of Scope

- 홀 출석자 결정 로직 — Story 010 (여기서는 호출만)
- 명성·자금 변동 — Story 012
- 엔딩 화면 — Story 016

## QA Test Cases

- **AC: 15일 재현성**
  - Given: 시드 1234, 아무 입력도 하지 않고 15번 `advanceDay()`
  - When: 두 번 실행
  - Then: 최종 `GameState`가 깊은 비교로 동일
- **AC: 동시 의뢰 상한**
  - Given: `guildTier = 1` (concurrentContracts 2)
  - When: 여러 날 진행
  - Then: `openContracts.length`가 항상 ≤ 2
  - Edge: 등급을 2로 올리면 다음 날부터 3까지 열린다
- **AC: 부상 회복**
  - Given: `injured` 상태이고 `injuredDays = 3`
  - When: 3일 경과
  - Then: `status === 'available'`
  - Edge: 2일 경과 시점에는 여전히 `injured`
- **AC: 사망 영구성**
  - Given: `dead` 상태
  - When: 15일 전체 진행
  - Then: 끝까지 `dead` — 어떤 경로로도 복귀하지 않는다

## Test Evidence

`tests/unit/domain/gameState.test.ts`
**Status**: [ ] 미작성

## Dependencies

- Depends on: Story 002, 004
- Unlocks: Story 007, 008, 010, 012
