# Story 007: 창구 화면 (의뢰 카드 + 3축 + 도장)

> **Day**: 1 | **Status**: Implemented — `/story-done` 대기 | **Layer**: Presentation | **Type**: UI
> **Estimate**: 2h | **Last Updated**: 2026-08-08
> **Spec**: `design/quick-specs/contract-negotiation-2026-08-08.md`
> **ADR**: N/A — 3일 마감으로 ADR 파이프라인 생략

## Context

플레이어가 이 게임을 처음 보는 화면이다. 심사위원이 5분 안에 재미를 느껴야 한다는
제약(컨셉 Market Risks)의 최전선.

**제약**: UI 프레임워크 도입 금지 (React/Vue/Svelte). 직접 DOM 조작.
CSS 클래스는 kebab-case. 상호작용 응답 100ms 이내.

## Acceptance Criteria

- [x] 열린 의뢰가 양피지 카드로 표시된다 — 의뢰인 이름, 의뢰 내용, **공개 위험도**, 기본 보상, 소요 일수, 파티 상한
- [x] 보상 배율과 선불 비율을 조작할 수 있다
- [x] 위험 고지는 토글이며, **조건 미충족 시 비활성이고 그 사유가 표시된다**
- [x] 제안 버튼을 누르면 `evaluateOffer` 결과가 반영된다
- [x] 거부 시 **지목된 축**이 의뢰인의 반박 문장으로 표시된다 (Story 006 템플릿 사용)
- [x] 2회 거부되면 결렬 — 의뢰 카드가 사라지고 **숨은 진실은 끝내 표시되지 않는다**
- [~] 타결 시 도장 연출 후 배정 화면(Story 008)으로 넘어간다
- [x] `capability` 숫자가 이 화면 어디에도 나타나지 않는다
- [x] 클릭에서 화면 반영까지 100ms 이내

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

`production/qa/evidence/counter-screen-evidence.md` — 실브라우저 확인 기록.
추가로 **자동 상호작용 테스트 18개** (`tests/unit/presentation/counterScreen.test.ts`,
happy-dom). 전체 스위트 193개 통과, `npx tsc --noEmit` 무경고.

**Status**: [x] 작성 완료 · 통과

## Implementation Deviations

### AC 8/9 — 도장 "연출"은 없다

타결 시 `계약 성립` 표시가 뜨고 축이 사라지며 `onSettled`가 호출된다. **애니메이션은
넣지 않았다** — Implementation Notes가 "Day 1에는 연출을 넣지 말고 동작만 맞춘다.
도장 애니메이션은 Story 017"이라고 지시한 대로다. 배정 화면 전환도 콜백까지만이며
받는 쪽은 Story 008이 만든다.

### 화면 모듈 규약을 여기서 세웠다

UI 프레임워크가 없으므로 규약을 코드로 정했다. 이후 화면들이 따른다:

1. `mount<이름>Screen(root, deps) => ScreenHandle` — `destroy()`가 리스너와 DOM을 정리
2. **리스너는 루트 하나에만** 걸고 `data-action`으로 위임한다. 카드마다 걸면 다시 그릴 때
   해제를 빠뜨려 새는 곳이 생긴다
3. 상태 변화는 전체 재렌더, **슬라이더 조작은 숫자 표시만 갱신** — 드래그 중 재렌더는
   슬라이더를 손에서 뺏는다
4. 바깥 세계(판정 게이트, 화면 전환)는 **주입받는다**. Story 011과 008이 채울 자리를
   `disclosureStatus` / `onSettled`로 비워 뒀다

### AC 밖 추가

1. **`GameState.offersMade`.** 제안 횟수를 화면이 아니라 세션 상태에 둔다. 화면에 두면
   창구를 나갔다 들어오는 것으로 **결렬 규칙을 우회**할 수 있고, `maxOffers` 2가
   흥정을 긴장시키는 전부다.
2. **잠긴 축은 제안에 싣지 않는다.** 초안이 켜져 있어도 `disclosureStatus`가 막으면
   `discloseRisk: false`로 보낸다. UI 상태를 규칙보다 믿으면 안 된다.
3. **`escapeHtml`.** 이름이 생성된 것이라 안전하다는 것은 *오늘의 사실*이지 구조적
   보장이 아니다. `names.json`을 늘리는 사람이 이 함수를 모를 수 있다.
4. **`balance.json`에 `offerRewardMin/Max`, `offerStep` 추가.** 부를 수 있는 상한이
   곧 욕심의 한계이므로 밸런스 값이다.

### 실브라우저에서 잡은 버그: 한국어 조사

최초 렌더가 *"니카 발더**이** 눈살을 찌푸렸다"* 를 냈다. `발더`는 받침이 없어 `가`여야
한다. **단위 테스트는 전부 통과하고 있었다** — 브라우저로 직접 보지 않았으면 심사에서
발견될 종류였다.

`render()`에 `{name|이/가}` 형태를 추가해 받침으로 조사를 고르게 했다. 숫자는 한자음
읽기를 따른다(87 → 팔십칠 → `은`, 82 → 팔십이 → `는`). `text.json`의 모든 조사를
이 형태로 바꿨고, `names.json` 168개 조합 전체를 테스트로 고정했다.

이것은 story-006의 "의도적으로 원시적으로" 원칙에 대한 **유일한 예외**다. 조건 분기나
반복은 여전히 없다 — 조사는 취향이 아니라 문법이라 회피할 방법이 없다.

## Dependencies

- Depends on: Story 003, 005, 006
- Unlocks: Story 008
