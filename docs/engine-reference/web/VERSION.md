# Web Runtime Version Reference

> **검증일:** 2026-08-10

| 구성 | 고정 버전 |
|---|---|
| Engine | 없음 — 웹 네이티브 DOM + CSS |
| Language | TypeScript 5.5.4 strict |
| Build | Vite 7.3.6 |
| Test | Vitest 4.1.10 + happy-dom 20.11.2 |
| Runtime npm dependencies | 0 |
| Worker runtime | Cloudflare Workers 표준 `fetch` |

## Required Configuration

- `vite.config.ts`의 `base: "./"`를 유지한다.
- 빌드 타깃은 `es2020`이다.
- 버전 범위 기호 없이 정확히 핀한다.
- UI 프레임워크, Canvas, WebGL을 추가하지 않는다.
- LLM SDK를 브라우저 번들에 넣지 않는다.

## Performance Budgets

| 항목 | 예산 |
|---|---:|
| 초기 전송 gzip | 1MB 이하 |
| JS | 200KB 이하 |
| CSS | 200KB 이하 |
| 이미지 | 500KB 이하 |
| 규칙 조작 | 100ms 이내 |
| AI 대기 연출 시작 | 전송 후 2초 이내 |
| AI 응답 목표 | 8초 이내 |
| 메모리 | 200MB 이하 |

## Layer Boundaries

- `src/domain/**`: 순수 규칙. DOM·네트워크 import 금지.
- `src/llm/**`: Worker 계약과 스키마 검증.
- `src/presentation/**`: DOM·CSS와 입력 상태.
- `workers/**`: 키·프롬프트·도구 오케스트레이션.

아키텍처 정본은 `docs/architecture/adr-002-web-runtime-boundaries.md`다.
