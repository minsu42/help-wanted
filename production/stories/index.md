# 스토리 인덱스 — Help Wanted

> **2026-08-09 재작성.** 원래 이 문서는 Day 1/2/3 구분, 시간 견적(11h/11.5h/…),
> "절단 순서", "Day 1 종료 게이트"로 조직되어 있었다. **3일 마감이 해제되면서 그
> 축들을 지탱하던 전제가 전부 사라졌다.** 게다가 19개 전부 상태가 `Ready`로 적혀
> 있었으나 실제로는 16개가 구현되어 배포까지 갔다.
>
> 이 문서가 지금 소유하는 것은 하나뿐이다 — **어느 스토리가 어느 단계에 속하는가.**
> 순서와 의존 관계는 `production/roadmap.md`가 소유한다.

---

## 1. 2026-08-08 MVP (as-built)

story-001~019는 3일 마감판의 **역사적 기록**이다. 본문·수락 기준·구현 편차·테스트
증거는 그 시점의 구현을 서술하므로 **고치지 않는다.** 설계가 바뀐 것은 각 파일
머리의 개정 포인터가 가리킨다.

**상태 표기**

| 값 | 뜻 |
|---|---|
| `Complete` | 구현·검증 완료. 새 설계와 충돌이 가볍다 |
| `Superseded` | 구현됐으나 새 설계가 대체·확장한다 |
| `Incomplete` | 아직 끝나지 않았다 |

### 도메인 · 코어

| # | 스토리 | 상태 | 대체·확장 |
|---|---|---|---|
| 001 | [월드 생성 — 모험가 22명 풀 + 길드 8명](story-001-world-roster.md) | Complete | P4 (무료 지원자 유입으로 정원이 동적이 됨) |
| 002 | [의뢰인·의뢰 생성 (숨은 진실)](story-002-contract-generation.md) | Superseded | **P1** (슬롯·무지 축·직업), P5 |
| 003 | [계약 협상 판정 (3축)](story-003-negotiation.md) | Superseded | **P0** (선불 축 제거), P3 (근거 기반) |
| 004 | [파견 판정 (마진 반비례 무작위)](story-004-dispatch.md) | Superseded | **P2** ⚠ 아래 주석 |
| 005 | [게임 상태 + 일일 진행 (15일)](story-005-game-state.md) | Superseded | P0, P3, P7 |
| 006 | [서술 텍스트 조립](story-006-text-assembly.md) | Complete | P0 (`counterAdvance` 어휘 1종만 삭제) |
| 009 | [소문 획득](story-009-rumor-acquisition.md) | Superseded | P0, **P4** (출처가 외부인으로 이동) |
| 011 | [위험 고지 게이트](story-011-disclosure-gate.md) | Superseded | P3 |
| 012 | [명성·자금 경제](story-012-economy.md) | Superseded | **P0** (잔금 미지급 제거), P3, P5 |
| 013 | [신뢰·기억](story-013-trust-memory.md) | Complete | P4 (규칙 생존·확장) |

> ⚠ **004에 대하여** — `DispatchTarget = Pick<Contract, 'realRisk'>`는 `statedRisk`를
> **의도적으로 배제한** 타입이고, 그 근거가 스토리와 `src/domain/dispatch.ts`에 명시적으로
> 논증되어 있다. **기둥 6이 정확히 그 반대를 요구한다.** P2에서 타입만 고치지 말고
> 뒤집는 근거를 남길 것 — 실수가 아니라 논증된 결정을 뒤집는 것이다.

### 프레젠테이션

| # | 스토리 | 상태 | 대체·확장 |
|---|---|---|---|
| 007 | [창구 화면](story-007-counter-screen.md) | Superseded | **P1** ⚠ 전면 재작업. 청취·의뢰서 두 막이 통째로 없다 |
| 008 | [파견 배정 + 결과 화면 (최소판)](story-008-dispatch-screen.md) | Superseded | P2, P4 |
| 010 | [길드 홀 화면](story-010-guild-hall.md) | Superseded | P4 (정보 채널 → 관계 관리) |
| 014 | [결과 대조 화면](story-014-outcome-reveal.md) | Superseded | **P2** — 2단 → **3단 대조**. *내가 적은 것*이 기둥 6의 증거다 |
| 015 | [영입·확장](story-015-recruit-expand.md) | Superseded | P3 (고정비 신설로 "유이한 자금 싱크" 전제가 무너짐), P4 |
| 016 | [엔딩 + 최종 결산](story-016-ending.md) | Superseded | P7 (15일 종료 → 막 구조, 명성 구간 → 세력 관계) |

### 폴리시 — **미완**

| # | 스토리 | 상태 | 대체·확장 |
|---|---|---|---|
| 017 | [「양피지와 봉랍」 시각 정리](story-017-visual-polish.md) | **Incomplete** | P8. 길드 홀만 적용됨. ⚠ AC-6 *"캐릭터 일러스트 없음"*은 폐기 |
| 018 | [밸런싱 패스](story-018-balance-pass.md) | **Incomplete** | P8. 한 번도 돌지 않았다 (`balance-notes` 부재) |
| 019 | [배포 + 스모크 검증](story-019-deploy-smoke.md) | **Incomplete** | P8. ⚠ **경진대회 제출이 아직 남았다** |

> **3일 판은 실제로 닫히지 않았다.** `production/qa/smoke-2026-08-09.md`가 스스로
> *"story-019의 최종 사인오프가 아니다"* 라고 적어 두었다. 이 셋은 낡은 것이 아니라
> 미완이며, 새 계획의 **P8**로 흡수된다.

