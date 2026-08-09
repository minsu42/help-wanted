# Story 005: 게임 상태 + 일일 진행 (15일)

> **Day**: 1 | **Status**: Superseded | **Layer**: Feature | **Type**: Logic
> **Estimate**: 1h | **Last Updated**: 2026-08-08
> **Spec**: 인라인 정의 (별도 quick-spec 없음 — 3일 스코프 결정)
> **ADR**: N/A — 3일 마감으로 ADR 파이프라인 생략

> **2026-08-09 전면 개정 영향** — 이 스토리는 3일 마감판의 as-built 기록이다.
> 본문은 당시 구현을 그대로 서술하며 수정하지 않는다.
>
> **폐기된 것**: **15일 고정 회차 전체** — 제목의 "(15일)", AC-5의 `day > 15` 하드
> 종료, AC-8의 "15일 전체가 동일하게 재현된다", Implementation Deviations 5번이 추가한
> `balance.json`의 `session.totalDays: 15`. 회차 길이는 시간이 아니라 **막 구조**에
> 종속된다. 함께 폐기: Implementation Deviations 2번의 `ActiveDispatch.advancePaid`와
> `receiveAdvance()` 배선 — 선불 축이 사라지면 실어 나를 값이 없다.
> **대체·확장**: `production/roadmap.md` **P0**(선불 제거, `totalDays`를 하드 종료가
> 아니라 막 전환 기준으로 바꿀 준비 — P7까지는 임시로 긴 값), **P3**(하루 마감 화면,
> 행동 횟수, 고정비 정산), **P7**(막 전환이 회차 길이를 정한다).
> 새 요구사항은 그쪽이 소유한다.
>
> ⚠ **여기서 결정되지 않은 것이 P1으로 간다** — `GameState`의 **지속성(세이브/로드)**.
> 3일 판에는 저장이 아예 없었고, 8~15시간 캠페인에서는 필수다. 저장 포맷은 스키마
> 변경에 물리므로 `Contract` 재설계와 같이 잡는다 (P1, `persistence-*.md`).

## Context

세션 전체를 담는 그릇이다. **`WorldState`(진실)와 `PlayerKnowledge`(플레이어가 아는
것)를 분리해서 보관**하는 것이 이 스토리의 핵심 책임이며, 이 분리가 결과 대조
화면(Story 014)을 두 객체 렌더링으로 끝나게 만든다.

## Acceptance Criteria

- [x] `GameState`가 다음을 보유한다: `day`, `reputation`, `funds`, `guildTier`,
      `roster`(월드 풀), `openContracts`, `activeDispatches`, `knowledge`(`PlayerKnowledge`), `rng`
- [x] 시작값: `day = 1`, `reputation = economy.startingReputation`(10),
      `funds = economy.startingFunds`(200), `guildTier = 1`
- [~] `advanceDay()`가 하루를 넘긴다 — 만료된 파견 판정 실행, 새 의뢰 생성, 홀 출석 갱신
- [x] 열린 의뢰 수가 `guildTiers[guildTier-1].concurrentContracts`를 넘지 않는다
- [x] `day > 15`가 되면 세션 종료 상태로 전이한다
- [x] `injured` 모험가는 `injuredDays` 경과 후 `available`로 돌아온다
- [x] `onMission` 모험가는 `durationDays` 경과 후 판정을 거쳐 상태가 바뀐다
- [x] **같은 시드로 같은 입력을 넣으면 15일 전체가 동일하게 재현된다**

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

`tests/unit/domain/gameState.test.ts` — 테스트 30개, 전부 통과 (2026-08-08).
전체 스위트 143개 통과, `npx tsc --noEmit` 무경고.

**Status**: [x] 작성 완료 · 통과

## Implementation Deviations

### AC 7/8 — 홀 출석 갱신은 미구현이다

