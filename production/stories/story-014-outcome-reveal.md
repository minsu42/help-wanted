# Story 014: 결과 대조 화면 (알았던 것 vs 실제였던 것)

> **Day**: 2 | **Status**: Ready | **Layer**: Presentation | **Type**: UI
> **Estimate**: 1.5h
> **Spec**: `design/quick-specs/dispatch-resolution-2026-08-08.md` §5
> **ADR**: N/A — 3일 마감으로 ADR 파이프라인 생략

## Context

**컨셉 문서가 1순위 설계 리스크로 지목한 것에 대한 최종 방어선이다** —
*"창발이 무작위처럼 느껴질 위험. 플레이어가 '내 판단이 결과를 바꿨다'고 느끼지 못하면
게임 전체가 무너진다."*

컨셉은 이 화면을 **"실력 성장의 유일한 피드백 채널"** 이라고 규정했다. 반드시 명료해야
한다.

`GameState`가 `WorldState`(진실)와 `PlayerKnowledge`(아는 것)를 분리해 보관하므로
(Story 005), 이 화면은 **두 객체를 나란히 렌더링하는 것**으로 끝난다.

## Acceptance Criteria

- [ ] 좌우 대조로 표시한다 — **당신이 알았던 것** vs **실제였던 것**
- [ ] 좌변에 표시: 공개 위험도, 소문으로 들은 값(있다면), **누가 말했는지**
- [ ] 우변에 표시: 실제 위험도, 실제 지불 여력
- [ ] 두 값이 다르면 차이가 시각적으로 강조된다
- [ ] 판정 근거를 보여준다: 파티 역량 합, `ratio`, `uncertainty`
- [ ] `ratio`가 아슬아슬했는지(도박 구간) 여유로웠는지가 **한눈에** 읽힌다
- [ ] 미지급이 발생했으면 붉은 봉랍색으로 크게 표시하고, 의뢰인 `wealth`가 공개됐음을 알린다
- [ ] 사망이 있으면 그 인물의 이름과 기억(`Memory`)에서 뽑은 한 문장을 표시한다
- [ ] 소문을 얻지 않았던 항목은 좌변에 **"몰랐다"** 로 명시된다 — 빈칸으로 두지 않는다

## Implementation Notes

- 파일: `src/presentation/ui/OutcomeScreen.ts`
- **`ratio`와 `uncertainty`를 숫자로 던지지 말 것.** *"여유 있었다 / 아슬아슬했다 /
  무모했다"* 같은 띠(band) 표현이 낫다. 숫자를 보여주면 다시 계산기 게임이 된다
- *"당신은 카린의 말을 믿었다"* 를 쓰려면 Story 009가 보관한 **화자 정보**가 필요하다.
  이것이 성격 필터를 학습 가능하게 만드는 유일한 연결이다 — `boastful`에게 속았다는
  것을 여기서 알아야 다음에 깎아 듣는다
- "몰랐다"를 빈칸으로 두면 안 된다. **모른 채로 결정했다는 사실 자체가 교훈**이며,
  빈칸은 그걸 전달하지 못한다

## Out of Scope

- 판정 로직 — Story 004
- 자금·명성 반영 — Story 012
- 시각 폴리시 — Story 017

## QA Test Cases

- **Manual: 대조가 즉시 읽힌다**
  - Setup: `boastful`에게서 낮은 위험도를 듣고 파견해 사망
  - Verify: 좌변에 들은 값과 화자, 우변에 실제 값, 차이가 강조된다
  - Pass: **왜 죽었는지가 화면을 3초 보면 이해된다**
- **Manual: 몰랐던 항목**
  - Setup: 소문 없이 파견
  - Verify: 좌변이 "몰랐다"로 명시된다
  - Pass: 빈칸이나 0이 아니라 문장으로 표시된다
- **Manual: 마진 표현**
  - Setup: `ratio` 1.5인 파견과 0.9인 파견
  - Verify: 각각 "여유 있었다" / "아슬아슬했다" 계열로 다르게 표시된다
  - Pass: 숫자가 아니라 말로 읽힌다
- **Manual: 미지급 표시**
  - Setup: `wealth` 0.1 의뢰인, 선불 0, 성공
  - Verify: 붉은색 미지급 표시 + `wealth` 공개 안내
  - Pass: 다음에 이 의뢰인을 만나면 선불을 받아야겠다는 판단이 선다

## Test Evidence

`production/qa/evidence/outcome-reveal-evidence.md` — **스크린샷 필수**
**Status**: [ ] 미작성

## Dependencies

- Depends on: Story 004, 006, 009, 012, 013
- Unlocks: Story 016
