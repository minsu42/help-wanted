# Story 001: 월드 생성 — 모험가 22명 풀 + 길드 8명

> **Day**: 1 | **Status**: Complete | **Layer**: Core | **Type**: Logic
> **Estimate**: 2h | **Last Updated**: 2026-08-08
> **Spec**: `design/quick-specs/guild-scale-and-difficulty-2026-08-08.md` §3–4
> **ADR**: N/A — 3일 마감으로 ADR 파이프라인 생략 (`design/gdd/game-concept.md` Next Steps)

## Context

이 게임의 모든 사람이 여기서 태어난다. 병목 시스템이므로 스키마를 흔들면 소문·파견·
영입이 전부 흔들린다. `src/domain/types.ts`의 `Adventurer`가 계약이다.

**제약** (`.claude/docs/technical-preferences.md` Forbidden Patterns):
- `Math.random()` 직접 호출 금지 — `createRng(seed)` 주입
- 숫자 하드코딩 금지 — 전부 `src/data/balance.json`
- `capability`는 내부 전용. 화면에 나갈 때는 반드시 `gradeOf()` 통과

## Acceptance Criteria

- [x] `worldRosterSize`(22)명의 `Adventurer`를 생성한다
- [x] 그중 `startingGuildSize`(8)명이 `inGuild === true`, 나머지는 `false`
- [x] `capability`는 `capabilityMin`~`capabilityMax`(15~90) 범위
- [x] `tenureYears`는 `tenureYearsMin`~`tenureYearsMax`(0~8) 범위
- [x] `traits`는 정확히 2개이며 **서로 다르다**
- [x] `goal`은 4종 중 1개
- [x] 전원 `status === 'available'`, `memories === []`
- [x] 길드원은 `trust`가 중간값에서 시작, 외부인은 `recruit.initialTrust`(0.25)
- [x] **같은 시드면 항상 같은 명부**가 나온다
- [x] 모든 수치가 `balance.json`에서 읽힌다 — 코드에 리터럴 없음

> **AC-10 판정 (2026-08-08)**: 이 조항은 **밸런스·게임플레이 수치**에만 적용한다.
> 재시도 상한(`MAX_NAME_ATTEMPTS`), 배열 인덱스 연산, id 접두사 같은 **구조적 기술
> 상수는 명시적으로 면제한다.** 근거: `balance.json`은 마감 직전 밸런싱용 파일이고,
> 게임과 무관한 기술 값이 섞이면 그 목적이 흐려진다. 이 판정은 story-002~019에도
> 동일하게 적용된다.
>
> 정적 검사 결과 `roster.ts`의 숫자 리터럴은 `MAX_NAME_ATTEMPTS = 200` 하나뿐이며
> 밸런스 수치는 0개다.

## Implementation Notes

- 파일: `src/domain/roster.ts` — `createWorldRoster(rng: Rng, balance): Adventurer[]`
- 이름은 **템플릿 조립**으로 만든다 (성 테이블 × 이름 테이블). 산문 금지 규칙과 동일
  선상 — 이름 목록을 손으로 22개 쓰지 않는다
- `traits` 중복 방지: 첫 태그를 뽑고 나머지에서 두 번째를 뽑는다
- 길드원 선정은 `capability` 상위 8명이 아니라 **무작위**여야 한다. 다 망한 길드다

## Out of Scope

- 인맥(`Client.knownBy`) — 의뢰 생성 시점에 정해진다 (Story 002)
- 영입으로 `inGuild` 전환 — Story 015

## QA Test Cases

- **AC: 같은 시드면 같은 명부**
  - Given: 시드 1234
  - When: `createWorldRoster`를 두 번 호출
  - Then: 두 배열이 깊은 비교로 동일
  - Edge: 다른 시드면 달라야 한다
- **AC: traits 2개, 서로 다름**
  - Given: 임의 시드 20개
  - When: 전원 생성
  - Then: 모든 인물의 `traits.length === 2 && traits[0] !== traits[1]`
- **AC: 범위 준수**
  - Then: 전원 `capability`가 [15, 90], `tenureYears`가 [0, 8] 안
  - Edge: 경계값 15와 90이 실제로 나올 수 있는지 (수천 회 시행)
- **AC: 길드 인원수**
  - Then: `filter(a => a.inGuild).length === 8`

## Test Evidence

`tests/unit/domain/roster.test.ts` — 테스트 14개, 전부 통과 (2026-08-08).

> **편차**: 스토리 원문은 `roster_test.ts`였으나 `vitest.config.ts`의
> `include: ["tests/**/*.test.ts"]`가 그 패턴을 수집하지 않는다. 그대로 뒀으면
> 테스트가 **조용히 실행되지 않았다.** 실제로 도는 `.test.ts`를 따랐다.
> 나머지 스토리 파일의 테스트 경로도 같은 문제를 갖고 있다.

**Status**: [x] 작성 완료 · 통과

## Dependencies

- Depends on: 없음 (`rng.ts`, `types.ts`, `balance.json` 모두 완료됨)
- Unlocks: Story 002, 004, 009

## Completion Notes

**Completed**: 2026-08-08
**Criteria**: 10/10 통과 (AC-10은 위 판정에 따라 기술 상수 면제 적용)
**Test Evidence**: Logic — `tests/unit/domain/roster.test.ts`, 14개 전부 통과.
`npx tsc --noEmit` 무경고. BLOCKING 게이트 통과.
**Code Review**: 완료 — `/code-review` 결과 **APPROVED WITH SUGGESTIONS**
(gameplay-programmer + qa-tester 병렬 리뷰). 차단 결함 없음.

**Deviations** (전부 ADVISORY — tech debt로 이관, `docs/tech-debt-register.md`):

1. `names.json`이 정적 import다 (`roster.ts:17`). 파일 자신의 docblock이 "싱글턴을
   참조하면 테스트에서 갈아 끼울 수 없다"고 주장하면서 이름 표에는 그 원칙을 적용하지
   않았다. 결과적으로 이름 고갈 throw 경로(`roster.ts:104`)에 테스트 이음매가 없다.
2. `tenureYears` 경계값(0, 8) 도달 가능성이 미검증이다. `capability`의 경계는
   `test_range_boundaries_are_actually_reachable`이 증명하지만 같은 위험을 가진
   `tenureYears`는 범위 검사만 있다.
3. `pickTwoTraits`가 `TRAITS.length >= 2`를 암묵적으로 가정한다. 현재 6개라 문제
   없으나 불변식이 문서화되지 않았다.

**Scope**: 스토리 명시 범위(`src/domain/roster.ts`) 밖 3개 파일이 변경됐으나 **전부
AC 충족에 필수**이며 스코프 크리프가 아니다 —
`balance.json`(`world.guildInitialTrust` 추가, AC-8이 요구),
`types.ts`(`TRAITS`/`GOALS` 런타임 배열 추가, 유니온 타입은 런타임에 없으므로 AC-5·AC-6이 요구),
`names.json`(신규, Implementation Notes가 표 조립 방식을 명시).

**후속 조치**: 나머지 스토리(002~019)의 Test Evidence 경로가 전부 `*_test.ts`로
적혀 있어 `vitest.config.ts`의 `include: ["tests/**/*.test.ts"]`에 수집되지 않는다.
story-002 착수 전에 일괄 정정이 필요하다.
