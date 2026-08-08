# Story 012: 명성·자금 경제 (잔금 판정, 스케일링)

> **Day**: 2 | **Status**: Implemented — `/story-done` 대기 | **Layer**: Feature | **Type**: Logic
> **Estimate**: 1.5h
> **Spec**: `design/quick-specs/contract-negotiation-2026-08-08.md` §5,
> `design/quick-specs/dispatch-resolution-2026-08-08.md` §4,
> `design/quick-specs/guild-scale-and-difficulty-2026-08-08.md` §1
> **ADR**: N/A — 3일 마감으로 ADR 파이프라인 생략

## Context

**선불 축이 값을 하는 곳이다.** 잔금 미지급이 없으면 "계약 타결 = 돈"이 되어 실패
경로가 결렬 하나뿐이고, 그러면 선불 축을 자를 이유가 생긴다.

명성은 압력을, 길드 규모는 대응력을 만든다. 둘이 경주하는 것이 이 게임의 진행 감각이다.

## Acceptance Criteria

- [x] 계약 타결 시 선불액이 **즉시** 자금에 들어온다
- [x] 의뢰 완수(`success`/`injured`) 시 잔금 지급 여부를 `client.wealth`로 판정한다
- [x] `dead`(실패) 시 **잔금이 지급되지 않고 선불만 남는다**
- [x] 미지급이 발생하면 해당 의뢰인의 `wealth`가 `PlayerKnowledge`에 **영구 기록**된다
- [x] 명성 변동: `success` `+repOnSuccess`(2.5), `injured` `+repOnSuccess × repInjuryPenalty`(0.6), `dead` `−repOnDeath`(6)
- [x] 명성은 0 미만으로 내려가지 않고 100을 넘지 않는다
- [x] 다음 날 의뢰 생성이 갱신된 명성을 사용한다
- [x] 자금은 0 미만으로 내려가지 않는다 (지출은 잔액 확인 후에만 가능)
- [x] 모든 수치가 `balance.json`에서 읽힌다

## Implementation Notes

- 파일: `src/domain/economy.ts`
- **미지급 시 `wealth` 영구 공개가 선불 축의 학습 속도 보완책이다.** 15일 회차에서
  떼이는 경험은 2~3번뿐이라 그냥 두면 패턴을 배우기 전에 게임이 끝난다. 한 번 떼이면
  그 사람에게는 두 번 다시 속지 않게 만든다
- 잔금 판정은 `rng.chance(client.wealth)` 정도로 단순하게 시작한다. 튜닝은 Day 3
- 명성 상한 100은 클램프로 처리하되, 15일 안에 도달하기 어렵게 설계돼 있다
  (좋은 회차에 55 근처)

## Out of Scope

- 영입비·확장비 지출 — Story 015
- 소문값(`greedyPrice`) 지불 — Story 010
- 엔딩 결산 — Story 016

## QA Test Cases

- **AC: 실패 시 선불만**
  - Given: 보상 200G, 선불 비율 0.3 (선불 60G), 결과 `dead`
  - Then: 총 획득이 60G — 잔금 140G는 들어오지 않는다
- **AC: 선불 없이 미지급**
  - Given: 선불 0, `wealth` 0.1인 의뢰인, 결과 `success`
  - When: 다수 시행
  - Then: 대부분의 경우 총 획득 0G
- **AC: wealth 영구 공개**
  - Given: 미지급 발생
  - Then: `PlayerKnowledge`에 해당 의뢰인의 `wealth`가 기록되고, 이후 날에도 유지된다
- **AC: 명성 클램프**
  - Given: 명성 3에서 `dead`(−6)
  - Then: 명성이 0 (음수 아님)
  - Edge: 명성 98에서 `success`(+2.5) → 100
- **AC: 명성이 다음 의뢰에 반영**
  - Given: 명성 10 → 30으로 상승
  - Then: 다음 날 생성된 의뢰의 기대 위험도가 상승해 있다

## Test Evidence

`tests/unit/domain/economy.test.ts`
**Status**: [x] 작성 완료 · 통과 — 테스트 23개 + 통합 테스트 4개. 전체 247개 통과.

## Implementation Deviations

> 이 스토리는 **서브에이전트(gameplay-programmer)가 병렬로 구현**했고, `gameState.ts`
> 배선은 메인 세션이 했다.

### 판정과 적용을 파일로 갈랐다

`economy.ts`는 순수 함수만 내놓는다 — "이만큼 변한다"를 계산할 뿐 `GameState`를 만지지
않는다. 제자리 반영은 `gameState.ts`의 `applyEconomy`가 한다. `dispatch.ts`와 같은 경계다.

### 정산을 의뢰 생성보다 **먼저** 부른다

`advanceDay`의 순서가 `파견 판정 → 부상 회복 → **정산** → 의뢰 생성`이 됐다.
의뢰 난이도가 명성에서 나오므로, 오늘의 성과가 오늘 도착하는 의뢰에 반영되어야
*"성공이 곧 위험 상승"*이 하루 단위로 성립한다. AC 7번이 요구하는 순서다.

### 에이전트의 해석 판단 (확인 후 유지)

**`dead`에서는 `wealth`를 공개하지 않는다.** 사망의 미지급은 `wealth`와 무관하게
무조건이므로, 그때 공개하면 *"이 의뢰인은 원래 못 준다"* 는 **틀린 신호**가 된다.
`wealth`가 실제로 판정에 쓰인 `success`/`injured` 미지급에서만 영구 기록한다.
`test_unpaid_balance_permanently_records_the_client_wealth`가 사망이 아님을 함께 단언한다.

명성 0~100 클램프와 자금 0 하한은 코드 리터럴이다 — 튜닝 노브가 아니라 **축 자체의
정의**이며, AC-10 판정(story-001)의 기술 상수 면제에 해당한다.

### 공유 파일 변경 (메인 세션이 적용)

- `types.ts` — `MutableKnowledge.knownWealth: Map<string, number>` /
  `PlayerKnowledge.knownWealth: ReadonlyMap<string, number>`
- `gameState.ts` — `ActiveDispatch.remainingReward`, `dispatchParty`의 `receiveAdvance`
  호출, `advanceDay`의 `applyEconomy` 단계, `GameConfig.economy`
- `main.ts` + 테스트 2곳 — `config.economy` 매핑
- `balance.json` — 변경 없음. `dispatch.repOnSuccess/repOnDeath/repInjuryPenalty`가 이미 있었다

## Dependencies

- Depends on: Story 004, 005
- Unlocks: Story 015, 016
