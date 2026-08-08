# Story 018: 밸런싱 패스

> **Day**: 3 (오전) | **Status**: Ready | **Layer**: Polish | **Type**: Config/Data
> **Estimate**: 1h
> **Spec**: 각 quick-spec의 Tuning Knobs 절
> **ADR**: N/A — 3일 마감으로 ADR 파이프라인 생략

## Context

**`src/data/balance.json`만 수정한다. 코드는 건드리지 않는다.**

이 스토리가 성립하는 것 자체가 "밸런스 숫자 하드코딩 금지" 규칙이 지켜졌다는 증거다.
코드를 열어야 한다면 그건 이전 스토리 중 하나가 규칙을 어겼다는 뜻이므로, 그 사실을
먼저 기록하고 해당 상수를 `balance.json`으로 옮긴다.

## Acceptance Criteria

- [ ] 15일 회차를 최소 3회 완주하며 관찰한다 (서로 다른 시드)
- [ ] **사망자 수가 회차당 1~2명** 범위에 든다 (컨셉의 초기 가설)
- [ ] 소문 없이 흥정하면 불리하고, 소문이 있으면 유리하다는 것이 체감된다
- [ ] 15일 안에 길드 확장을 최소 1회 할 수 있되, 등급 3까지는 빠듯하다
- [ ] 명성이 좋은 회차에 50~60 근처에 도달한다
- [ ] 후반부에 감당하기 어려운 의뢰가 실제로 등장한다 (유혹 의뢰가 작동한다)
- [ ] **코드 파일 변경 0건** — `git diff --stat`이 `balance.json`만 보여준다
- [ ] 조정한 값과 이유를 `production/qa/balance-notes-2026-08-10.md`에 기록한다

## Implementation Notes

**1순위 노브 4개** — 증상별로 여기부터 만진다:

| 증상 | 노브 | 기본값 |
|---|---|---|
| 너무 많이/적게 죽는다 | `dispatch.injuryRatio` | 0.75 |
| 소문이 무의미/과강력 | `scaling.riskSpread` / `negotiation.disclosureBonus` | 0.20 / 0.4 |
| 정보가 너무 잘 흐른다 | `guildTiers[].hallAttendanceMax` | 4/5/6 |
| 돈이 남는다/모자란다 | `economy.rewardPerRisk` | 1.5 |

- **한 번에 하나씩 바꾸고 한 회차를 돌린다.** 여러 개를 동시에 만지면 무엇이 효과였는지
  알 수 없고, 1시간 안에 수렴하지 못한다
- 시드를 고정해 비교하면 변경 효과가 선명하게 보인다
- 미해결 질문 2번(의뢰당 숨은 정보 개수)이 여기서 종결된다 — `factsPerContract`가
  2로 적정한지 판정

## Out of Scope

- 코드 수정 (규칙 위반 발견 시에만 예외적으로, 기록과 함께)
- 새 기능 추가

## QA Test Cases

- **Config/Data: 스모크 통과**
  - Setup: 조정 후 `npm run check`
  - Verify: 타입체크·테스트·빌드 전부 통과
  - Pass: 테스트가 새 값으로도 통과한다 (경계값 테스트가 깨지면 테스트를 고칠지
    값을 되돌릴지 판단)
- **Config/Data: 사망률**
  - Setup: 시드 3개로 15일 완주
  - Verify: 사망자 수 기록
  - Pass: 평균 1~2명
- **Config/Data: 코드 미변경**
  - Verify: `git diff --stat`
  - Pass: `src/data/balance.json` 외 변경 없음

## Test Evidence

`production/qa/balance-notes-2026-08-10.md` — 조정 내역과 근거
**Status**: [ ] 미작성

## Dependencies

- Depends on: Story 016 (완주 가능해야 밸런싱이 된다)
- Unlocks: Story 019