`advanceDay()`의 세 단계 중 **① 파견 만료 판정과 ③ 새 의뢰 생성은 구현했고,
④ 홀 출석 갱신은 하지 않았다.** Out of Scope가 "홀 출석자 결정 로직 — Story 010
(여기서는 호출만)"이라고 적었으나, **호출할 함수가 아직 없다.** 없는 함수를 부르는
빈 껍데기를 만드는 대신 순서만 문서로 고정하고 자리를 비워 뒀다.

Story 010에서 `resolveHallAttendance(state, config)`를 만들어 `refillContracts` 뒤에
끼우면 된다. 그 자리를 `advanceDay`의 주석이 지목하고 있다. **`DayReport`에
`attendance` 필드를 추가하는 것이 그때 함께 필요하다.**

### 구조 판단: 이 모듈만 제자리에서 바꾼다

`negotiation.ts`와 `dispatch.ts`는 순수 함수인데 `gameState.ts`는 아니다. 의도적이다 —
`rng`가 이미 내부 상태를 들고 있어 `GameState`는 본질적으로 가변이고, 불변인 척하면
"복사본을 바꿨는데 원본이 그대로"인 버그만 생긴다. **판정은 순수하게(`dispatch.ts`),
적용은 제자리에서(`gameState.ts`)** — 그 경계를 파일 사이에 뒀다.

### AC 밖 추가

1. **`dispatchParty(state, contractId, partyIds, options)`.** AC에 없지만
   "`onMission` 모험가는 `durationDays` 경과 후..."가 성립하려면 누군가 `onMission`으로
   만들어야 한다. 상태 전이이므로 이 모듈이 맞다. **배정 거부 규칙(`goal === 'survival'`,
   낮은 `trust`)은 넣지 않았다** — Story 008의 몫이고, 호출자가 걸러서 넘긴다고 본다.

2. **`ActiveDispatch.advancePaid` / `concealedKnownRisk`.** 지금은 실어 나르기만 한다.
   전자는 Story 012(사망해도 선불은 남는다), 후자는 Story 013(침묵 후 사망의 `trust`
   하락폭)이 읽는다. 파견 시점에만 알 수 있는 값이라 여기서 받아 두지 않으면 나중에
   복원할 방법이 없다.

3. **`Adventurer.recoversOnDay?: number`** (`types.ts`). 부상자마다 회복일이 다르므로
   사람에 붙는 것이 맞다. 선택적 필드라 story-001 테스트 16개는 그대로 통과한다.

4. **`GuildTier` / `MutableKnowledge` 타입** (`types.ts`).
   `MutableKnowledge`는 `PlayerKnowledge`에 대입 가능하다 — `GameState`만 쓰기 가능한
   형태를 들고, 화면에는 읽기 전용으로 넘겨 UI가 실수로 "알아낸 것"을 늘리지 못하게 한다.

5. **`balance.json`에 `session.totalDays: 15` 추가.** 15일은 게임플레이 수치이므로
   AC-10 판정(story-001)에 따라 `balance.json`에 둔다.

### 자금·명성은 건드리지 않았다

Out of Scope대로 `DayReport`에 판정 결과만 실어 보낸다. Story 012가 그것을 읽어
반영한다. 여기서 함께 처리하면 `advanceDay`가 회차의 모든 규칙을 아는 신 함수가 된다.

### 테스트 작성 중 발견

`test_duplicate_party_member_throws`가 처음엔 "2인 의뢰가 없으면 `return`"으로 짜여
있었는데, **시작 명성 10에서는 `maxPartySize`가 거의 항상 1이라 단언 없이 통과하고
있었다.** 명성 90 설정으로 2인 의뢰를 확실히 만들고 전제 자체를 단언하도록 고쳤다.
조건이 안 맞으면 조용히 통과하는 테스트는 테스트가 아니다.

## Dependencies

- Depends on: Story 002, 004
- Unlocks: Story 007, 008, 010, 012
