# Story 017: 「양피지와 봉랍」 시각 정리

> **Day**: 3 (오전) | **Status**: Ready | **Layer**: Polish | **Type**: Visual/Feel
> **Estimate**: 1.5h
> **Spec**: `design/gdd/game-concept.md` Visual Identity Anchor
> **ADR**: N/A — 3일 마감으로 ADR 파이프라인 생략

## Context

**스크린샷 한 장이 컨셉을 설명해야 한다.** 컨셉의 Market Risks가 지목한 대로,
텍스트 게임이 시각적 임팩트로 승부하는 경쟁작에 밀리는 것이 실제 위험이다.
강한 시각 통일성이 그 완화책이다.

3일 제약을 미학으로 전환하는 방향이다 — 캐릭터 아트를 만들 시간이 없다는 결핍이
*"플레이어는 창구를 떠나지 않으므로 얼굴을 볼 수 없다"* 는 컨셉적 강점이 된다.

## Acceptance Criteria

- [ ] **한 줄 규칙 준수: 모든 정보가 종이 위에 있다.** UI 패널이 아니라 물건으로 보인다
- [ ] 배경은 나무 책상결, 정보는 그 위의 양피지 카드
- [ ] 팔레트는 세피아 단색조 + **붉은 봉랍색 하나뿐**
- [ ] **붉은색은 위험·사망·결렬에만** 쓰인다 — 다른 어떤 용도로도 쓰이지 않는다
- [ ] 세리프 웹폰트가 적용된다
- [ ] 캐릭터 일러스트가 하나도 없다
- [ ] 타결 시 도장 연출이 있다 (확정감)
- [ ] 최소 해상도 1280×720에서 레이아웃이 깨지지 않는다
- [ ] **초기 로드(JS+CSS, gzip) 200KB 이하** 유지
- [ ] 첫 화면 표시까지 1초 이내

## Implementation Notes

- 파일: `src/presentation/styles/base.css` 확장 + 각 화면 CSS
- 텍스처는 이미지 2~3장을 넘기지 않는다. CSS 그라디언트로 되는 것은 이미지를 쓰지
  않는다 — 로드 예산이 심사위원의 대기 시간이다
- **붉은색 규칙 검사가 이 스토리의 실질 작업이다.** 전체 CSS를 훑어 붉은 계열이
  위험·사망·결렬 외에 쓰인 곳이 없는지 확인한다. 이 규칙이 지켜져야 붉은 것이
  나타나는 순간 심장이 뛴다
- 웹폰트는 서브셋을 쓴다. 한글 전체 폰트는 수 MB로 로드 예산을 혼자 다 먹는다
- 도장 연출은 CSS 트랜지션 하나면 된다. 애니메이션 라이브러리를 넣지 않는다

## Out of Scope

- 오디오 (Tier 1로 이월 — 컨셉 명시)
- 캐릭터 아트 (영구 제외 — 시각 방향의 핵심)
- 파티클·셰이더

## QA Test Cases

- **Manual: 붉은색 단일 용도**
  - Setup: 모든 화면을 순회
  - Verify: 붉은 계열이 위험도 경고, 사망, 결렬 외에 나타나지 않는다
  - Pass: CSS를 grep해 붉은 계열 선언이 해당 클래스에만 있다
- **Manual: 종이 규칙**
  - Setup: 각 화면
  - Verify: 모든 정보 요소가 종이/카드 은유 안에 있다
  - Pass: "이건 종이에 쓸 수 없다" 싶은 요소가 없다
- **Manual: 로드 예산**
  - Setup: `npm run build`
  - Verify: gzip 합계 확인
  - Pass: **200KB 이하**
- **Manual: 해상도**
  - Setup: 1280×720으로 축소
  - Verify: 가로 스크롤이 없고 텍스트가 잘리지 않는다
  - Pass: 모든 화면에서 레이아웃 유지
- **Manual: 스크린샷 테스트**
  - Setup: 창구 화면 스크린샷 1장
  - Verify: 이 게임이 무엇인지 설명 없이 전달되는가
  - Pass: 제출 자료에 그대로 쓸 수 있다

## Test Evidence

`production/qa/evidence/visual-polish-evidence.md` — **스크린샷 전 화면 필수**
(제출물 3번 PDF에 그대로 재사용된다)
**Status**: [ ] 미작성

## Dependencies

- Depends on: Story 007, 008, 010, 014, 016
- Unlocks: Story 019
