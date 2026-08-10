# Story P1-014: 프록시 배포 — Worker를 올리고 클라이언트에 꽂는다

> **Phase**: P1 | **Status**: Ready | **Layer**: Infrastructure | **Type**: Config/Data
> **GDD**: `design/gdd/intake-system.md` (v6.2) R11 폴백
> **ADR**: ADR-003 D1·D2·D5·D8
> **Created**: 2026-08-10

## Context

**코드는 이미 다 있다.** `workers/intake-proxy/worker.js`(410줄)·`wrangler.toml`·
`README.md`·`src/llm/gateway.ts`가 커밋 `911e448`로 들어와 있고, **13항목 스모크가
전부 PASS**다. 남은 것은 **아직 아무 데도 올라가 있지 않다는 사실 하나뿐이다.**

그래서 이 스토리에는 새 설계가 없다. 있는 것은 **절차**다 — `wrangler` 설치,
로그인, 시크릿, 배포, 그리고 **배포된 엔드포인트를 클라이언트에 주입하는 것**.

**이 스토리의 성패는 하나로 판정된다: 키가 없는 심사자가 Pages 링크만 열어
완주할 수 있는가.** 프록시가 살아 있으면 LLM 경로로, 죽어 있으면 폴백으로 —
**둘 다 완주해야 한다.** 후자가 「`main`은 항상 배포 가능」의 실행 수단이다.

## ADR 요구 인용

- **D1** — *"게임 본체는 GitHub Pages에 남는다. **프록시는 부속 인프라다.**
  배포 채널 변경이 아니다."*
- **D2** — *"**키는 Worker 시크릿에만 존재한다.** 브라우저에 내려가는 응답에 키가
  실리지 않는다."* / *"**시스템 프롬프트(의뢰인 페르소나 틀)는 Worker가 소유한다.**"*
- **D2** — *"**남용 방어**: IP당 레이트 리밋 + **일일 총량 캡** + 허용 모델 목록."*
- **D2** — *"**공급자 전환은 Worker 설정이다.** 클라이언트 코드는 공급자를 모른다."*
- **D5** — *"프록시 자체가 죽어 있음 → **폴백 모드로 게임 전체 진행 가능.**"* /
  *"심사 당일 프록시·공급자 장애가 나도 게임은 완주 가능하다."*
- **D8** — *"`wrangler`는 개발 도구 목록에 추가된다 — **번들에 들어가지 않으므로
  원칙과 충돌하지 않는다.**"*
- **변하지 않는 사실** — *"**NAN2026 심사자는 키가 없다.** 심사자가 별도 준비 없이
  배포 URL만 열어 플레이할 수 있어야 한다."*
- **`technical-preferences.md` Forbidden Patterns** — *"**API 키·페르소나 시스템
  프롬프트를 클라이언트 코드·저장소에 넣지 않는다** — Worker 시크릿과 Worker
  코드만이 그것을 가진다."*
- **`docs/engine-reference/web/VERSION.md`** — *"`^`/`~` 범위 사용 금지. **정확한
  핀**."*

## Acceptance Criteria

- [ ] `npm i -D wrangler` — **정확한 핀**으로 `package.json`에 들어간다.
      `^`도 `~`도 붙지 않는다. lockfile을 커밋한다 (버전 정책)
- [ ] `wrangler`가 **devDependency**이며 `dist/` 산출물에 들어가지 않는다 —
      런타임 의존성 0개 원칙 불변 (D8)
- [ ] `npx wrangler login` 완료 (Cloudflare 계정 연결)
- [ ] `npx wrangler secret put LLM_API_KEY --config workers/intake-proxy/wrangler.toml`
      — **키가 저장소에 들어가는 경로가 하나도 없다** (D2)
- [ ] `npx wrangler deploy --config workers/intake-proxy/wrangler.toml` 성공,
      `curl -i https://<worker>.workers.dev/health`가 **200**
- [ ] **배포된 엔드포인트가 클라이언트에 주입된다** — 빌드 타임 설정이다.
      **주입되는 것은 엔드포인트 URL뿐이고 키는 절대 아니다**
- [ ] `ALLOWED_ORIGINS`에 실제 Pages 출처가 들어 있고, **목록 밖 출처는 403**이다.
      배포된 Pages에서 `POST /turn`이 **200 + CORS 통과** (D2 · ADR-003 Verification)
