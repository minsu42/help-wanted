# 웹 스택 — Version Reference

| Field | Value |
|-------|-------|
| **Engine** | 없음 — 웹 네이티브 (DOM + CSS) |
| **Language** | TypeScript **5.5** (strict) |
| **Build** | Vite **5.4** |
| **Test** | Vitest **4.1** + happy-dom |
| **Runtime Deps** | 없음 |
| **Project Pinned** | 2026-08-08 |
| **Last Docs Verified** | 2026-08-08 |
| **LLM Knowledge Cutoff** | 2026년 5월 |
| **Risk Level** | **LOW** — 단, 구버전 고정의 결과다 (아래 참조) |

## 왜 최신 버전을 쓰지 않는가

2026-08-08 기준 최신 버전은 이 프로젝트가 고정한 것보다 훨씬 앞서 있다.

| | 최신 (2026-08-08) | 이 프로젝트 고정 | LLM 학습 범위 |
|---|---|---|---|
| TypeScript | **7.0.2** (2026-08-05 출시) | 5.5 | 5.x |
| Vite | **8.x** (8.0 = 2026-04, 현재 8.2 라인) | 5.4 | 5 / 6 |

**TypeScript 7.0은 이 결정을 내린 시점에서 사흘 전에 나왔고, 컴파일러를 Go로 다시
쓴 메이저 버전이다** (전체 빌드 8~12배 속도 향상). TypeScript 6.0은 2026-03-23에
나온 마지막 JS 기반 릴리스다.

고정 근거 세 가지:

1. **검증된 조합이다.** 동일 스택(TS 5.5 + Vite 5.4 + Vitest 4.1)이 `minsu42/NAN2026`
   에서 137커밋 동안 GitHub Pages 배포까지 정상 동작했다. 3일 마감 프로젝트에
   "새 버전 설정 디버깅" 예산은 없다.
2. **최신 버전의 이득이 이 프로젝트에 없다.** TS 7의 10배 빠른 빌드는 대형
   코드베이스에서 의미가 있으나, 3일 규모에서는 체감되지 않는다.
3. **LLM 조수의 신뢰도.** 고정 버전이 LLM 학습 데이터 안에 있으면 API를 지어내지
   않는다. Vite 8 / TS 7로 가면 3일 내내 추측에 의존하게 된다. **실질적으로 이것이
   가장 큰 이유다.**

## 경고

> **버전을 올리면 이 문서의 Risk Level은 즉시 HIGH가 된다.**
> Vite 8과 TypeScript 7은 둘 다 LLM 학습 데이터 이후에 나왔으며, TS 7은 컴파일러
> 구현 자체가 교체된 메이저 버전이다. 3일 마감이 끝난 뒤(Tier 2 확장 단계)에 올리고,
> 그때 `/setup-engine upgrade`를 실행해 마이그레이션 감사를 먼저 받는다.

## GitHub Pages 관련 고정 사항

- `vite.config.ts`에 **`base: "./"`** 를 반드시 유지한다. 저장소 하위 경로
  (`https://<user>.github.io/<repo>/`)에서 에셋이 404가 나는 것을 막는 유일한 설정이며,
  로컬 dev 서버에서는 문제가 드러나지 않으므로 배포 후에야 발견된다.
- 정적 호스팅이므로 **커스텀 HTTP 헤더를 설정할 수 없다.** COOP/COEP가 필요한 기능
  (SharedArrayBuffer, WASM 멀티스레드)은 사용 불가.
- 서버가 없으므로 모든 상태는 클라이언트에 있다. 외부 API 호출이 필요해지면 별도
  프록시(예: Cloudflare Worker)가 필요하며, 그것은 설계 변경이다.

## 참고 링크

- Vite 8.0 릴리스: https://vite.dev/blog/announcing-vite8
- Vite 릴리스 정책: https://vite.dev/releases
- TypeScript 7.0 정식 출시 (InfoQ, 2026-08): https://www.infoq.com/news/2026/08/typescript-7-released/
- TypeScript 6.0 변경사항: https://codersera.com/blog/typescript-6-0-whats-new-breaking-changes-2026/

## 참고: 미사용 레퍼런스

`docs/engine-reference/godot/`는 프로젝트 템플릿에서 온 것이며 이 프로젝트에서는
사용하지 않는다. `CLAUDE.md`의 import는 이 파일을 가리킨다. 향후 Godot로 전환하는
일이 생기면 그때 import를 되돌린다.
