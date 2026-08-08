# Systems Index: Help Wanted

> **Status**: Approved
> **Created**: 2026-08-08
> **Last Updated**: 2026-08-08
> **Source Concept**: design/gdd/game-concept.md

---

## Overview

`Help Wanted`는 신임 길드마스터가 접수창구에서 의뢰인을 흥정하고 모험가를 파견하는
창발 서사 경영 시뮬레이션이다. 기계적 범위는 좁고 깊다 — 화면 전환이나 필드 이동이
없는(기둥 2) 대신, 협상·정보·시뮬레이션이 서로를 강하게 참조한다. 핵심 루프는
**의뢰 생성 → 소문으로 정보 획득 → 그 정보로 협상 → 파견 → 결과 대조**의 순환이며,
이 순환을 15일간 반복하는 것이 세션 전체다.

**중요한 스코프 편차**: 이 문서는 표준 `/design-system` 파이프라인(시스템당 8섹션
GDD)을 전제하지 않는다. `game-concept.md`의 Next Steps에 이미 명시된 대로, 3일
마감이라는 제약 때문에 정식 GDD 저작은 스킵하고 핵심 3개 시스템(계약 협상 / 소문
네트워크 / 파견 판정)만 `/quick-design` 경량 스펙으로 대체한다. 나머지 시스템은
스토리 파일에 인라인으로 정의된다. 아래 "Design Doc" 열은 대부분 "—"이며, 이것은
누락이 아니라 의도된 스코프 결정이다.

18개 시스템 중 17개가 Tier 0(제출 필수)다 — 이미 `game-concept.md`의 MVP Definition
표가 타이트하게 스코프를 잡아두었기 때문에, 더 깎을 여지가 거의 없다는 것이
`/map-systems` 분해 과정에서 재확인되었다. Tier 1은 이번 세션에서 사용자가 요청한
"배경 사건 척추"(15일을 관통하는 3단계 배경 압력 + 엔딩 분기) 하나뿐이다.

---

## Systems Enumeration

| # | System Name | Category | Priority | Status | Design Doc | Depends On |
|---|-------------|----------|----------|--------|------------|------------|
| 1 | 시드 PRNG | Core | Tier 0 | **Implemented** | `src/domain/rng.ts` | — |
| 2 | 밸런스 데이터 (balance.json) | Core | Tier 0 | Not Started | — | — |
| 3 | 에이전트 시뮬레이션 (inferred) | Gameplay | Tier 0 | Not Started | — | 밸런스 데이터, 시드 PRNG |
| 4 | 의뢰인 생성 (inferred) | Gameplay | Tier 0 | Not Started | — | 에이전트 시뮬레이션, 밸런스 데이터, 시드 PRNG |
| 5 | 모험가 명부 (inferred) | Gameplay | Tier 0 | Not Started | — | 에이전트 시뮬레이션, 밸런스 데이터, 시드 PRNG |
| 6 | 서술 텍스트 조립 (inferred) | Narrative | Tier 0 | Not Started | — | 에이전트 시뮬레이션 |
| 7 | 의뢰 생성 (inferred) | Gameplay | Tier 0 | Not Started | — | 의뢰인 생성, 밸런스 데이터, 시드 PRNG |
| 8 | 소문 네트워크 | Gameplay | Tier 0 | **In Design** | `design/quick-specs/rumor-network-2026-08-08.md` | 모험가 명부, 의뢰 생성, 서술 텍스트 조립 |
| 9 | 계약 협상 (흥정 시스템) | Gameplay | Tier 0 | **In Design** | `design/quick-specs/contract-negotiation-2026-08-08.md` | 의뢰 생성 |
| 10 | 파견 판정 | Gameplay | Tier 0 | **In Design** | `design/quick-specs/dispatch-resolution-2026-08-08.md` | 계약 협상, 모험가 명부, 시드 PRNG |
| 11 | 결과 대조 (로직) (inferred) | Narrative | Tier 0 | Not Started | — | 의뢰 생성, 파견 판정 |
| 12 | 일일 진행 (Day Cycle) (inferred) | Progression | Tier 0 | Not Started | — | 의뢰 생성 |
| 13 | 명성·자금 경제 (inferred) | Economy | Tier 0 | Not Started | — | 파견 판정, 계약 협상 |
| 14 | 창구 화면 (inferred) | UI | Tier 0 | Not Started | — | 계약 협상 |
| 15 | 길드 홀 화면 (inferred) | UI | Tier 0 | Not Started | — | 소문 네트워크 |
| 16 | 파견/결과 화면 (inferred) | UI | Tier 0 | Not Started | — | 파견 판정, 결과 대조 |
| 17 | 엔딩 (기본 텍스트) (inferred) | Narrative | Tier 0 | Not Started | — | 명성·자금 경제, 일일 진행 |
| 18 | 배경 사건 척추 (inferred, 사용자 요청) | Narrative | **Tier 1** | Not Started | — | 일일 진행, 의뢰 생성, 엔딩 |
| 19 | 모험가 영입 (사용자 요청) | Economy | Tier 0 | **In Design** | `design/quick-specs/guild-scale-and-difficulty-2026-08-08.md` §3 | 모험가 명부, 명성·자금 경제, 소문 네트워크 |
| 20 | 길드 확장 (사용자 요청) | Economy | Tier 0 | **In Design** | `design/quick-specs/guild-scale-and-difficulty-2026-08-08.md` §4 | 모험가 영입, 명성·자금 경제 |

