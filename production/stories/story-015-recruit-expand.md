# Story 015: 모험가 영입 + 길드 확장

> **Day**: 2 (후반) | **Status**: Ready | **Layer**: Feature | **Type**: UI
> **Estimate**: 2.5h
> **Spec**: `design/quick-specs/guild-scale-and-difficulty-2026-08-08.md` §3–4
> **ADR**: N/A — 3일 마감으로 ADR 파이프라인 생략

## ⚠ 절단 후보 1순위

**이 스토리는 원래 MVP 정의에 없었고 2026-08-08 세션에서 추가되었다.**
Day 2 저녁에 일정이 밀려 있으면 **가장 먼저 잘라낸다.** 잘라내면 자금 싱크가 사라지지만
핵심 루프(협상 → 파견 → 결과)는 온전히 남는다.

잘라낼 경우 함께 처리할 것: 자금이 쌓이기만 하는 문제를 엔딩(Story 016)에서 최종
점수에 반영해 최소한의 의미는 남긴다.

## Context

**이 게임의 유이한 자금 싱크다.** 없으면 흥정으로 번 돈이 갈 곳이 없어 명성 점수의
부속물이 되고, 흥정의 의미가 반감된다.

영입은 **표시는 전력, 발견은 정보**로 설계한다 — UI는 "의뢰를 감당할 사람이 늘어난다"로
제시하되, 실제로는 그 사람의 인맥이 정보망에 들어온다. 주 타깃이 Explorers이므로
나중에 발견되는 깊이가 처음부터 설명된 깊이보다 낫다.

## Acceptance Criteria

### 영입
- [ ] **홀에 와 있는 외부 모험가**만 영입 대상으로 표시된다
- [ ] `cost = costBase + costPerCapability×capability + costPerTenure×tenureYears`
- [ ] 지불 시 `inGuild = true`, 자금이 `cost`만큼 감소, `trust = recruit.initialTrust`(0.25)
- [ ] 자금 부족 또는 **정원 초과**면 버튼이 비활성이고 사유가 표시된다
- [ ] 영입 직후, 그가 `knownBy`에 포함된 열린 의뢰의 사실이 조회 가능해진다

### 길드 확장
- [ ] 등급을 올리면 정원·홀 출석 최대·동시 의뢰가 **동시에** 갱신된다 (`guildTiers` 테이블)
- [ ] 등급 3에서 더 이상 올릴 수 없다
- [ ] 자금 부족 시 버튼이 비활성이다
- [ ] 등급 상승 효과는 **다음 날부터** 반영된다

## Implementation Notes

- 파일: `src/domain/guild.ts` + `src/presentation/ui/GuildHallScreen.ts`에 버튼 추가
- **협상도 조건도 없다. 돈을 내면 들어온다.** 3일 안에 넣기 위한 의도적 단순화이며,
  영입 협상을 붙이려는 유혹을 여기서 차단한다
- 확장 비용(400/900G)이 최고가 영입(≈330G)보다 비싸야 한다. 아니면 확장부터 사고 본다
- 영입 UI 문구는 전력 기준으로 쓴다. 인맥 효과를 설명하지 않는다 — 플레이어가
  발견하게 둔다

## Out of Scope

- 영입 협상 / 조건 흥정 (Tier 2)
- 길드원 해고
- 급여·유지비 (자금 싱크로 검토했으나 정원 상한이 이미 무한 영입을 막으므로 불필요)

## QA Test Cases

- **AC: 비용 계산**
  - Given: capability 20, tenure 1 → 80 + 40 + 15
  - Then: `cost === 135`
  - Given: capability 80, tenure 6 → 80 + 160 + 90
  - Then: `cost === 330`
- **AC: 정원 차단**
  - Given: 등급 1(정원 8), 길드원 8명
  - Then: 영입 버튼 비활성 + "정원이 찼다" 사유
  - Edge: 사망으로 7명이 되면 다시 활성
- **AC: 영입이 정보를 연다**
  - Given: 외부인 X가 의뢰 C의 `knownBy`에 있음
  - When: X를 영입
  - Then: 다음 대화에서 C의 사실을 얻을 수 있다 (신뢰 임계는 별도로 충족해야 함)
- **Manual: 확장 3효과 동시 반영**
  - Setup: 등급 1 → 2 확장
  - Verify: 정원 10, 홀 출석 최대 5, 동시 의뢰 3이 **모두** 바뀐다
  - Pass: 다음 날 실제 출석 인원과 열린 의뢰 수에 반영된다

## Test Evidence

`tests/unit/domain/guild.test.ts` (비용·정원) +
`production/qa/evidence/recruit-expand-evidence.md` (UI)
**Status**: [ ] 미작성

## Dependencies

- Depends on: Story 010, 012
- Unlocks: 없음 (리프 노드 — 그래서 절단이 안전하다)
