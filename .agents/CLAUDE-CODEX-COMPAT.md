# Claude Game Studio → Codex 호환 규약

이 문서는 `.agents/skills/`의 어댑터가 기존 `.claude/skills/` 워크플로를 실행할 때
적용하는 호스트 호환 계층이다. 게임 설계 절차와 산출물 형식은 Claude 원문이 소유하고,
아래 규약은 실행 방식만 바꾼다.

## 우선순위

1. 현재 사용자 요청과 상위 지침
2. `AGENTS.md`와 이 호환 규약
3. 대응하는 `.claude/skills/<name>/SKILL.md`
4. 그 문서가 참조하는 `.claude/docs/` 자료와 템플릿

Claude 원문의 도메인 절차는 가능한 한 그대로 따른다. 아래 항목과 충돌하는 Claude 전용
호스트 지시만 치환한다.

## 도구 번역

| Claude 표현 | Codex 실행 |
|---|---|
| `Read`, `Glob`, `Grep` | 파일 읽기와 `rg` |
| `Write`, `Edit` | `apply_patch` |
| `Bash` | 안전한 셸 명령 |
| `WebSearch` | 필요할 때 웹 검색 및 출처 제시 |
| `TodoWrite` | 작업이 복잡할 때 계획 갱신 |
| `AskUserQuestion` | Plan 모드에서 지원되면 선택 UI, 그 외에는 필요한 질문만 짧게 직접 질문 |
| `/skill-name` | Codex의 `$skill-name` |

## 에이전트와 모델

- `model`, `agent`, `maxTurns`, `allowed-tools`, `disallowedTools`, `isolation` 같은 Claude
  frontmatter는 실행 지시로 취급하지 않는다.
- `Task` 또는 “전문 에이전트를 spawn”하라는 지시는 해당 관점의 체크리스트를 현재
  Codex가 직접 적용한다.
- 사용자가 명시적으로 서브에이전트나 병렬 작업을 요청한 경우에만 실제 위임을 고려한다.
- 워크트리나 브랜치는 사용자가 요청하거나 현재 작업에 명백히 필요한 경우에만 만든다.

## 협업과 승인

- 설명·리뷰 요청은 읽기 전용으로 처리한다.
- 구현·수정 요청은 그 범위 안의 파일 쓰기를 이미 승인한 것으로 본다. Claude 원문의
  “각 섹션마다 쓰기 허락을 다시 받는다”는 절차 때문에 반복해서 멈추지 않는다.
- 결과를 실질적으로 바꾸는 창작 선택, 외부 전송, 범위 확대, 파괴적 작업에는 사용자
  결정을 받는다.
- 기존 사용자 변경을 덮어쓰지 않고, 관련 없는 dirty 파일을 수정하지 않는다.

## 공유 산출물

- Claude와 Codex 모두 기존 `design/`, `production/`, `prototypes/`, `src/`, `tests/`
  경로를 사용한다.
- `codex-`, `claude-` 접두사의 중복 설계 문서를 만들지 않는다.
- 기존 템플릿과 인덱스를 재사용하고, 한 도구가 남긴 작업을 다른 도구가 이어서 한다.
- `.claude/` 자체는 로컬 Claude 설정으로 보존한다. 어댑터 작업 중 수정하지 않는다.

## 누락 시 처리

대응하는 `.claude/skills/<name>/SKILL.md`가 없으면 비슷한 절차를 추측해 실행하지 않는다.
누락 경로를 알리고, 해당 Claude Game Studio 워크플로 복구 또는 독립 Codex 스킬로의
승격이 필요한지 사용자에게 확인한다.