---

## Categories

| Category | Description | Systems in This Project |
|----------|-------------|--------------------------|
| **Core** | 모든 것이 딛고 서는 기반 | 시드 PRNG, 밸런스 데이터 |
| **Gameplay** | 실제로 플레이어가 판단을 내리는 곳 | 에이전트 시뮬레이션, 의뢰인 생성, 모험가 명부, 의뢰 생성, 소문 네트워크, 계약 협상, 파견 판정 |
| **Progression** | 세션이 시간에 따라 어떻게 진행되는가 | 일일 진행 |
| **Economy** | 명성·자금의 순환과 난이도 스케일링 | 명성·자금 경제 |
| **Narrative** | 텍스트로만 전달되는 서사 (기둥 2·4) | 서술 텍스트 조립, 결과 대조, 엔딩, 배경 사건 척추 |
| **UI** | 창구·길드홀·파견 화면 | 창구 화면, 길드 홀 화면, 파견/결과 화면 |

*(템플릿의 Persistence/Audio/Meta 카테고리는 이 프로젝트 스코프에 해당 시스템이
없어 생략했다 — 저장/불러오기 없음, MVP 오디오 없음.)*

---

## Priority Tiers

이 프로젝트는 표준 MVP/Vertical Slice/Alpha/Full Vision 대신 `game-concept.md`에
이미 정의된 자체 티어 체계를 그대로 쓴다.

| Tier | Definition | 대응 마일스톤 |
|------|------------|----------------|
| **Tier 0 — MVP** | 제출본에 반드시 필요. 없으면 핵심 루프나 차별점이 무너짐 | 3일 마감 (제출) |
| **Tier 1 — 여유분** | Day 3 시간이 남으면 추가 | +3~5일 |
| **Tier 2 — 예선 통과 후** | 이번 스코프 밖 | +3~6주 |
| **Full Vision** | 장기 비전 | 2~4개월 |

---

## Dependency Map

### Foundation Layer (의존성 없음)

1. **시드 PRNG** *(구현 완료)* — 결정론 요구의 기반. 모든 절차 생성·판정이 여기서 난수를 뽑음
2. **밸런스 데이터 (balance.json)** — 하드코딩 금지 규칙의 유일한 방어선
3. **에이전트 시뮬레이션** — 모험가·의뢰인이 공유하는 데이터 스키마(목표/성격/인맥/기억). 이 스키마가 흔들리면 하위 전부가 흔들림

### Core Layer (Foundation에만 의존)

