# Story 006: 서술 텍스트 조립 (템플릿 엔진)

> **Day**: 1 | **Status**: Ready | **Layer**: Core | **Type**: Logic
> **Estimate**: 1h
> **Spec**: 인라인 정의. 제약 근거는 `design/gdd/game-concept.md` Scope Risks
> **ADR**: N/A — 3일 마감으로 ADR 파이프라인 생략

## Context

**3일 프로젝트 1순위 킬러에 대한 유일한 방어선이다** — 대화 콘텐츠 작성량 폭발.

`.claude/docs/technical-preferences.md`의 Forbidden Patterns에 명시되어 있다:
*"산문 대화 하드코딩 금지. `{이름}은 {감정}하며 {행동}했다` 형태의 템플릿 조립만
사용한다."* 이 스토리를 먼저 만들어 두면 이후 스토리들이 문장을 손으로 쓸 유혹을
구조적으로 차단당한다.

## Acceptance Criteria

- [ ] `render(template, vars)`가 `{key}` 자리표시자를 치환한다
- [ ] 값이 없는 자리표시자가 있으면 **던진다** — 조용히 빈 문자열로 두지 않는다
- [ ] 템플릿 문자열은 코드가 아니라 데이터 파일(`src/data/text.json`)에 있다
- [ ] 같은 상황에 여러 변형이 있으면 `rng`로 하나를 고른다 (결정론 유지)
- [ ] 성격 태그(`Trait`)로 어휘 집합을 고른다 — `bitter`와 `boastful`이 같은 문장을 쓰지 않는다
- [ ] 최소 상황 4종을 지원한다: 파견 결과 / 소문 전달 / 협상 반박 / 영입 인사

## Implementation Notes

- 파일: `src/domain/text.ts` + `src/data/text.json`
- 구현은 **의도적으로 원시적으로** 한다. 정규식 치환 한 줄이면 된다. 템플릿 엔진을
  만들려 들면 그 자체가 스코프 폭발이다
- 빈 값에 던지는 규칙이 중요하다. 조용히 넘어가면 화면에 `{name}은 했다` 같은 것이
  나가고, 심사 중에 발견된다
- 어휘 집합 예시 (`text.json`):
  ```
  "resultDead": {
    "bitter":   ["{name}은 결국 돌아오지 않았다. 예상했던 일이다."],
    "boastful": ["{name}이 돌아오지 않았다. 믿기 어려운 일이다."],
    "default":  ["{name}은 돌아오지 않았다."]
  }
  ```

## Out of Scope

- 실제 문안 다듬기 — Day 3 폴리시(Story 017)
- 각 화면에서의 호출 — 해당 UI 스토리

## QA Test Cases

- **AC: 치환**
  - Given: `"{name}은 {emotion}했다"`, `{name: "카린", emotion: "분노"}`
  - Then: `"카린은 분노했다"`
- **AC: 누락 시 예외**
  - Given: `"{name}은 {emotion}했다"`, `{name: "카린"}`
  - Then: 예외를 던진다
  - Edge: 빈 문자열 값 `""`는 정상 치환으로 취급 (누락과 구분)
- **AC: 결정론**
  - Given: 변형 3개가 있는 템플릿, 시드 고정
  - When: 두 번 렌더
  - Then: 같은 변형이 선택된다
- **AC: 성격 분기**
  - Given: 동일 상황, `bitter`와 `boastful`
  - Then: 서로 다른 문자열이 나온다

## Test Evidence

`tests/unit/domain/text.test.ts`
**Status**: [ ] 미작성

## Dependencies

- Depends on: 없음
- Unlocks: Story 008, 009, 014
