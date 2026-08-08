# 스토리 인덱스 — Help Wanted

> **작성**: 2026-08-08 | **총 19개**
> Epic 계층은 생략했다 (`design/gdd/game-concept.md` Next Steps). Day 단위로 묶는다.
> ADR·control-manifest·tr-registry도 생략되었으므로 각 스토리는
> `design/quick-specs/*.md`를 요구사항 출처로 삼는다.

## 진행 방법

각 스토리의 `Dependencies` 절이 선행 조건을 지정한다. 번호 순서대로 진행하면 의존성이
자동으로 충족된다.

```bash
npm run check
```

---

## Day 1 — 핵심 루프 (종료 시 플레이 가능 필수)

| # | 스토리 | Type | 예상 | 상태 |
|---|---|---|---|---|
| 001 | [월드 생성 — 모험가 22명 풀 + 길드 8명](story-001-world-roster.md) | Logic | 2h | Ready |
| 002 | [의뢰인·의뢰 생성 (숨은 진실)](story-002-contract-generation.md) | Logic | 2h | Ready |
| 003 | [계약 협상 판정 (3축)](story-003-negotiation.md) | Logic | 1.5h | Ready |
| 004 | [파견 판정 (마진 반비례 무작위)](story-004-dispatch.md) | Logic | 1.5h | Ready |
| 005 | [게임 상태 + 일일 진행 (15일)](story-005-game-state.md) | Logic | 1h | Ready |
| 006 | [서술 텍스트 조립](story-006-text-assembly.md) | Logic | 1h | Ready |
| 007 | [창구 화면](story-007-counter-screen.md) | UI | 2h | Ready |
| 008 | [파견 배정 + 결과 화면 (최소판)](story-008-dispatch-screen.md) | UI | 2h | Ready |

**합계 11h — 8시간에 안 들어간다.** 006과 008을 최소판으로 깎거나, Day 1 종료 게이트를
Day 2 오전까지로 현실화할 것. 001·002는 기반이라 깎을 수 없다.

> **Day 1 종료 게이트**: Story 008이 끝나면 "의뢰 받고 사람 보내서 결과 보기"가
> 완주된다. **재미없다면 이 시점에 알아야 한다.**

## Day 2 — 차별점

| # | 스토리 | Type | 예상 | 상태 |
|---|---|---|---|---|
| 009 | [소문 획득 판정](story-009-rumor-acquisition.md) | Logic | 2h | Ready |
| 010 | [길드 홀 출석 + 화면](story-010-guild-hall.md) | UI | 2h | Ready |
| 011 | [위험 고지 축 연동](story-011-disclosure-gate.md) | Integration | 1h | Ready |
| 012 | [명성·자금 경제](story-012-economy.md) | Logic | 1.5h | Ready |
| 013 | [신뢰·기억 갱신](story-013-trust-memory.md) | Integration | 1h | Ready |
| 014 | [**결과 대조 화면**](story-014-outcome-reveal.md) | UI | 1.5h | Ready |
| 015 | [모험가 영입 + 길드 확장](story-015-recruit-expand.md) | UI | 2.5h | ⚠ 절단 후보 |

**합계 11.5h.** 015를 자르면 9h.

> **014가 Day 2에서 가장 중요하다.** 컨셉의 1순위 설계 리스크("창발이 무작위로
> 느껴짐")에 대한 유일한 방어선이며, 컨셉이 "실력 성장의 유일한 피드백 채널"로
> 규정한 화면이다. 시간이 부족하면 015를 자르고 014를 지킨다.

## Day 3 오전 — 마감

| # | 스토리 | Type | 예상 | 상태 |
|---|---|---|---|---|
| 016 | [엔딩 + 최종 결산](story-016-ending.md) | UI | 1h | Ready |
| 017 | [「양피지와 봉랍」 시각 정리](story-017-visual-polish.md) | Visual/Feel | 1.5h | Ready |
| 018 | [밸런싱 패스](story-018-balance-pass.md) | Config/Data | 1h | Ready |
| 019 | [배포 + 스모크 검증](story-019-deploy-smoke.md) | Integration | 0.5h | Ready |

**Day 3 오후는 게임이 아니라 제출물이다** — 동영상 30~60초 + PDF 2종.

---

## 절단 순서 (일정이 밀릴 때)

1. **015 모험가 영입 + 길드 확장** — 리프 노드. 자금 싱크가 사라지지만 핵심 루프는 온전
2. **배경 사건 척추** (Tier 1, 스토리 미작성) — 애초에 여유분
3. 017 시각 정리를 축소 — 단, 스크린샷은 제출물에 쓰이므로 최소한은 필요

**절대 자르지 않는 것**: 008(Day 1 게이트), 009(차별점), 014(피드백 채널), 019(배포).

## 유형 분포

Logic 8 · UI 6 · Integration 3 · Visual/Feel 1 · Config/Data 1