1. **의뢰인 생성** — depends on: 에이전트 시뮬레이션, 밸런스 데이터, 시드 PRNG
2. **모험가 명부** — depends on: 에이전트 시뮬레이션, 밸런스 데이터, 시드 PRNG
3. **서술 텍스트 조립** — depends on: 에이전트 시뮬레이션 (이름·감정·성격 태그를 문장에 대입)
4. **의뢰 생성** — depends on: 의뢰인 생성(숨은 상태 소비), 밸런스 데이터, 시드 PRNG

### Feature Layer (Core에 의존)

1. **소문 네트워크** — depends on: 모험가 명부, 의뢰 생성, 서술 텍스트 조립
2. **계약 협상** — depends on: 의뢰 생성 (소문 네트워크의 정보는 입력으로 소비하나 구조적 필수 의존은 아님)
3. **파견 판정** — depends on: 계약 협상, 모험가 명부, 시드 PRNG
4. **결과 대조 (로직)** — depends on: 의뢰 생성, 파견 판정
5. **일일 진행** — depends on: 의뢰 생성
6. **명성·자금 경제** — depends on: 파견 판정, 계약 협상

### Presentation Layer (Feature를 감쌈)

1. **창구 화면** — depends on: 계약 협상
2. **길드 홀 화면** — depends on: 소문 네트워크
3. **파견/결과 화면** — depends on: 파견 판정, 결과 대조

### Polish Layer (모든 것에 의존)

1. **엔딩 (기본)** — depends on: 명성·자금 경제, 일일 진행
2. **배경 사건 척추** — depends on: 일일 진행, 의뢰 생성, 엔딩 *(Tier 1)*

---

## Recommended Design Order

| Order | System | Priority | Layer | Agent(s) | Est. Effort |
|-------|--------|----------|-------|----------|-------------|
| 1 | 시드 PRNG | Tier 0 | Foundation | — | 완료 |
| 2 | 밸런스 데이터 | Tier 0 | Foundation | systems-designer / economy-designer | S |
| 3 | 에이전트 시뮬레이션 | Tier 0 | Foundation | gameplay-programmer | S |
| 4 | 의뢰인 생성 | Tier 0 | Core | gameplay-programmer / systems-designer | S |
| 5 | 모험가 명부 | Tier 0 | Core | gameplay-programmer | S |
| 6 | 서술 텍스트 조립 | Tier 0 | Core | gameplay-programmer / writer | S |
| 7 | 의뢰 생성 | Tier 0 | Core | systems-designer | M |
| 8 | 소문 네트워크 | Tier 0 | Feature | systems-designer → gameplay-programmer | M *(quick-design 대상)* |
| 9 | 계약 협상 | Tier 0 | Feature | systems-designer → gameplay-programmer | M *(quick-design 대상)* |
| 10 | 파견 판정 | Tier 0 | Feature | systems-designer → gameplay-programmer | S *(quick-design 대상)* |
| 11 | 결과 대조 (로직) | Tier 0 | Feature | ui-programmer | S |
| 12 | 일일 진행 | Tier 0 | Feature | gameplay-programmer | S |
| 13 | 명성·자금 경제 | Tier 0 | Feature | economy-designer | S |
| 14 | 창구 화면 | Tier 0 | Presentation | ui-programmer | M |
| 15 | 길드 홀 화면 | Tier 0 | Presentation | ui-programmer | S |
| 16 | 파견/결과 화면 | Tier 0 | Presentation | ui-programmer | M |
| 17 | 엔딩 (기본) | Tier 0 | Polish | writer / gameplay-programmer | S |
| 18 | 모험가 영입 | Tier 0 | Feature | gameplay-programmer | S *(Day 2 후반)* |
| 19 | 길드 확장 | Tier 0 | Feature | economy-designer / gameplay-programmer | S *(Day 2 후반)* |
| 20 | 배경 사건 척추 | Tier 1 | Polish | game-designer / writer | S *(시간 남으면)* |

> **절단 순서**: 일정이 밀리면 **길드 확장 → 모험가 영입 → 배경 사건 척추** 순으로
> 잘라낸다. 앞의 둘을 잘라내면 자금 싱크가 사라지지만 핵심 루프(협상 → 파견 → 결과)는
> 온전히 남는다. Day 2 저녁에 판단할 것.

