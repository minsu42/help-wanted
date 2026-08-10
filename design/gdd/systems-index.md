# Systems Index: Help Wanted

> **정본 기준:** 2026-08-10 새 접수 심사 콘셉트
>
> 이 목록에 없는 구 길드 경영·소문·세력·장기 캠페인 시스템은 현재 범위가 아니다.

## Core Loop

```text
사건 진실
  → AI 의뢰인 자유 심문
  → 태그로 자료 탐색
  → 진술과 증거 문장 대조
  → 보수 협상
  → 의뢰서 작성
  → 파티 인계
  → 결과 대조
```

## Systems

| # | 시스템 | 계층 | 우선순위 | 상태 | 정본 문서 |
|---:|---|---|---|---|---|
| 1 | 사건 콘텐츠 | Core | P0 | Implemented | `game-concept.md` |
| 2 | 한 문장 자유 심문 | Gameplay/Dialogue | P0 | Implemented | `intake-dialogue.md` |
| 3 | AI 의뢰인 에이전트 | AI/Dialogue | P0 | Implemented | `ai-client-agent.md` |
| 4 | 자료집 | Gameplay/UI | P0 | Implemented | `game-concept.md` |
| 5 | 의뢰서 작성 | Gameplay/UI | P0 | Implemented | `commission-dispatch.md` |
| 6 | 보수 협상 | Economy/Dialogue | P0 | Implemented | `intake-dialogue.md` |
| 7 | 파티 지원·인계 | Gameplay | P0 | Implemented | `commission-dispatch.md` |
| 8 | 파견 판정·결과 대조 | Simulation/UI | P0 | Implemented | `commission-dispatch.md` |
| 9 | 창구 UI·아트 | Presentation | P0 | Implemented | `design/art/art-bible.md` |
| 10 | LLM 프록시·보안 | Infrastructure | P0 | Implemented, deploy pending | `docs/architecture/adr-001-controlled-ai-agent.md` |
| 11 | 예선 통합·배포 | Production | P0 | In progress | `production/roadmap.md` |

## Dependency Order

1. 사건 콘텐츠와 자료집 데이터를 정의한다.
2. AI 에이전트의 해석·도구 스키마를 구현한다.
3. 자유 심문이 도구 결과로 사실 후보를 공개하게 한다.
4. 사실 후보를 의뢰서에 기록한다.
5. 의뢰서와 파티 데이터로 결과를 판정한다.
6. 전체 흐름을 창구 UI에 연결한다.

## Ownership Rules

| 데이터 | 유일한 소유자 |
|---|---|
| 실제 사건·위협·의뢰인의 지식 | 사건 콘텐츠 |
| 발화 의도·대상·어조 해석 | AI 의뢰인 에이전트 |
| 사실 공개·인내·경계·협상 상한 | 자유 심문 규칙 코어 |
| 의뢰서 정보 충실도·준비도 | 의뢰서 시스템 |
| 성공·부상·사망 | 파견 판정 |
| 문장·말투·표정 표현 | AI 의뢰인 에이전트 + 프레젠테이션 |

AI는 다른 시스템의 소유 값을 직접 수정하지 않는다.

## Fixed Scope

- 의뢰인 6명: 기만 1·오해 2·정직/자진신고 3
- 괴물 도감 1권
- 길드 규정·시세표 1권
- 파티 후보 6개 이상
- 자유 발화 의뢰당 최대 5회
- 접수·거절·인계·결과 대조
- 첫 3사건 15분 시연 경로 + 전체 6사건

## Explicit Non-Goals

- 길드 경영과 건물 확장
- 길드 홀 탐색
- 모험가 육성
- 소문·세력·관계 시뮬레이션
- 저장과 장기 캠페인
- 음성·모바일·게임패드

## Design Progress

| 범주 | 수 |
|---|---:|
| 설계 완료 | 11 |
| 구현 완료 | 10 |
| 예선 차단 이슈 | Worker 배포 주소·실모델 품질 검증·Pages 배포 |
