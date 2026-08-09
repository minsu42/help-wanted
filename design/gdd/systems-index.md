# Systems Index: Help Wanted

> **Status**: In Review — 2026-08-09 전면 개정 반영 중
> **Created**: 2026-08-08
> **Last Updated**: 2026-08-09
> **Source Concept**: `design/gdd/game-concept.md` (2026-08-09 전면 개정판)
> **Source Plan**: `production/roadmap.md` (P0~P8 단계 — 이 문서의 "Phase" 열은
> roadmap의 단계를 그대로 참조한다)

---

> **2026-08-09 개정 — 3일 마감 스코프를 roadmap.md의 P0~P8 단계로 교체.**
>
> 이 문서는 원래 "3일 안에 무엇을 스킵하는가"를 기준으로 티어(Tier 0/1/2/Full
> Vision)를 나눴다. 그 제약이 풀리면서 티어 체계의 존재 이유가 사라졌다 —
> 이제 스코프를 깎는 문제가 아니라 **순서와 의존 관계**의 문제이므로,
> `production/roadmap.md`가 이미 정의한 P0~P8 단계를 그대로 이 문서의 "Phase"
> 열로 가져온다. 옛 Tier 체계는 §Priority Tiers에 기록만 남기고 폐기한다.
>
> **새로 추가된 것**: 청취(#21), 의뢰인 직업(#22), 무지 격차(#23), 질문
> 카탈로그(#24), 의뢰서 작성(#25), 길드마스터북(#26), 하루 행동 횟수(#27),
> 대기 목록(#28), 고정비(#29), 모험가 가치관(#30), 배정 거부·이탈(#31), 상실
> 반응(#32), 세력 평판(#33), 세계 변화(#34), 길드 장부 조회(#35), 메인 스토리
> 3막(#36).
>
> **폐기된 것**: 선불 축(#37), 잔금 미지급(#38), 15일 고정 회차(#39) — 이 셋은
> 독립된 시스템이 아니라 기존 시스템(#9, #13, #12) 내부의 하위 규칙이었으므로,
> 표에는 "폐기된 하위 규칙"으로 별도 행을 만들어 기록만 남긴다. 배경 사건
> 척추(#18)는 세력 평판(#33)·세계 변화(#34)·메인 스토리 3막(#36)이 더 크고
> 정확한 형태로 대체하므로 상태를 폐기로 바꾼다.

---

## Overview

`Help Wanted`는 신임 길드마스터가 접수창구에서 **청취로 의뢰서를 작성하고**,
그 의뢰서를 근거로 흥정하고, 모험가를 파견하는 창발 서사 경영 시뮬레이션이다.
기계적 범위는 좁고 깊다 — 화면 전환이나 필드 이동이 없는(기둥 2) 대신,
청취·협상·정보·시뮬레이션이 서로를 강하게 참조한다.

핵심 루프는 다음과 같이 확장되었다:

```
청취(캐묻기) → 의뢰서 작성(판단 칸) → 흥정(근거 기반) → 파견
  → 3단 대조 결과 → 고정비 정산 → 세력 평판·관계 갱신 → 다음 날
  (며칠~몇 주 뒤) → 그 의뢰의 세계 변화가 새 의뢰로 돌아온다
```

이 순환을 **15일 고정 회차가 아니라 막(act) 전환**으로 묶어 8~15시간
캠페인을 이룬다. 캠페인 길이는 `game-concept.md`의 Open Question 2에 따라
아직 미검증이다.

**스코프 방식의 변화**: 3일 마감판은 표준 `/design-system` 8섹션 GDD 파이프라인을
스킵하고 핵심 3개 시스템만 `/quick-design` 경량 스펙으로 대체했다. 이 결정은
**유지한다** — 이번 확장에서도 정식 GDD 대신 `design/quick-specs/`의 경량
스펙을 계속 쓴다. 다만 스펙 개수는 6종 이상으로 늘어난다 (`production/roadmap.md`
「문서 작업 목록」 참조). 아래 "Design Doc" 열의 "⬜ 미작성"은 누락이 아니라
아직 순서가 오지 않은 것이다 — roadmap의 각 단계는 구현 전에 스펙을 먼저
쓰도록 강제한다("문서를 먼저 쓴다" 원칙).

36개 시스템(+ 폐기 기록 3건) 중 대부분이 아직 Not Started다. 이미 구현되어
재사용 가능한 기반 시스템(#1~#6, #19~#20의 골격)이 있고, 그 위에 P1~P8이
순서대로 쌓인다. **게이트를 건너뛰지 않는다** — P3 이후 플레이테스트 없이
P4로 가지 않는다 (roadmap.md의 GATE 절 참조).

---

## Systems Enumeration

| # | System Name | Category | Phase | Status | Design Doc | Depends On |
|---|-------------|----------|-------|--------|------------|------------|
| 1 | 시드 PRNG | Core | 기반 | **Implemented** | `src/domain/rng.ts` | — |
| 2 | 밸런스 데이터 (balance.json) | Core | 기반 | Not Started | — | — |
| 3 | 에이전트 시뮬레이션 | Gameplay | 기반 | Not Started | — | 밸런스 데이터, 시드 PRNG |
| 4 | 의뢰인 생성 | Gameplay | 기반 (P1에서 직업 확장) | Not Started | — | 에이전트 시뮬레이션, 밸런스 데이터, 시드 PRNG, 의뢰인 직업(#22) |
| 5 | 모험가 명부 | Gameplay | 기반 (P4에서 가치관 확장) | Not Started | — | 에이전트 시뮬레이션, 밸런스 데이터, 시드 PRNG |
| 6 | 서술 텍스트 조립 | Narrative | 기반 | Not Started | — | 에이전트 시뮬레이션 |
| 7 | 의뢰 생성 | Gameplay | **P1 (개정 필요)** | Not Started | — | 의뢰인 생성, 밸런스 데이터, 시드 PRNG, 무지 격차(#23) |
| 8 | 소문 네트워크 | Gameplay | **P4 (개정 필요 — 출처 이동)** | In Design (개정 대상) | `design/quick-specs/rumor-network-2026-08-08.md` | 모험가 명부, 의뢰 생성, 서술 텍스트 조립, 모험가 가치관(#30) |
| 9 | 계약 협상 (흥정 시스템) | Gameplay | **P0/P3 (개정 필요 — 선불 축 제거, 근거 기반 확장)** | In Design (개정 대상) | `design/quick-specs/contract-negotiation-2026-08-08.md` | 의뢰 생성, 의뢰서 작성(#25), 청취(#21) |
| 10 | 파견 판정 | Gameplay | **P0/P2 (개정 필요 — 잔금 판정 제거, 의뢰서 입력 반영)** | In Design (개정 대상) | `design/quick-specs/dispatch-resolution-2026-08-08.md` | 계약 협상, 모험가 명부, 시드 PRNG, 의뢰서 작성(#25), 모험가 가치관(#30) |
| 11 | 결과 대조 (로직) | Narrative | **P2 (2단 → 3단 확장)** | Not Started | — | 의뢰 생성, 파견 판정, 의뢰서 작성(#25) |
| 12 | 일일 진행 (Day Cycle) | Progression | **P0/P3/P7 (개정 필요 — 15일 고정 제거)** | Not Started | — | 의뢰 생성, 하루 행동 횟수(#27), 고정비(#29) |
| 13 | 길드 경제 (구 명성·자금 경제) | Economy | **P0/P3/P5 (개정 필요 — 잔금 미지급 제거, 고정비 추가, 세력 평판으로 대체 예정)** | Not Started | — | 파견 판정, 계약 협상, 고정비(#29), 세력 평판(#33) |
| 14 | 창구 화면 | UI | P1 이후 지속 확장 | Not Started | — | 계약 협상, 청취(#21), 의뢰서 작성(#25) |
| 15 | 길드 홀 화면 | UI | 기반 (구현됨) / P4 확장 | Implemented (아트 패스 완료, 로직 확장 대기) | — | 소문 네트워크, 모험가 가치관(#30) |
| 16 | 파견/결과 화면 | UI | **P2 (3단 대조 반영)** | Not Started | — | 파견 판정, 결과 대조 |
| 17 | 엔딩 (기본 텍스트) | Narrative | 기반 / **P7 (다양화)** | Not Started | — | 길드 경제, 일일 진행, 세력 평판(#33), 메인 스토리 3막(#36) |
| 18 | ~~배경 사건 척추~~ | Narrative | — | **폐기 (2026-08-09)** — → 세력 평판(#33) · 세계 변화(#34) · 메인 스토리 3막(#36)이 대체 | — | 일일 진행, 의뢰 생성, 엔딩 |
| 19 | 모험가 영입 | Economy | 기반 (구현) / **P4 (하이브리드 확장)** | In Design (개정 대상) | `design/quick-specs/guild-scale-and-difficulty-2026-08-08.md` §3 | 모험가 명부, 길드 경제, 소문 네트워크, 모험가 가치관(#30) |
| 20 | 길드 확장 | Economy | 기반 (구현) | In Design | `design/quick-specs/guild-scale-and-difficulty-2026-08-08.md` §4 | 모험가 영입, 길드 경제 |
| 21 | **청취 (Intake)** *(신설)* | Gameplay | **P1** | Not Started | `design/quick-specs/intake-system-*.md` (⬜ 미작성) | 에이전트 시뮬레이션, 의뢰인 생성, 밸런스 데이터, 시드 PRNG, 질문 카탈로그(#24) |
| 22 | **의뢰인 직업 (Client Occupation)** *(신설)* | Gameplay | **P1** | Not Started | intake-system-*.md에 포함 예정 | 에이전트 시뮬레이션, 밸런스 데이터 |
| 23 | **무지 격차 (Ignorance Gap)** *(신설)* | Gameplay | **P1** | Not Started | intake-system-*.md에 포함 예정 | 의뢰인 직업(#22), 의뢰 생성 |
| 24 | **질문 카탈로그 (Question Catalog)** *(신설)* | Core/Narrative | **P1** | Not Started | intake-system-*.md에 포함 예정 (`questions.json`) | 서술 텍스트 조립, 밸런스 데이터 |
| 25 | **의뢰서 작성 (Commission Form)** *(신설)* | Gameplay/UI | **P1** | Not Started | `design/quick-specs/commission-form-*.md` (⬜ 미작성) | 청취(#21), 의뢰 생성 |
| 26 | **길드마스터북 (Guildmaster's Handbook)** *(신설)* | UI/Narrative | **P1** | Not Started | commission-form-*.md에 포함 예정 — Open Question 8 (노출 시점) 미해결 | 질문 카탈로그(#24), 청취(#21) |
| 27 | **하루 행동 횟수 (Daily Action Budget)** *(신설)* | Progression | **P3** | Not Started | `design/quick-specs/day-economy-*.md` (⬜ 미작성) | 일일 진행, 청취(#21), 계약 협상 |
| 28 | **대기 목록 (Waiting Queue)** *(신설)* | Gameplay | **P3** | Not Started | day-economy-*.md에 포함 예정 | 하루 행동 횟수(#27), 의뢰 생성 |
| 29 | **고정비 (Fixed Costs)** *(신설)* | Economy | **P3** | Not Started | day-economy-*.md에 포함 예정 | 길드 경제(#13), 모험가 명부 |
| 30 | **모험가 가치관 (Adventurer Values)** *(신설)* | Gameplay | **P4** | Not Started | `design/quick-specs/adventurer-values-*.md` (⬜ 미작성) | 에이전트 시뮬레이션, 모험가 명부 |
| 31 | **배정 거부·이탈 (Assignment Refusal & Departure)** *(신설)* | Gameplay | **P4** | Not Started | adventurer-values-*.md에 포함 예정 | 모험가 가치관(#30), 파견 판정, 의뢰서 작성(#25) |
| 32 | **상실 반응 (Loss Reaction)** *(신설)* | Narrative | **P4** | Not Started | adventurer-values-*.md에 포함 예정 (자료구조 기존 존재: `types.ts`, `text.json`의 `lostComrade`) | 에이전트 시뮬레이션, 파견 판정 |
| 33 | **세력 평판 (Faction Reputation ×6)** *(신설)* | Economy/Narrative | **P5** | Not Started | `design/quick-specs/faction-reputation-*.md` (⬜ 미작성) | 길드 경제(#13), 모험가 가치관(#30), 의뢰인 직업(#22) |
| 34 | **세계 변화 (World Consequences)** *(신설)* | Narrative/Gameplay | **P6** | Not Started | `design/quick-specs/world-consequences-*.md` (⬜ 미작성) | 파견 판정, 결과 대조(#11), 세력 평판(#33), 소문 네트워크 |
| 35 | **길드 장부·과거 기록 조회 (Ledger Lookup)** *(신설)* | UI | **P6** | Not Started | world-consequences-*.md에 포함 예정 | 세계 변화(#34) |
| 36 | **메인 스토리 3막 (Main Story Acts)** *(신설)* | Narrative | **P7** | Not Started | — (`game-concept.md` Core Mechanics §12, Long-Term 루프) | 일일 진행(막 전환), 세력 평판(#33), 세계 변화(#34), 엔딩(#17) |
| 37 | ~~선불 축 (Advance Payment Axis)~~ | Gameplay | — | **폐기 (2026-08-09)** — 독립 시스템이 아니라 계약 협상(#9) 내부 축이었음 | `contract-negotiation-2026-08-08.md` (개정 대상 — `Offer.advanceRatio`, `wAdvance`, `askAdvance` 등 제거) | 잔금 미지급(#38)과 같이 서고 같이 눕는다 |
| 38 | ~~잔금 미지급 (Unpaid Balance)~~ | Economy | — | **폐기 (2026-08-09)** — 길드 경제(#13) 내부 판정 경로였음 | `dispatch-resolution-2026-08-08.md`, `contract-negotiation-2026-08-08.md` (둘 다 개정 대상 — `WealthReveal`, `knownWealth`, `rng.chance(client.wealth)` 제거) | 선불 축(#37)의 페이오프였다 |
| 39 | ~~15일 고정 회차 (Fixed 15-Day Session)~~ | Progression | — | **폐기 (2026-08-09)** — 일일 진행(#12) 내부 종료 조건이었음 | `game-concept.md` 구판 | 메인 스토리 3막(#36)의 막 전환 조건으로 대체 |

---

## Categories

| Category | Description | Systems in This Project |
|----------|-------------|--------------------------|
| **Core** | 모든 것이 딛고 서는 기반 | 시드 PRNG, 밸런스 데이터, 질문 카탈로그 |
| **Gameplay** | 실제로 플레이어가 판단을 내리는 곳 | 에이전트 시뮬레이션, 의뢰인 생성, 의뢰인 직업, 무지 격차, 모험가 명부, 의뢰 생성, 소문 네트워크, 계약 협상, 파견 판정, 청취, 의뢰서 작성, 대기 목록, 모험가 가치관, 배정 거부·이탈 |
| **Progression** | 세션이 시간에 따라 어떻게 진행되는가 | 일일 진행, 하루 행동 횟수 |
| **Economy** | 자금·평판의 순환과 난이도 스케일링 | 길드 경제, 고정비, 세력 평판, 모험가 영입, 길드 확장 |
| **Narrative** | 텍스트로만 전달되는 서사 (기둥 2·4) | 서술 텍스트 조립, 결과 대조, 엔딩, 상실 반응, 세계 변화, 메인 스토리 3막, 길드마스터북 |
| **UI** | 창구·길드홀·파견·의뢰서 화면 | 창구 화면, 길드 홀 화면, 파견/결과 화면, 길드마스터북, 길드 장부 조회 |

*(템플릿의 Persistence/Audio/Meta 카테고리는 이 프로젝트 스코프에 해당 시스템이
없어 생략했다 — 저장/불러오기 없음, 오디오는 P8 폴리시 단계.)*

---

## Priority Tiers *(폐기 — 기록용으로만 유지)*

> **2026-08-09 폐기.** 이 표는 3일 마감 제출본을 전제로 스코프를 깎기 위해
> 만들어졌다. 시간 제약이 풀리면서 "무엇을 잘라내는가"가 아니라 "무슨 순서로
> 쌓는가"가 문제가 되었고, 그 답은 `production/roadmap.md`의 P0~P8 단계다.
> 위 Systems Enumeration의 "Phase" 열이 이 표를 대체한다.

| Tier (구) | Definition (구) | 대응 마일스톤 (구) |
|------|------------|----------------|
| Tier 0 — MVP | 제출본에 반드시 필요 | 3일 마감 (제출) — **더 이상 유효하지 않음** |
| Tier 1 — 여유분 | 시간이 남으면 추가 | +3~5일 — **더 이상 유효하지 않음** |
| Tier 2 — 예선 통과 후 | 스코프 밖 | +3~6주 — **더 이상 유효하지 않음** |
| Full Vision | 장기 비전 | 2~4개월 — **더 이상 유효하지 않음** |

### 현재 유효한 단계 정의 — `production/roadmap.md` 참조

| Phase | 무엇을 | 완료 기준(요지) |
|-------|--------|----------------|
| P0 | 정리 — 선불 축·잔금 미지급·15일 고정 제거, 미커밋 변경 커밋 | `npm run check` 통과, 폐기 식별자 잔존 0 |
| P1 | 청취 + 의뢰서 작성 | 마르타 시나리오 완주, 막다른 길 없음, 결정론 |
| P2 | 책임 — 의뢰서 → 파견 판정 연동, 3단 대조 | 캐묻기 차이가 파견 결과를 바꾼다 |
| P3 | 압박 — 처리량 + 고정비 | "대충 넘기고 다음 손님"이 유효 전략 |
| **GATE** | Core Hypothesis 검증 (플레이테스트) | *"내가 C급이라고 적었다"* 문장이 나온다 |
| P4 | 사람 — 가치관·관계·상실 | 배정 거부·이탈이 실제로 발생 |
| P5 | 세력 평판 | 세력 간 트레이드오프가 실제로 작동 |
| P6 | 세계 변화 | 후과의 인과를 플레이어가 스스로 알아차림 |
| P7 | 메인 스토리 3막 | 처음부터 끝까지 완주 가능 |
| P8 | 폴리시 — 아트·오디오·온보딩·접근성·밸런스·성능 | — |

---

## Dependency Map

### Foundation Layer (의존성 없음)

1. **시드 PRNG** *(구현 완료)* — 결정론 요구의 기반. 모든 절차 생성·판정이 여기서 난수를 뽑음
2. **밸런스 데이터 (balance.json)** — 하드코딩 금지 규칙의 유일한 방어선
3. **에이전트 시뮬레이션** — 모험가·의뢰인이 공유하는 데이터 스키마(목표/성격/인맥/기억). 이 스키마가 흔들리면 하위 전부가 흔들림
4. **질문 카탈로그** *(신설)* — 슬롯 단위 공용 질문 데이터. 의뢰 종류와 독립적으로 존재해야 조합 폭발을 막는다 (`game-concept.md` Technical Challenges #1)

### Core Layer (Foundation에만 의존)

1. **의뢰인 생성** — depends on: 에이전트 시뮬레이션, 밸런스 데이터, 시드 PRNG, **의뢰인 직업**(신설)
2. **의뢰인 직업** *(신설)* — depends on: 에이전트 시뮬레이션, 밸런스 데이터
3. **모험가 명부** — depends on: 에이전트 시뮬레이션, 밸런스 데이터, 시드 PRNG
4. **서술 텍스트 조립** — depends on: 에이전트 시뮬레이션 (이름·감정·성격 태그를 문장에 대입)
5. **의뢰 생성** — depends on: 의뢰인 생성(숨은 상태 소비), 밸런스 데이터, 시드 PRNG, **무지 격차**(신설)
6. **무지 격차** *(신설)* — depends on: 의뢰인 직업 (직업이 무지 분포를 정한다), 의뢰 생성

### Intake Layer (Core에 의존) *(신설 — P1)*

1. **청취** — depends on: 에이전트 시뮬레이션, 의뢰인 생성, 질문 카탈로그, 밸런스 데이터, 시드 PRNG
2. **의뢰서 작성** — depends on: 청취(받아쓰기 칸의 원천), 의뢰 생성
3. **길드마스터북** — depends on: 질문 카탈로그, 청취

### Feature Layer (Core/Intake에 의존)

1. **소문 네트워크** — depends on: 모험가 명부, 의뢰 생성, 서술 텍스트 조립, **모험가 가치관**(P4에서 추가)
2. **계약 협상** — depends on: 의뢰 생성, **의뢰서 작성**(근거의 원천), 청취(소문 없이도 청취 근거만으로 흥정 가능해야 함)
3. **파견 판정** — depends on: 계약 협상, 모험가 명부, 시드 PRNG, **의뢰서 작성**(적힌 위험도가 준비도를 결정), **모험가 가치관**(P4에서 배정 거부 추가)
4. **결과 대조 (로직)** — depends on: 의뢰 생성, 파견 판정, **의뢰서 작성**(3단 대조의 가운데 칸)
5. **일일 진행** — depends on: 의뢰 생성, **하루 행동 횟수**(신설), **고정비**(신설)
6. **하루 행동 횟수** *(신설)* — depends on: 일일 진행, 청취, 계약 협상 (질문·제안이 각 1칸을 소비)
7. **대기 목록** *(신설)* — depends on: 하루 행동 횟수, 의뢰 생성
8. **고정비** *(신설)* — depends on: 길드 경제, 모험가 명부
9. **길드 경제** — depends on: 파견 판정, 계약 협상, 고정비

### Relationship Layer (Feature에 의존) *(신설 — P4)*

1. **모험가 가치관** — depends on: 에이전트 시뮬레이션, 모험가 명부
2. **배정 거부·이탈** — depends on: 모험가 가치관, 파견 판정, 의뢰서 작성
3. **상실 반응** — depends on: 에이전트 시뮬레이션, 파견 판정

### Faction & World Layer (Relationship에 의존) *(신설 — P5/P6)*

1. **세력 평판** — depends on: 길드 경제, 모험가 가치관, 의뢰인 직업
2. **세계 변화** — depends on: 파견 판정, 결과 대조, 세력 평판, 소문 네트워크
3. **길드 장부·과거 기록 조회** — depends on: 세계 변화

### Presentation Layer (Feature를 감쌈)

1. **창구 화면** — depends on: 계약 협상, 청취, 의뢰서 작성
2. **길드 홀 화면** — depends on: 소문 네트워크, 모험가 가치관
3. **파견/결과 화면** — depends on: 파견 판정, 결과 대조

### Narrative Spine Layer (모든 것에 의존) *(신설 — P7)*

1. **메인 스토리 3막** — depends on: 일일 진행(막 전환), 세력 평판, 세계 변화, 엔딩
2. **엔딩** — depends on: 길드 경제, 일일 진행, 세력 평판, 메인 스토리 3막

---

## Recommended Design Order

이 표는 `production/roadmap.md`의 단계 순서를 시스템 단위로 펼친 것이다. 각
행의 "Roadmap Phase" 열이 곧 진행 순서이며, 같은 Phase 안에서는 번호 순서를
권장하되 엄격하지 않다.

| Order | System | Roadmap Phase | Layer | Agent(s) | Est. Effort |
|-------|--------|----------------|-------|----------|-------------|
| 1 | 시드 PRNG | 기반 | Foundation | — | 완료 |
| 2 | 밸런스 데이터 | 기반 | Foundation | systems-designer / economy-designer | S (재사용) |
| 3 | 에이전트 시뮬레이션 | 기반 | Foundation | gameplay-programmer | S (재사용) |
| 4 | — P0 정리 (선불 축·잔금 미지급·15일 고정 제거) | **P0** | 전체 | gameplay-programmer / lead-programmer | S |
| 5 | 질문 카탈로그 | P1 | Foundation | systems-designer | M |
| 6 | 의뢰인 직업 | P1 | Core | systems-designer / gameplay-programmer | S |
| 7 | 무지 격차 | P1 | Core | systems-designer | S |
| 8 | 의뢰 생성 (개정) | P1 | Core | systems-designer | M |
| 9 | 청취 | P1 | Intake | gameplay-programmer / systems-designer | M |
| 10 | 의뢰서 작성 | P1 | Intake | ui-programmer / gameplay-programmer | M |
| 11 | 길드마스터북 | P1 | Intake | ui-programmer / writer | S |
| 12 | 창구 화면 (개정) | P1 | Presentation | ui-programmer | M |
| 13 | 파견 판정 (개정 — 의뢰서 입력 반영) | P2 | Feature | systems-designer → gameplay-programmer | M |
| 14 | 결과 대조 (3단 확장) | P2 | Feature | ui-programmer | M |
| 15 | 파견/결과 화면 (3단 반영) | P2 | Presentation | ui-programmer | M |
| 16 | 하루 행동 횟수 | P3 | Feature | gameplay-programmer | S |
| 17 | 대기 목록 | P3 | Feature | gameplay-programmer | S |
| 18 | 고정비 | P3 | Feature | economy-designer | S |
| 19 | 일일 진행 (개정 — 하루 마감 화면) | P3 | Feature | gameplay-programmer | S |
| 20 | 계약 협상 (개정 — 근거 기반 확장) | P3 | Feature | systems-designer → gameplay-programmer | M |
| — | **GATE — Core Hypothesis 플레이테스트** | **GATE** | — | producer / game-designer | — |
| 21 | 모험가 가치관 | P4 | Relationship | systems-designer / narrative-director | M |
| 22 | 배정 거부·이탈 | P4 | Relationship | gameplay-programmer | S |
| 23 | 상실 반응 | P4 | Relationship | writer / gameplay-programmer | S (자료구조 재사용) |
| 24 | 소문 네트워크 (개정 — 출처 이동) | P4 | Feature | systems-designer → gameplay-programmer | M |
| 25 | 모험가 영입 (개정 — 하이브리드) | P4 | Economy | economy-designer / gameplay-programmer | S |
| 26 | 세력 평판 | P5 | Faction & World | economy-designer / narrative-director | L |
| 27 | 길드 경제 (개정 — 세력 평판 통합) | P5 | Feature | economy-designer | M |
| 28 | 세계 변화 | P6 | Faction & World | game-designer / systems-designer | L |
| 29 | 길드 장부·과거 기록 조회 | P6 | UI | ui-programmer | S |
| 30 | 메인 스토리 3막 | P7 | Narrative Spine | narrative-director / game-designer | L |
| 31 | 엔딩 (다양화) | P7 | Narrative Spine | writer | M |
| 32 | 폴리시 일체 (아트·오디오·온보딩·접근성·밸런스·성능) | P8 | 전체 | art-director / audio-director / ux-designer | L |

*(Effort: S = 1세션, M = 2~3세션, L = 4세션 이상 또는 새 ADR 가능성. 이 추정은
roadmap.md에 시간 계획이 없는 것과 별개로 순수 작업량 감이다.)*

> **길드 확장(#20)은 이 표에 없다** — 기존 구현이 이미 유효하고 이번 개정으로
> 규칙이 바뀌지 않았다 (정원·홀 출석 최대·동시 진행 의뢰는 그대로 유효).

---

## Circular Dependencies

없음. 새로 생긴 잠재 순환 후보도 모두 단방향으로 해소된다:

- 청취 → 의뢰서 작성 (받아쓰기 칸이 청취 결과를 옮겨오지만, 의뢰서 작성이 청취
  로직에 데이터를 되돌리지 않음 — 판단 칸은 플레이어 입력이지 청취의 출력이 아님)
- 의뢰서 작성 → 파견 판정 → 결과 대조 (판정이 결과 대조에 데이터를 넘기지만,
  결과 대조가 판정 로직을 바꾸지 않음. 다음 판단에 영향을 주는 것은 **플레이어**다)
- 세계 변화 → 세력 평판 (세계 변화가 세력 평판을 갱신하지만, 세력 평판이 세계
  변화 규칙 테이블을 직접 쓰지 않음 — 다음 의뢰 생성이 세력 평판을 읽는 것은
  별도 방향)
- 소문 네트워크 → 계약 협상 (기존과 동일 — 정보가 협상의 입력이 되지만, 협상이
  소문 네트워크에 데이터를 되돌리지 않음)

---

## High-Risk Systems

| System | Risk Type | Risk Description | Mitigation |
|--------|-----------|-------------------|------------|
| 의뢰서 작성 (#25) | Design | **클릭 노동이 될 위험 — 이번 개정의 1순위 리스크** (`game-concept.md` Design Risks) | 받아쓰기/판단 칸 분리, 타입 제약 토큰, 처리량 압박, 반복 압축. 검증 기준은 `design/research/paperwork-ux-2026-08-09.md` §6 |
| 청취 (#21) / 질문 카탈로그 (#24) | Technical | 질문 카탈로그의 조합 폭발 — 의뢰 종류마다 질문을 새로 쓰면 콘텐츠 작성량이 터짐 | 질문은 슬롯 단위로 공용, 의뢰 종류는 어느 슬롯이 열리는지만 정함 |
| 세계 변화 (#34) | Design/Technical | 인과가 안 보이면 후과가 무작위 사건처럼 느껴짐 (기둥 7의 실패 모드). 후과의 후과를 무한히 따라가면 디버깅 불가 | 후과가 나타날 때 원인이 된 의뢰를 명시적으로 참조. 깊이 1로 제한 |
| 배정 거부·이탈 (#31) / 위험도를 낮춰 적는 유인 | Design | 낮게 적으면 값을 더 받고 모험가도 거부하지 않음 — 대가가 약하면 지배 전략이 됨 (`game-concept.md` Design Risks) | 오판의 사망률 연동을 충분히 가파르게. 모험가들이 기억한다 (Memory 기록) |
| 세력 평판 (#33) | Technical | 세력 6종 × 의뢰 종류의 밸런싱은 손으로 맞추기 어려움 | 평판 변동을 데이터 테이블로 분리, 자동 시뮬레이션으로 회귀 검사 |
| 에이전트 시뮬레이션 (#3) | Design | 창발이 무작위처럼 느껴질 위험 — 병목 시스템이라 여기서 잘못 잡으면 소문 네트워크·세계 변화까지 전부 다시 손봐야 함 | 최소 스펙 고정: 목표 1개 + 성격 태그 2개 + 인맥 1~2개. 결과 대조 화면으로 인과를 명시적으로 노출 |
| 소문 네트워크 (#8) | Technical | 전파 그래프 복잡도 폭발 (3자 전파·시간 감쇠·왜곡 누적을 다 넣으면 디버깅 불가) | 1홉 전파만 유지. 3자 전파는 장기 비전으로 보류 |
| 서술 텍스트 조립 (#6) | Scope | 대화 콘텐츠 작성량 폭발 — 캠페인이 길어지며 위험이 오히려 커짐 | 산문 대화 금지. `{이름}은 {감정}하며 {행동}했다` 템플릿 조립만 |
| 책임이 억울함이 될 위험 (#25, #34 공통) | Design | 알 방법이 없었던 것 때문에 사람이 죽으면 플레이어가 속았다고 느낌 (기둥 6의 실패 모드) | 알아낼 수 있었던 경로가 항상 최소 하나는 존재. 결과 화면이 그 경로를 사후에 알려줌 |

---

## Progress Tracker

| Metric | Count |
|--------|-------|
| Total systems identified (신설 포함, 폐기 기록 제외) | **36** |
| 폐기 기록 (독립 시스템이 아니었던 하위 규칙) | 3 (#37 선불 축, #38 잔금 미지급, #39 15일 고정 회차) |
| Quick specs written | 4 (`design/quick-specs/`) — **전부 2026-08-08 구판, 개정 필요** |
| Quick specs 미작성 (신설 시스템용) | 6종 (`intake-system`, `commission-form`, `dispatch-resolution` 개정, `result-comparison`, `day-economy`, `contract-negotiation` 개정, `adventurer-values`, `rumor-network` 개정, `faction-reputation`, `world-consequences` — roadmap.md 「문서 작업 목록」 참조) |
| Systems implemented (완전 재사용 가능) | 1/36 (시드 PRNG) |
| Systems implemented (부분 재사용 — 개정 필요) | 6 (에이전트 시뮬레이션, 소문 네트워크, 계약 협상, 파견 판정, 길드 홀 화면, 모험가 영입/확장) |
| Design Doc 정합성 미확인 (선불·15일 전제) | 3종 (`contract-negotiation-2026-08-08.md`, `dispatch-resolution-2026-08-08.md`, `guild-scale-and-difficulty-2026-08-08.md`) |

나머지 시스템은 `production/roadmap.md`가 정의한 순서대로, 각 단계의 "먼저 쓸
문서"를 완성한 뒤 구현한다. 이 문서는 목록·의존 관계의 정합성만 책임지고,
개별 스펙 작성은 각 단계에서 `systems-designer` / `economy-designer` /
`gameplay-programmer`에게 위임한다.

---

## Next Steps

- [x] 시스템 목록 검토 및 승인 (2026-08-08)
- [x] 에이전트 스키마 확정 — `src/domain/types.ts` (2026-08-08)
- [x] `/quick-design` — 계약 협상 / 소문 네트워크 / 파견 판정 + 길드 규모·난이도 (2026-08-08, **구판 — 개정 필요**)
- [x] `game-concept.md` 전면 개정 + `production/roadmap.md` 신설 (2026-08-09)
- [x] `systems-index.md` P0~P8 반영 (2026-08-09, 이 문서)
- [ ] **P0** — 선불 축·잔금 미지급·15일 고정 회차 제거, 미커밋 변경 커밋
- [ ] **P1** — 청취·의뢰서 작성 스펙(`intake-system-*.md`, `commission-form-*.md`) 작성 후 구현
- [ ] **P2** — 의뢰서 → 파견 판정 연동 스펙 개정 후 구현, 3단 대조 화면
- [ ] **P3** — 하루 행동 횟수·고정비 스펙 작성 후 구현, 계약 협상 근거 기반 확장
- [ ] **GATE** — Core Hypothesis 플레이테스트 (roadmap.md 통과 기준 참조)
- [ ] P4~P8 — roadmap.md 순서대로 반복

> **참고**: 이 프로젝트는 `/design-system`(정식 8섹션 GDD) 파이프라인을 계속
> 스킵한다 — 이번 확장에서도 유효한 결정이다(위 Overview 참조). 대신
> `/quick-design`(스펙) → `/create-stories` → `/dev-story`로 직행하며, 각
> 단계의 "먼저 쓸 문서"가 곧 그 단계의 quick-design 결과물이다.