*(Effort: S = 1세션, M = 2~3세션. 3일 마감이므로 대부분 S 목표로 압축했다.)*

---

## Circular Dependencies

없음. 확인된 잠재 순환 후보 두 가지 모두 단방향으로 해소됨:
- 소문 네트워크 → 계약 협상 (정보가 협상의 입력이 되지만, 협상이 소문 네트워크에 데이터를 되돌리지 않음)
- 배경 사건 척추 → 엔딩 (척추가 엔딩 분기를 결정하지만, 엔딩이 척추에 영향을 주지 않음)

---

## High-Risk Systems

| System | Risk Type | Risk Description | Mitigation |
|--------|-----------|-------------------|------------|
| 에이전트 시뮬레이션 | Design | 창발이 무작위처럼 느껴질 위험 (game-concept.md Design Risk #1) — 병목 시스템이라 여기서 잘못 잡으면 소문 네트워크까지 전부 다시 손봐야 함 | 최소 스펙 고정: 목표 1개 + 성격 태그 2개 + 인맥 1~2개. 결과 대조 화면으로 인과를 명시적으로 노출 |
| 의뢰 생성 (숨은 진실) | Design | 공개/실제 정보 격차가 너무 크면 도박, 너무 작으면 무의미 | 초기값 실제 위험도+실제 지불여력 2개 축으로 시작, Day 2 튜닝 |
| 소문 네트워크 | Technical | 전파 그래프 복잡도 폭발 (3자 전파·시간 감쇠·왜곡 누적을 다 넣으면 디버깅 불가) | MVP는 1홉 전파만. 3자 전파는 Tier 2 |
| 서술 텍스트 조립 | Scope | 대화 콘텐츠 작성량 폭발 — 3일 프로젝트 1순위 킬러 | 산문 대화 금지. `{이름}은 {감정}하며 {행동}했다` 템플릿 조립만 |
| 배경 사건 척추 | Scope | 요청대로 만들다 보면 분기 대화 트리로 번질 위험 (Anti-Pillar 위반) | 3단계 고정, 게시판 텍스트로만 전달, 인물 생사와 무관한 조건분기. Tier 1 — 시간 없으면 통째로 컷 |

---

## Progress Tracker

| Metric | Count |
|--------|-------|
| Total systems identified | **20** |
| Quick specs written | 4 (`design/quick-specs/`) |
| Tier 0 systems specced | **5/19** (#8 소문, #9 협상, #10 파견, #19 영입, #20 확장) |
| Tier 1 systems specced | 0/1 |
| Systems implemented | 1/20 (시드 PRNG) |

나머지 15개 Tier 0 시스템은 별도 스펙 없이 **스토리 파일에 인라인 정의**한다
(3일 마감 스코프 결정). 스펙을 쓴 5개는 공식·확률·상호작용이 얽혀 있어 글로
고정하지 않으면 구현 중에 흔들리는 것들이다.

---

## Next Steps

- [x] 시스템 목록 검토 및 승인 (2026-08-08)
- [x] 에이전트 스키마 확정 — `src/domain/types.ts` (2026-08-08)
- [x] `/quick-design` — 계약 협상 / 소문 네트워크 / 파견 판정 + 길드 규모·난이도 (2026-08-08)
- [ ] `/create-stories` — Tier 0 19개 시스템(+Tier 1 척추 1개)을 스토리 단위로 분할
- [ ] `/dev-story` 반복 — 설계 순서(위 표)대로 구현
- [ ] Day 1 종료 시 "의뢰 받고 사람 보내서 결과 보기" 플레이 가능 빌드 확인

> **참고**: 이 프로젝트는 `/design-system`(정식 8섹션 GDD) 파이프라인을 스킵하기로
> 이미 결정했으므로(`game-concept.md` Next Steps), 표준 `/map-systems` 워크플로의
> Phase 6("개별 시스템 GDD 설계로 핸드오프")는 적용하지 않는다. 대신 위 Next Steps대로
> `/quick-design` → `/create-stories` → `/dev-story`로 직행한다.
