# Story 001 — 사건·자료·파티 데이터

## Goal

자유 심문과 파견 판정이 참조할 단일 진실 데이터를 정의한다.

## Scope

- `CaseTruth`, `CaseFact`, `KnowledgeClaimRule`, `PublicPersona`, `PartyCandidate`
- 의뢰인 3명
- 괴물 도감, 길드 규정·시세표
- 파티 후보 6개 이상
- 콘텐츠 정합성 검증기

## Acceptance Criteria

- **GIVEN** 각 사건, **WHEN** 검증하면, **THEN** 실제 위협·관련 사실·공개 경로·필수 준비가 모두 존재한다.
- **GIVEN** `concealed` 사실, **WHEN** 데이터를 검사하면, **THEN** 최소 한 개의 유효 자료 지식 경로가 있다.
- **GIVEN** `unknown` 사실, **WHEN** 의뢰인의 공개 경로를 검사하면, **THEN** 어떤 질문 도구에서도 반환되지 않는다.
- **GIVEN** 접수 가능한 사건, **WHEN** 파티 지원을 계산하면, **THEN** 적정 보수에서 최소 두 파티가 지원 가능하다.
- 모든 밸런스 수치는 `src/data/balance.json`에 있다.
