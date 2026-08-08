# Story 008: 파견 배정 + 결과 화면 (최소판)

> **Day**: 1 | **Status**: Ready | **Layer**: Presentation | **Type**: UI
> **Estimate**: 2h
> **Spec**: `design/quick-specs/dispatch-resolution-2026-08-08.md` §1, §4
> **ADR**: N/A — 3일 마감으로 ADR 파이프라인 생략

## Context

**Day 1 종료 게이트가 이 스토리다.** 이것이 끝나면 "의뢰 받고 사람 보내서 결과 보기"가
돌아가고, 재미 검증이 가능해진다. 재미없다면 그 시점에 알아야 한다.

## Acceptance Criteria

- [ ] 타결된 의뢰에 `available` 길드원을 1~`maxPartySize`명 배정할 수 있다
- [ ] 각 모험가는 이름, **등급**(`gradeOf`), 성격 태그 2개, 상태로 표시된다
- [ ] `goal === 'survival'`이고 공개 위험도 > `survivalRefusalRisk`면 배정을 거부하고 **사유를 보여준다**
- [ ] `trust < assignmentTrustThreshold`면 거부한다
- [ ] `goal === 'glory'`인 모험가는 고위험 의뢰에서 강조 표시된다
- [ ] 배정 확정 시 전원 `onMission`이 되고 `durationDays`가 표시된다
- [ ] 기간 경과 후 결과가 표시된다 — 성공/부상/사망, 누가 어떻게 됐는지
- [ ] 사망은 붉은 봉랍색으로 표시된다
- [ ] `capability` 숫자가 노출되지 않는다

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
**Status**: [ ] 미작성

## Dependencies

- Depends on: Story 004, 005, 006, 007
- Unlocks: **Day 1 종료 게이트** — 이후 전체
