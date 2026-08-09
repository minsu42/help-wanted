# Story 008: 파견 배정 + 결과 화면 (최소판)

> **Day**: 1 | **Status**: Superseded | **Layer**: Presentation | **Type**: UI
> **Estimate**: 2h
> **Spec**: `design/quick-specs/dispatch-resolution-2026-08-08.md` §1, §4
> **ADR**: N/A — 3일 마감으로 ADR 파이프라인 생략

> **2026-08-09 전면 개정 영향** — 이 스토리는 3일 마감판의 as-built 기록이다.
> 본문은 당시 구현을 그대로 서술하며 수정하지 않는다.
>
> **폐기된 것**: **배정 거부의 근거.** AC-3(`goal === 'survival'` + 공개 위험도 >
> `survivalRefusalRisk`), AC-4(`trust < assignmentTrustThreshold`), AC-5(`goal ===
> 'glory'` 강조 + Implementation Deviations 2번이 새로 뗀 `dispatch.gloryVolunteerRisk`)
> 는 전부 **목표 4종과 신뢰 수치**만으로 거부를 판정한다. 개정판에서 모험가는 스탯이
> 아니라 **가치관을 가진 사람**이며, 거부의 근거가 두 갈래로 갈린다 — ① 의뢰서에 적힌
> 위험도(플레이어가 적은 값), ② 가치관·과거 악연·공포 대상. 공개 위험도(`statedRisk`)
> 기준 판정은 자리를 내준다.
> **대체·확장**: `production/roadmap.md` **P2**(모험가가 의뢰서를 보고 배정을 거부하거나
> 수당을 요구 — "의도된 부패"가 실체를 갖는 곳) 및 **P4**(가치관 기반 거부, 강제 배정의
> 결과 — 충성도 하락·임무 중 이탈·길드 탈퇴).
> 새 요구사항은 그쪽이 소유한다. Implementation Deviations의 **결정 1**(`advanceDay`는
> 화면이 아니라 `main.ts`가 부른다)과 `inGuild` 필터 회귀 테스트는 생존한다.

## Context

**Day 1 종료 게이트가 이 스토리다.** 이것이 끝나면 "의뢰 받고 사람 보내서 결과 보기"가
돌아가고, 재미 검증이 가능해진다. 재미없다면 그 시점에 알아야 한다.

## Acceptance Criteria

- [x] 타결된 의뢰에 `available` 길드원을 1~`maxPartySize`명 배정할 수 있다
- [x] 각 모험가는 이름, **등급**(`gradeOf`), 성격 태그 2개, 상태로 표시된다
- [x] `goal === 'survival'`이고 공개 위험도 > `survivalRefusalRisk`면 배정을 거부하고 **사유를 보여준다**
- [x] `trust < assignmentTrustThreshold`면 거부한다
- [x] `goal === 'glory'`인 모험가는 고위험 의뢰에서 강조 표시된다
- [x] 배정 확정 시 전원 `onMission`이 되고 `durationDays`가 표시된다
- [x] 기간 경과 후 결과가 표시된다 — 성공/부상/사망, 누가 어떻게 됐는지
- [x] 사망은 붉은 봉랍색으로 표시된다
- [x] `capability` 숫자가 노출되지 않는다

## Implementation Notes

- 파일: `src/presentation/ui/DispatchScreen.ts`
- 결과 문장은 Story 006의 템플릿으로 조립한다. **문장을 손으로 쓰지 않는다**
- 이 스토리의 결과 화면은 **최소판**이다. "알았던 것 vs 실제였던 것" 대조는
  Story 014에서 완성한다. Day 1에는 "무슨 일이 일어났는가"만 보여주면 된다
- 배정 거부 사유 표시가 `goal` 필드를 살리는 유일한 접점이다. *"저는 이런 일에는 못
  갑니다"* 가 보여야 목표가 장식이 아니게 된다

## Out of Scope

- "알았던 것 vs 실제였던 것" 대조 — Story 014
- `trust`·`Memory` 갱신 — Story 013
- 자금·명성 반영 — Story 012

## QA Test Cases

- **Manual: 파티 상한**
  - Setup: `maxPartySize = 2`인 의뢰
  - Verify: 3명째를 선택할 수 없다
  - Pass: 선택 시도가 무시되거나 명확히 차단된다
- **Manual: 배정 거부**
  - Setup: `goal === 'survival'` 모험가 + 공개 위험도 > 90인 의뢰
  - Verify: 배정이 거부되고 사유 문장이 표시된다
  - Pass: 사유가 그 인물의 목표에서 나온 것으로 읽힌다
