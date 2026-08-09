# Story 010: 길드 홀 출석 + 화면

> **Day**: 2 | **Status**: Superseded | **Layer**: Presentation | **Type**: UI
> **Estimate**: 2h
> **Spec**: `design/quick-specs/rumor-network-2026-08-08.md` §3
> **ADR**: N/A — 3일 마감으로 ADR 파이프라인 생략

> **2026-08-09 전면 개정 영향** — 이 스토리는 3일 마감판의 as-built 기록이다.
> 본문은 당시 구현을 그대로 서술하며 수정하지 않는다.
>
> ⚠ **본문의 AC 체크박스와 Test Evidence는 구현 전 상태에서 갱신되지 않았다.** 실제로는
> `src/presentation/ui/GuildHallScreen.ts`로 구현되어 커밋 `08450c9`에 들어갔고
> `tests/unit/presentation/guildHallScreen.test.ts` · `tests/unit/domain/hall.test.ts` ·
> `tests/integration/hallToKnowledge.test.ts`가 이를 검증한다. 동결 원칙에 따라 그
> 체크박스는 고치지 않는다 — 실제 상태는 헤더의 `Status`가 말한다.
>
> **폐기된 것**: **길드 홀이 사실을 캐는 창이라는 전제.** Context의 *"정보를 캐는
> 유일한 창"* 과 AC-5(대화 → Story 009 판정 → 사실 공개)가 그 전제 위에 서 있다.
> 개정 후 홀에서 길드원이 주는 것은 사실이 아니라 **의견·관계·자원 의사**이며, 사실은
> 홀에 드나드는 **외부인·정보상**이 가져온다. AC-7(밝혀진 인맥 표시)이 영입 판단의
> 근거였던 것도 P4의 하이브리드 영입에서 재편된다.
> **대체·확장**: `production/roadmap.md` **P4**(정보 채널 재배치, 길드원 조언,
> 대화가 신뢰를 올린다 — 홀 순회가 정보 수집에서 **관계 관리**로 바뀐다).
> 새 요구사항은 그쪽이 소유한다. 출석 규칙(`onMission`/`injured`/`dead` 결석, 등급이
> 다음 날부터 반영, 시드 결정론)은 생존한다.

## Context

정보를 캐는 유일한 창이다. 희소성이 플레이어의 예산("하루 3회 대화권")이 아니라
**세계의 출석**("오늘 홀에 있는 사람이 이들뿐")에서 나온다 — 기둥 2와 맞추기 위한 선택.

## Acceptance Criteria

- [ ] 매일 `available` 길드원 중 `hallAttendanceMin`~`guildTiers[tier].hallAttendanceMax`명이 출석한다
- [ ] 외부 모험가가 `visitorMin`~`visitorMax`(0~2)명 방문한다
- [ ] **`onMission` / `injured` / `dead`는 나타나지 않는다**
- [ ] 각 인물은 이름, 등급, 성격 태그 2개, 소속(길드원/외부인)으로 표시된다
- [ ] 대화 버튼을 누르면 Story 009의 판정이 실행되고 결과가 문장으로 표시된다
- [ ] 대화한 사람은 그날 다시 대화할 수 없다 (표시로 구분)
- [ ] 밝혀진 인맥(`discoveredContacts`)이 인물별로 표시된다
- [ ] `greedy`가 대가를 요구하면 지불/거절을 선택할 수 있고, 자금 부족 시 지불이 비활성이다
- [ ] 길드 등급을 올리면 **다음 날부터** 출석 인원이 늘어난다
- [ ] 같은 시드면 출석자 구성이 항상 같다

## Implementation Notes

- 파일: `src/presentation/ui/GuildHallScreen.ts`
- **`onMission` 결석이 이 화면의 숨은 교훈이다.** 베테랑을 긴 의뢰에 보내면 그가 홀에서
  사라지고 정보가 마른다. 굳이 설명하지 말고 그냥 없으면 된다 — 플레이어가 스스로
  알아채는 것이 이 게임의 학습 방식이다
- 밝혀진 인맥 표시가 "길드 홀이 플레이할수록 밝아진다"는 감각을 만든다. 처음에는 전부
  물음표이고, 대화할수록 채워진다
- 외부인은 사실을 말해주지 않지만 인맥은 알려준다. 그 차이가 화면에서 읽혀야 영입
  판단(Story 015)이 가능해진다

## Out of Scope

- 영입 버튼 — Story 015
- 소문 판정 로직 — Story 009 (여기서는 호출과 렌더만)

## QA Test Cases

- **Manual: 파견자 결석**
  - Setup: 베테랑을 `durationDays 4`인 의뢰에 파견
  - Verify: 다음 4일간 그가 홀에 나타나지 않는다
  - Pass: 복귀 다음 날부터 다시 출석 후보가 된다
- **Manual: 외부인 구분**
  - Setup: 외부 모험가가 방문한 날
  - Verify: 길드원과 시각적으로 구분되고, 대화해도 사실을 말하지 않으며, 인맥은 표시된다
  - Pass: "영입하면 저 의뢰가 열리겠다"는 판단이 가능하다
- **Manual: 등급 상승 반영**
  - Setup: 길드 등급 1 → 2로 확장
  - Verify: 같은 날이 아니라 **다음 날**부터 출석 인원 상한이 5로 오른다
  - Pass: 상한 증가가 실제 출석 수에 반영된다
- **Manual: 재대화 차단**
  - Verify: 대화 완료한 인물의 버튼이 비활성이고 상태가 보인다

## Test Evidence

`production/qa/evidence/guild-hall-evidence.md`
**Status**: [ ] 미작성

## Dependencies

- Depends on: Story 005, 009
- Unlocks: Story 011, 015
