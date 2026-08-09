# Story 006: 서술 텍스트 조립 (템플릿 엔진)

> **Day**: 1 | **Status**: Complete | **Layer**: Core | **Type**: Logic
> **Estimate**: 1h | **Last Updated**: 2026-08-08
> **Spec**: 인라인 정의. 제약 근거는 `design/gdd/game-concept.md` Scope Risks
> **ADR**: N/A — 3일 마감으로 ADR 파이프라인 생략

## Context

**3일 프로젝트 1순위 킬러에 대한 유일한 방어선이다** — 대화 콘텐츠 작성량 폭발.

`.claude/docs/technical-preferences.md`의 Forbidden Patterns에 명시되어 있다:
*"산문 대화 하드코딩 금지. `{이름}은 {감정}하며 {행동}했다` 형태의 템플릿 조립만
사용한다."* 이 스토리를 먼저 만들어 두면 이후 스토리들이 문장을 손으로 쓸 유혹을
구조적으로 차단당한다.

## Acceptance Criteria

- [x] `render(template, vars)`가 `{key}` 자리표시자를 치환한다
- [x] 값이 없는 자리표시자가 있으면 **던진다** — 조용히 빈 문자열로 두지 않는다
- [x] 템플릿 문자열은 코드가 아니라 데이터 파일(`src/data/text.json`)에 있다
- [x] 같은 상황에 여러 변형이 있으면 `rng`로 하나를 고른다 (결정론 유지)
- [x] 성격 태그(`Trait`)로 어휘 집합을 고른다 — `bitter`와 `boastful`이 같은 문장을 쓰지 않는다
- [x] 최소 상황 4종을 지원한다: 파견 결과 / 소문 전달 / 협상 반박 / 영입 인사

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

`tests/unit/domain/text.test.ts` — 테스트 24개, 전부 통과 (2026-08-08).
전체 스위트 167개 통과, `npx tsc --noEmit` 무경고.

**Status**: [x] 작성 완료 · 통과

## Implementation Deviations

### AC 밖 추가: `_vars` 사전 검사

`text.json`의 각 상황이 `_vars`로 필요한 자리표시자를 **미리 선언**하고, `narrate`는
문장을 고르기 **전에** 그것을 검사한다. AC는 "값이 없으면 던진다"만 요구하지만,
그것만으로는 **어떤 시드에서만 터지는** 형태가 된다 — 변형 A는 `{risk}`를 쓰고 변형 B는
안 쓰면, `risk`를 빠뜨렸을 때 A가 뽑힌 시드에서만 실패한다. 심사 중에 발견될 종류의
버그이므로 실패를 시드와 무관하게 만들었다.
`test_missing_required_var_throws_regardless_of_seed`가 시드 30개로 고정한다.

### 상황 9종을 넣었다 (AC 최소 4종)

`resultSuccess` / `resultInjured` / `resultDead` / `lostComrade` / `rumorTold` /
`rumorRefused` / `counterReward` / `counterAdvance` / `recruitGreeting`.

`counterReward`와 `counterAdvance`를 나눈 이유: story-003의 `contestedAxis`가 이미
두 축을 구분해 반환하므로, 문안도 그 구조를 그대로 받는 것이 호출부를 단순하게 만든다.

> **2026-08-09 개정 — `counterAdvance`는 삭제됐다.** 선불 축이 폐기되면서
> (`production/roadmap.md` P0 항목 1) `contestedAxis`가 구분할 축이 하나뿐이 됐다.
> 위 근거는 축이 둘일 때만 성립했으므로 함께 소멸한다. **분리 자체가 틀렸던 것은
> 아니다** — 축의 수를 문안 구조가 따라간다는 원칙은 유효하고, 로드맵 P3의
> 「근거 기반 협상」이 축을 다시 늘리면 같은 방식으로 되살아난다.

### 어휘는 LLM으로 생성해 정적 테이블로 구웠다

문장을 손으로 쓰지 않았고, 런타임 의존성도 0을 유지한다. `names.json`을 14×12 조합으로
만든 것과 같은 발상을 어휘로 확장한 것이다. 제출물 4번(AI 활용 내역)의 재료가 된다.

> ~~**런타임 LLM 호출은 story-019 이후로 미뤘다.** 근거와 적용 지점은
> `docs/tech-debt-register.md`의 Deferred 절에 있다 — 결과 대조 화면(story-014)
> 한 곳에만, 배포 스모크가 끝난 뒤에 얹는다.~~
>
> **2026-08-09 — WONTFIX로 종결. 이월이 아니다.**
> `design/gdd/game-concept.md`의 「넘을 수 없는 제약」 1번이 **외부 API 호출 채널
> 자체를 막았다.** GitHub Pages 정적 호스팅이라 서버가 없고, 키를 클라이언트에
> 두는 것은 선택지가 아니다. 프록시(Cloudflare Worker 등)를 세우는 것은 미룬 일을
> 하는 것이 아니라 **배포 아키텍처를 바꾸는 일**이다.
>
> 부채로 남겨두면 "언젠가 할 일"의 자리를 계속 차지한다. 되살릴 조건은 하나뿐이다:
> 정적 호스팅 제약이 폐기될 때. 그때는 부채 상환이 아니라 새 결정이다.
>
> **빌드 타임 LLM 어휘 생성은 그대로 유지된다** — 위 절이 설명하는 방식이 이
> 프로젝트의 정답이며, 제출물 4번(AI 활용 내역)의 재료도 그쪽이다.
>
> **2026-08-10 — WONTFIX 번복 (ADR-003).** 위에 적힌 유일한 해제 조건이 사용자
> 결정으로 충족됐다 — 게임 본체는 Pages에 남되, "배포 아키텍처를 바꾸는 일"이
> 실제로 일어났다(전용 Cloudflare Worker 프록시). 런타임 LLM이 대사 생성의
> **본선**이 되고, **이 story의 템플릿 조립은 삭제가 아니라 장애 폴백으로
> 강등·존속한다** (ADR-003 D5 — 프록시가 죽어도 완주 가능해야 한다). 빌드 타임
> 어휘 생성도 그대로 유효하다. 근거: `docs/architecture/adr-003-runtime-llm-and-proxy.md`.

### 데이터 무결성 테스트 8개

엔진만 테스트하면 `text.json`의 오타를 못 잡는다. 데이터 자체를 검사한다:
미선언 자리표시자 사용, `default` 누락, 알 수 없는 태그 키(영원히 안 뽑히는 죽은 어휘),
같은 어휘 집합 내 중복 문장, 그리고 **6개 성격 × 9개 상황 전 조합이 실제로 렌더되고
치환되지 않은 `{}`가 남지 않는지**를 확인한다.

### 테스트 작성 중 발견

`test_variants_actually_vary_across_seeds`를 처음엔 `resultDead.loyal`로 짰는데 그
어휘 집합은 문안이 하나뿐이라 당연히 실패했다. 문안 하나인 집합도 정상이므로(희귀한
결의 어휘) 여럿인 곳을 대상으로 바꾸고, 전제부터 단언하도록 고쳤다.

## Dependencies

- Depends on: 없음
- Unlocks: Story 008, 009, 014