- **Manual: 사망 표시**
  - Setup: 역량이 크게 모자란 파티로 파견 (ratio < 0.6)
  - Verify: 사망이 붉은색으로 표시되고 해당 인물이 명부에서 `dead`가 된다
  - Pass: 이후 어떤 화면에서도 배정 대상으로 나타나지 않는다
- **Manual: Day 1 종료 게이트**
  - Setup: 새 게임 시작
  - Verify: 의뢰 수주 → 흥정 → 배정 → 결과까지 끊김 없이 진행된다
  - Pass: **한 번의 루프가 완주된다**

## Test Evidence

`production/qa/evidence/dispatch-screen-evidence.md`
**Status**: [x] 상호작용 테스트 27개 (`tests/unit/presentation/dispatchScreen.test.ts`).
실브라우저로 창구 → 배정 → 대기 → 결과 → 창구 전 구간 확인. 전체 274개 통과,
`npm run check`(타입+테스트+빌드) 통과.

## Implementation Deviations

> 이 스토리는 **서브에이전트(ui-programmer)가 병렬로 구현**했다. 아키텍처 결정 두 개와
> 아래 버그 수정은 메인 세션이 했다.

### 결정 1 — `advanceDay`를 화면이 직접 부르지 않는다

에이전트는 `DispatchScreen`이 `advanceDay(state, config)`를 직접 부르는 안을 제시했고,
그 부작용(다른 파견까지 조용히 판정되고 의뢰가 리필된다)까지 스스로 짚었다.
**콜백 주입으로 뒤집었다** — `onAdvanceDay: () => DayReport`를 받고 실제 호출은
`main.ts`가 한다.

근거: 하루를 넘기는 것은 렌더가 아니라 **회차 진행**이고 프레젠테이션 계층이 소유할
것이 아니다. Story 010(길드 홀)도 하루를 넘겨야 하므로, 두 화면이 각자 부르기 시작하면
진행의 주인이 사라진다. 부수 이득으로 이 화면은 `GameConfig`를 몰라도 되고, 테스트가
설정 전체를 조립하지 않고 스텁으로 시간을 몰 수 있다
(`test_onAdvanceDay_stub_drives_time_without_any_gameConfig`).

### 결정 2 — glory 강조에 새 노브를 뒀다

에이전트는 `survivalRefusalRisk`(90)를 재사용하려 했다. `balance.json`에
`dispatch.gloryVolunteerRisk: 70`을 새로 넣어 분리했다.

근거: 하나는 **하드 게이트**(배정 거부)고 하나는 **힌트**(자원 표시)다. 같은 값을
공유하면 밸런스 패스에서 거부 임계값을 조정할 때 자원 표시가 조용히 따라 움직인다.
70~90 구간에 "자원하는데 아무도 거부하지 않는" 밴드가 생기는 것이 오히려 의도한 긴장이다.
`test_glory_highlight_is_independent_of_survival_refusal_threshold`가 고정한다.

### 실브라우저에서 잡은 버그 — `inGuild` 필터 누락

배정 후보가 `status === 'available'`로만 걸러져 **월드 풀 22명이 전부 나왔다.**
스펙은 *"`status === 'available'`인 **길드원**만"* 이다.

**단위 테스트 26개가 전부 통과하는 상태였다** — 테스트 팩토리의 `inGuild` 기본값이
`true`라서 조건이 한 번도 시험되지 않았다.

그대로 뒀으면 **영입(Story 015)이 존재할 이유가 사라진다.** 135~330G를 내고 데려올
필요 없이 아무나 보내면 되기 때문이다. 회귀 테스트
`test_outsiders_are_never_assignable`을 추가했다.

### 통합 중 정리한 것

에이전트가 `types.ts`를 읽은 뒤 메인 세션이 `knownWealth`를 추가해서 테스트 파일에
타입 오류가 남아 있었다. `GameState.roster`가 `readonly` 프로퍼티라 재할당이 막히는
것도 함께 정리했다(제자리 교체 헬퍼 `setRoster`).

### 밸런스 관찰 (Story 018로)

첫 회차 1일차에 공개 위험도 29짜리 의뢰에 `한몫` 등급 1명을 보냈더니 사망했다.
은폐폭이 최대 0.45라 실제 위험도가 표시값의 두 배 가까이 될 수 있고, 정원이 1명이면
피할 방법이 없다. **설계대로 동작하는 것이지만 첫 경험으로는 가혹할 수 있다** —
`concealmentMax` 또는 1일차 의뢰의 은폐폭 상한을 Day 3 밸런스 패스에서 볼 것.

## Dependencies

- Depends on: Story 004, 005, 006, 007
- Unlocks: **Day 1 종료 게이트** — 이후 전체
