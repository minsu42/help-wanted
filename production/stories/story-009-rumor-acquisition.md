# Story 009: 소문 획득 판정 (신뢰·성격 필터·왜곡)

> **Day**: 2 | **Status**: Ready | **Layer**: Feature | **Type**: Logic
> **Estimate**: 2h
> **Spec**: `design/quick-specs/rumor-network-2026-08-08.md` §4–6
> **ADR**: N/A — 3일 마감으로 ADR 파이프라인 생략

## Context

**필수 테스트 3번**(`technical-preferences.md`)이자 이 게임의 차별점이다. 컨셉 문서가
하루를 온전히 투입하라고 지정한 시스템.

핵심 장치는 **두 단계의 분리** — 인맥은 신뢰 무관으로 열리고, 사실은 신뢰 판정을 거친다.
이 분리가 외부 모험가 정찰(Story 015)을 성립시킨다.

## Acceptance Criteria

- [ ] 대화 시 ① 그 사람이 아는 **열린 의뢰의 의뢰인**이 `discoveredContacts`에 기록된다 — **신뢰 무관**
- [ ] ② 사실 공개는 성격별 신뢰 임계값을 넘어야 한다 (`default` 0.4 / `cautious` 0.6 / `loyal` 0.2)
- [ ] `Client.knownBy`에 없는 사람은 그 의뢰의 사실을 **절대** 말하지 않는다
- [ ] `talkative`는 1회에 사실 2개, 그 외는 1개
- [ ] `greedy`는 `greedyPrice`(20G)를 요구하고, 지불을 거절하면 침묵한다
- [ ] `bitter`는 위험도를 `+traitDistortion` 만큼 높게, `boastful`은 낮게 전한다
- [ ] 왜곡은 **표시값에만** 걸린다 — `revealedFacts`에는 사실 id가 그대로 들어간다
- [ ] 획득한 사실마다 **누가 말했는지**를 보관한다 (결과 대조용)
- [ ] 하루에 같은 사람과 두 번 대화할 수 없다
- [ ] 의뢰가 종료되면 그 의뢰의 사실은 더 이상 조회되지 않는다
- [ ] 같은 시드 + 같은 대화 순서면 항상 같은 사실이 나온다

## Implementation Notes

- 파일: `src/domain/rumor.ts`
- **왜곡과 게이트를 분리하는 것이 핵심이다.** 위험 고지 축(Story 011)이 열리는 조건은
  "사실을 획득했는가"이지 "값이 정확한가"가 아니다. `boastful`의 말을 믿고 위험을
  과소평가하는 것이 곧 플레이어의 실수가 되어야 한다
- "누가 말했는지"를 보관하지 않으면 결과 대조 화면에서 *"당신은 카린의 말을 믿었다"*
  를 쓸 수 없다. 이것이 성격 필터를 학습 가능하게 만드는 유일한 연결이다
- 성격 태그는 플레이어에게 **항상 보인다**. 왜곡이 무작위가 아니라 체계적이어야
  "저 사람 말은 깎아 듣자"를 배울 수 있다

## Out of Scope

- 홀 출석자 결정 — Story 010
- 위험 고지 축 연동 — Story 011
- 신뢰 갱신 — Story 013

## QA Test Cases

- **AC: knownBy 밖은 침묵**
  - Given: `knownBy`에 없는 모험가, 신뢰 1.0
  - When: 대화
  - Then: 해당 의뢰의 사실이 하나도 공개되지 않는다
- **AC: 성격별 임계값**
  - Given: 신뢰 0.5, `cautious`(0.6) / `default`(0.4) / `loyal`(0.2)
  - Then: `cautious`만 침묵, 나머지는 말한다
  - Edge: 신뢰가 임계값과 정확히 같으면 말한다 (`>=`)
- **AC: 왜곡 방향**
  - Given: 실제 위험도 100, `traitDistortion` 0.15
  - Then: `bitter` 전달값 115 > 실제 100 > `boastful` 전달값 85
- **AC: 왜곡이 게이트를 막지 않음**
  - Given: `boastful`에게서 `realRisk` 획득
  - Then: `revealedFacts`에 사실 id가 들어간다 (표시값이 낮아도)
- **AC: talkative 개수**
  - Given: 사실 2개를 아는 `talkative`
  - Then: 1회 대화에서 2개 전부 공개
- **AC: 결정론**
  - Given: 같은 시드, 같은 대화 순서
  - Then: 공개된 사실 집합과 표시값이 동일

## Test Evidence

`tests/unit/domain/rumor.test.ts` — **필수 테스트 3번**
**Status**: [ ] 미작성

## Dependencies

- Depends on: Story 001, 002, 006
- Unlocks: Story 010, 011, 014, 015
