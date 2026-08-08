# Story 007: 창구 화면 (의뢰 카드 + 3축 + 도장)

> **Day**: 1 | **Status**: Ready | **Layer**: Presentation | **Type**: UI
> **Estimate**: 2h
> **Spec**: `design/quick-specs/contract-negotiation-2026-08-08.md`
> **ADR**: N/A — 3일 마감으로 ADR 파이프라인 생략

## Context

플레이어가 이 게임을 처음 보는 화면이다. 심사위원이 5분 안에 재미를 느껴야 한다는
제약(컨셉 Market Risks)의 최전선.

**제약**: UI 프레임워크 도입 금지 (React/Vue/Svelte). 직접 DOM 조작.
CSS 클래스는 kebab-case. 상호작용 응답 100ms 이내.

## Acceptance Criteria

- [ ] 열린 의뢰가 양피지 카드로 표시된다 — 의뢰인 이름, 의뢰 내용, **공개 위험도**, 기본 보상, 소요 일수, 파티 상한
- [ ] 보상 배율과 선불 비율을 조작할 수 있다
- [ ] 위험 고지는 토글이며, **조건 미충족 시 비활성이고 그 사유가 표시된다**
- [ ] 제안 버튼을 누르면 `evaluateOffer` 결과가 반영된다
- [ ] 거부 시 **지목된 축**이 의뢰인의 반박 문장으로 표시된다 (Story 006 템플릿 사용)
- [ ] 2회 거부되면 결렬 — 의뢰 카드가 사라지고 **숨은 진실은 끝내 표시되지 않는다**
- [ ] 타결 시 도장 연출 후 배정 화면(Story 008)으로 넘어간다
- [ ] `capability` 숫자가 이 화면 어디에도 나타나지 않는다
- [ ] 클릭에서 화면 반영까지 100ms 이내

## Implementation Notes

- 파일: `src/presentation/ui/CounterScreen.ts`
- 비활성 사유 표시가 중요하다. 그냥 회색 버튼이면 플레이어는 버그로 읽는다.
  *"이 의뢰의 실제 위험을 모른다"* 라고 적어야 소문을 캐러 갈 이유가 생긴다 —
  **정보 = 흥정력을 UI가 가르치는 지점이다**
- 세피아 단색 + 붉은 봉랍색. **붉은색은 위험·사망·결렬에만** 쓴다
  (`src/presentation/styles/base.css`의 팔레트 사용)
- Day 1에는 연출을 넣지 말고 동작만 맞춘다. 도장 애니메이션은 Story 017

## Out of Scope

- 위험 고지 축의 개폐 판정 로직 — Story 011 (여기서는 boolean을 받아 렌더만)
- 길드 홀 — Story 010
- 시각 폴리시 — Story 017

## QA Test Cases

- **Manual: 비활성 사유 표시**
  - Setup: 소문을 얻지 않은 상태로 창구 진입
  - Verify: 위험 고지 토글이 비활성이고 사유 문구가 보인다
  - Pass: 사유가 한 문장으로 읽히고, 무엇을 하면 열리는지 유추 가능하다
- **Manual: 결렬 시 진실 은폐**
  - Setup: 과한 조건으로 2회 제안해 결렬시킨다
  - Verify: 화면 어디에도 실제 위험도/실제 지불 여력이 나타나지 않는다
  - Pass: DOM을 뒤져도 값이 없다 (렌더 자체를 안 해야 함)
- **Manual: capability 미노출**
  - Setup: 창구 화면 전체
  - Verify: 숫자로 된 역량치가 없다
  - Pass: 등급 문자열만 존재
- **Manual: 응답 속도**
  - Verify: 축 조작 → 화면 갱신이 즉각적으로 느껴진다
  - Pass: 체감 지연 없음 (DevTools로 100ms 이내 확인)

## Test Evidence

`production/qa/evidence/counter-screen-evidence.md` — 스크린샷 + 수동 확인 기록
**Status**: [ ] 미작성

## Dependencies

- Depends on: Story 003, 005, 006
- Unlocks: Story 008
