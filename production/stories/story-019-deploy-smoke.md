# Story 019: 배포 + 스모크 검증

> **Day**: 3 (오전, **반드시 오전에**) | **Status**: Ready | **Layer**: Polish
> **Type**: Integration
> **Estimate**: 0.5h
> **Spec**: `docs/engine-reference/web/VERSION.md` GitHub Pages 절
> **ADR**: N/A — 3일 마감으로 ADR 파이프라인 생략

## Context

**컨셉 문서가 Scope Risk로 명시했다** — *"Day 3에 첫 배포를 시도하는 재앙."*
인프라는 이미 검증되어 있으므로(2026-08-08 배포 성공) 이 스토리는 **게임이 올라간
상태에서 다시 확인**하는 것이다.

이미 확인된 교훈: **Pages Source를 바꿔도 워크플로가 자동 재실행되지 않는다.**

제출 요건 1번(플레이 가능한 빌드 + 전체 소스 + 커밋 기록)이 여기 걸려 있다.

## Acceptance Criteria

- [ ] `npm run check` 통과 (typecheck → test → build)
- [ ] GitHub Actions 워크플로가 성공한다
- [ ] `https://minsu42.github.io/help-wanted/` 에서 게임이 로드된다
- [ ] `index.html` / `assets/*.css` / `assets/*.js` 전부 200 응답 (`base: "./"` 작동 확인)
- [ ] **배포본에서 15일 완주가 가능하다** — 로컬만 되는 상태가 아님을 확인
- [ ] 브라우저 콘솔에 에러가 없다
- [ ] 첫 화면 표시까지 1초 이내 (일반 회선)
- [ ] gzip 합계 200KB 이하
- [ ] 저장소가 공개 상태이거나 심사 계정(`dl_gameai_reviewer@nhn.com`)이 초대되어 있다
- [ ] **커밋 기록이 작업 단위로 남아 있다** — 몰아서 한 커밋이 아님

## Implementation Notes

- **반드시 Day 3 오전에 한다.** 오후는 제출물(동영상 + PDF 2종) 작업으로 확정되어 있고,
  이때 배포가 깨지면 복구할 시간이 없다
- 로컬 dev 서버에서는 경로 문제가 드러나지 않는다. `vite.config.ts`의 `base: "./"`가
  유지되고 있는지 확인할 것 — 이것이 하위 경로 404를 막는 유일한 설정이다
- 정적 호스팅이므로 커스텀 헤더를 설정할 수 없다. COOP/COEP가 필요한 기능은 애초에
  쓰지 않았으므로 문제없어야 한다
- 실패 시 워크플로를 **수동 재실행**한다 (자동 재실행되지 않음)

## Out of Scope

- 제출물 PDF/동영상 (별도 작업, Day 3 오후)
- 성능 프로파일링

## QA Test Cases

- **Integration: 배포본 완주**
  - Given: 배포된 URL
  - When: 새 회차를 15일까지 진행
  - Then: 엔딩 화면까지 도달한다
  - Edge: 새로고침 후에도 정상 시작 (상태가 URL이나 스토리지에 의존하지 않음)
- **Integration: 에셋 경로**
  - Given: 배포 URL
  - When: 네트워크 탭 확인
  - Then: 404가 하나도 없다
- **Integration: 로드 예산**
  - Then: gzip 합계 ≤ 200KB, 첫 화면 ≤ 1초
- **Integration: 콘솔 청결**
  - Then: 에러·경고 0건

## Test Evidence

`production/qa/smoke-2026-08-10.md` — 배포 URL, 응답 코드, 완주 확인, 스크린샷
**Status**: [ ] 미작성

## Dependencies

- Depends on: Story 016, 017, 018
- Unlocks: 제출물 작업 (Day 3 오후)