---

## 2. 현재 계획

**`production/roadmap.md`가 소유한다.** 단계 정의, 순서, 의존 관계, 완료 기준,
게이트가 전부 거기 있다.

이 문서에 단계 표를 다시 두지 않는다 — **두 문서가 같은 것을 적으면 반드시
갈라지고, 그때 어느 쪽이 맞는지 아무도 모르게 된다.**

요약만: `P0 정리 → P1~P3 세로 슬라이스 → GATE → P4~P8`.
GATE에서 Core hypothesis를 검증하며, 실패하면 P4로 넘어가지 않는다.

---

## 3. 신규 스토리 번호 체계

`story-020` 으로 잇지 **않는다.** 단계 접두사를 쓴다:

```
story-P1-001-contract-slots.md
story-P1-006-guildmaster-handbook.md
story-P2-001-form-to-dispatch.md
```

이유 둘 — 파일명만 보고 어느 단계 소유인지 읽히고, **001~019가 "MVP 블록"으로
시각적으로 닫힌다.**

> **2026-08-10 정정.** 예시가 ~~`story-P1-002-question-catalog.md`~~ 였다.
> **질문 카탈로그는 폐기된 개념이다** — 칸을 짚는 것이 곧 질문이므로 질문이라는
> 개체가 없다 (`intake-system.md` R4). 죽은 개념을 명명 예시로 두면 그것부터
> 만들게 된다.

---

## 4. P1 — 청취 + 의뢰서 (2026-08-10 신설, 16개)

**순서는 의존 관계다.** `production/roadmap.md`의 P1 절이 소유한다.

> ### ⚠ 착수 1순위는 **006**이다 — 번호 순서가 아니다
>
> **story-P1-006(길드마스터북)이 P1의 유일한 Hard 병목이다.** 책은 일깨우기
> 재료의 **P1 유일 공급원**이며(소문은 P4), **없으면 무지 칸을 하나도 못 뚫는다.**
> 공개 등급 기준표의 게재처이기도 하다 — 그것이 없으면 플레이어는 `D/C/B/A/S`가
> 무슨 뜻인지 모른 채 등급을 적는다.
>
> 001~005는 006과 **병렬로 진행 가능**하다. 009 이후 화면 작업은 006이 없으면
> 빈 껍데기만 검증된다.

### A. 데이터 · 도메인

| # | 스토리 | GDD 근거 |
|---|---|---|
| P1-001 ✅ | [의뢰서의 칸 — 타입과 저장](story-P1-001-contract-slots.md) | intake R1·F1 / ADR-001 · **ADR-004(반영)** |
| P1-002 | [의뢰인 직업](story-P1-002-client-occupation.md) | intake F1 / ADR-001 D5·D7 |
| P1-003 | [`balance.json` `intake`·`commission` 절](story-P1-003-balance-intake-section.md) | intake F4 (**빌드 게이트**) |
| P1-004 | [청취 판정](story-P1-004-intake-resolution.md) | intake R10·F2·F3 |
| P1-005 | [인내와 두 개의 열쇠](story-P1-005-patience-and-leverage.md) | intake R5·R6·Edge「인내」 |
| **P1-006** | [**길드마스터북 4권**](story-P1-006-guildmaster-handbook.md) | intake U3·Q2 / commission-form F1 — **병목** |
| P1-007 | [의뢰 템플릿 v6.1 스키마](story-P1-007-quest-templates.md) | intake R2·F1 / **`T`↔진실 정합 = 빌드 게이트** |
| P1-008 | [선제 진술 + 깊이 노브](story-P1-008-preemptive-statement.md) | intake R3·Q7 |

### B. 화면

| # | 스토리 | GDD 근거 |
|---|---|---|
| P1-009 | [청취 화면 — 창과 종이](story-P1-009-intake-screen.md) | intake U1·U2·V1·V2·V3 |
| P1-010 | [수첩](story-P1-010-notebook.md) | intake U3·AC-UI-05 |
| P1-011 | [의뢰서 화면](story-P1-011-commission-form-screen.md) | commission-form R1~R8·AC-CF-01~21 |
| P1-012 | [하루 진행 — 의뢰인 3명 고정 순서](story-P1-012-day-flow.md) | intake Dependencies 하류 / ADR-002 D5 |

### C. 인프라

| # | 스토리 | GDD·ADR 근거 |
|---|---|---|
| P1-013 | [LLM 연기 배선](story-P1-013-llm-persona-wiring.md) | intake R11 / ADR-003 D3·D5·D6 |
| P1-014 | [프록시 배포 배선](story-P1-014-proxy-deploy.md) | ADR-003 D2·D5·D8 — **키 없는 심사자 완주 검증** |
| P1-015 | [세이브/로드 구현](story-P1-015-persistence.md) | ADR-002 D1~D9 — **코드가 0줄이다** |
| P1-016 | [화면 간 배선 통합 테스트](story-P1-016-intake-wiring-integration.md) | 이 저장소의 2회 사고 — **완료 기준** |

---

## 진행 방법

각 스토리의 `Dependencies` 절이 선행 조건을 지정한다. 단계 안에서는 번호 순서대로
진행하면 의존성이 충족된다.

```bash
npm run check
```

> **`main`은 항상 배포 가능해야 한다.** 제출 전용 안정화 기간을 두지 않기로 했으므로,
> 아무 날에나 마감이 와도 내보낼 것이 있어야 한다. 근거: `production/roadmap.md`의
> 「경진대회 제출에 대하여」 절.
