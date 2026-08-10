# Story P1-012: 주간 진행 — 세 의뢰인과 길드 홀 게시판

> **Phase**: P1 | **Status**: Implemented | **Layer**: Integration | **Type**: Logic/UI
> **GDD**: `design/gdd/game-concept.md`, `design/gdd/intake-system.md`, `design/gdd/assignment-dispatch.md`
> **Updated**: 2026-08-10

## Context

시간 단위는 하루가 아니라 **주**다. 한 주에는 새 의뢰인 3명을 순서대로 응대한 뒤 길드
홀 게시판에서 여러 의뢰를 파견한다. 파견 화면은 시간을 진행하지 않으며, 길드 홀의 주
마감 버튼만 전역 진행을 소유한다.

```text
주 시작
  → 새 의뢰인 1: 청취 → 보수 합의 → 위험도 날인
  → 새 의뢰인 2: 청취 → 보수 합의 → 위험도 날인
  → 새 의뢰인 3: 청취 → 보수 합의 → 위험도 날인
  → 길드 홀 게시판
      → 의뢰 선택 → 파견 인원 배정 → 길드 홀 복귀 (반복 가능)
  → 주 마감 → advanceWeek 1회 → 결과 큐 → 다음 주
```

## Acceptance Criteria

- [x] 캠페인은 8주이며 매주 새 의뢰인 3명이 결정론적으로 생성된다.
- [x] 세 의뢰인은 정해진 순서로 응대하고, 보수 합의 없이는 날인할 수 없다.
- [x] 세 의뢰를 모두 날인한 뒤에만 길드 홀로 넘어간다.
- [x] 날인·합의된 의뢰만 게시판에 나타난다.
- [x] 게시판에서 동시 파견 한도까지 여러 의뢰를 연속 배정할 수 있다.
- [x] 파견 화면에서는 주가 진행되지 않고 길드 홀로 돌아온다.
- [x] 미배정 의뢰는 다음 주 게시판에 남는다.
- [x] 주 진행은 길드 홀의 `onEndWeek` 경로에서 `advanceWeek()`를 정확히 한 번 호출한다.
- [x] 같은 주에 만료된 결과는 빠짐없이 순서대로 보여준다.
- [x] 8주차 마감에는 새 의뢰를 만들지 않고 결과 뒤 결산으로 간다.

## Test Evidence

- `tests/unit/domain/gameState.test.ts` — 8주 종료, 주당 3명, 미배정 이월, 종료 주 신규 생성 금지
- `tests/unit/presentation/intakeScreen.test.ts` — 질문 대화, 반복 반응, 보수 합의, 역제시, 날인
- `tests/unit/presentation/guildHallScreen.test.ts` — 게시판 파견과 주 마감 경계
- `tests/unit/presentation/dispatchScreen.test.ts` — 동시 파견 한도, 파견 후 주 미진행, 홀 복귀
- 2026-08-10 실제 브라우저 재생 — 3명 응대, 2건 동시 파견, 1건 이월, 결과 2건, 2주차 게시판 유지 확인
