# Codex + Claude Game Studio

이 저장소는 Claude Code와 Codex를 병행한다. 두 도구는 같은 게임 소스와 설계 산출물을
공유하되, 도구별 설정은 분리한다.

## 도구별 설정

- Claude 전용 설정: `.claude/`, `CLAUDE.md`
- Codex 전용 설정: `.agents/`, `AGENTS.md`
- `.claude/`는 사용자의 로컬 Claude 환경이다. 사용자가 명시적으로 요청하지 않으면
  이동·삭제·일괄 변환하지 않는다.
- `.agents/skills/`의 프로젝트 Game Studio 어댑터는 같은 이름의
  `.claude/skills/<name>/SKILL.md`를 읽는다. 워크플로 본문을 양쪽에 복제하지 않는다.
- 외부 Codex 스킬은 `.agents/external-skills.json`에 출처·커밋·라이선스를 기록하고,
  현재 기술 기준과 충돌하지 않는 것만 저장소 로컬에 둔다.

## 공유하는 단일 소스

- 게임 비전: `design/gdd/game-concept.md`
- 개발 순서와 단계: `production/roadmap.md`
- 설계: `design/`
- 구현: `src/`, `workers/`
- 프로토타입: `prototypes/`
- 검증: `tests/`, `production/qa/`

Claude와 Codex가 만든 결과는 위 경로에 이어서 기록한다. 도구 이름을 붙인 별도 사본을
만들지 않는다. 기존 파일과 사용자 변경을 우선 보존한다.

## 기술 기준

- TypeScript 5.5.4 strict + Vite 7.3.6
- DOM + CSS, 게임 엔진·UI 프레임워크·Canvas/WebGL 없음
- Vitest + happy-dom
- `vite.config.ts`의 `base: "./"` 유지

## Codex에서 Claude 워크플로를 사용할 때

해당 `.agents/skills/<name>/SKILL.md`와 `.agents/CLAUDE-CODEX-COMPAT.md`를 먼저
따른다. Claude 문서의 게임 제작 절차와 산출물 형식은 유지하되, Claude 전용 도구명,
에이전트 호출, 승인 UI, 모델 지정은 Codex 방식으로 번역한다.