- [ ] **일일 총량 캡**(`DAILY_CALL_CAP`)과 **IP 레이트 리밋**(`RATE_LIMIT_PER_MINUTE`)이
      설정되어 있고 실제로 작동한다 — 초과 호출이 차단된다 (D2)
- [ ] `PROVIDER`/`MODEL` 전환이 **Worker 설정만으로** 된다 — 클라이언트를 다시
      빌드하지 않고 공급자를 바꿀 수 있다 (D2)
- [ ] *(정적 — BLOCKING)* **API 키가 클라이언트 코드·`dist/` 산출물·저장소 히스토리
      어디에도 없다.** 키 패턴 grep **0건** (D2 · Forbidden Patterns)
- [ ] *(정적 — BLOCKING)* **페르소나 시스템 프롬프트가 클라이언트에 없다.**
      `src/**`와 `dist/**`에서 페르소나 문자열 grep **0건** — Worker 코드만이
      그것을 가진다 (D2)
- [ ] **결정적 AC — 키 없는 심사자가 Pages 링크만 열어 완주한다.**
      제3의 브라우저 프로필(로그인·설정·키 없음)로 배포 URL을 열어 **하루를 완주**
- [ ] **폴백 완주 검증** — 배포된 빌드를 **프록시가 닿지 않는 상태**로 열어
      (Worker 일시 중지 또는 엔드포인트 차단) **완주된다.** 콘솔에 미처리 예외 0건
      (D5 · 「`main`은 항상 배포 가능」)
- [ ] `npm run check` 통과 — gzip 합계 200KB 이하 **불변** (LLM은 번들에 0바이트, D7)

## Implementation Notes

- 절차의 소유자는 `workers/intake-proxy/README.md`다. **이 스토리는 그 절차를 AC로
  옮겨 적었을 뿐이므로, 절차가 바뀌면 README를 고치고 여기를 따라 고친다**
- 엔드포인트 주입은 **빌드 타임 설정**으로 한다. 하드코딩해도 유출되는 것은 URL
  하나뿐이지만, 그러면 `wrangler.toml`을 안 고치고 Worker 이름을 바꾸는 순간 조용히
  깨진다 — **한 곳에서만 정하게 한다**
- ⚠ **레이트 리밋은 격리(isolate) 단위 best-effort다** (README 「알려진 한계」).
  실제 상한이 설정값의 배수가 될 수 있다. KV/Durable Object를 붙이는 것은
  **무상태 Worker를 유지한다는 ADR-003의 결정을 건드리는 일**이므로 여기서 하지
  않는다. NVIDIA 무료 크레딧에서는 피해가 돈이 아니라 쿼터다
- ⚠ **Pages Source를 바꿔도 워크플로가 자동 재실행되지 않는다** (story-019의 교훈).
  Worker 배포와 Pages 배포는 별개 파이프라인이다 — 한쪽만 돌고 만족하지 말 것
- 폴백 검증을 **테스트에서만** 하지 말 것. ADR-003이 *"폴백 경로가 테스트에서만
  살아 있고 실플레이에서 썩는 것을 경계할 것"* 이라 적었다 — **실브라우저로 한 번**

## Out of Scope

- 게이트웨이 ↔ 청취 배선 — **P1-013**
- 세이브 — **P1-015**
- 화면 배선 통합 테스트 — **P1-016**
- Worker 코드·게이트웨이 코드 수정 (이미 커밋됨. 고쳐야 하면 결함 신고다)
- 정확한 레이트 리밋(KV/DO) — 무상태 결정을 건드리므로 새 ADR 사안
- 심사 계정 초대·제출물(동영상·PDF) — story-019 / P8

## Test Evidence

- `production/qa/smoke-proxy-deploy-2026-08-10.md` — Worker URL, `/health` 응답
  코드, Pages origin `POST /turn` 200 + CORS, 캡·레이트 리밋 실측, 키·페르소나
  grep 0건 기록
- `production/qa/evidence/judge-no-key-walkthrough.md` — **결정적 AC**: 키 없는
  프로필로 배포 URL 완주 + **프록시 차단 상태 완주** 두 회차 기록

## Dependencies

- **Depends on**: P1-013 (배선이 없으면 배포해도 게임이 쓰지 않는다) ·
  `workers/intake-proxy/**` (**커밋됨**)
- **Unlocks**: 심사 경로 전체 — 이 스토리 전에는 **LLM 경로가 심사되지 않는
  제출물**이다 (ADR-003이 BYOK를 기각한 이유와 같다)
