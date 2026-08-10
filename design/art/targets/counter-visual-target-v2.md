# Counter Visual Target v2

**Status:** Approved — user approved on 2026-08-10
**Date:** 2026-08-10
**Runtime target:** 1280×720
**Logical pixel grid:** 320×180, displayed at 4× nearest-neighbor

## Revision goal

v1의 하단 도장 진열과 항상 펼쳐진 보조 패널을 제거했다. 좁은 대면 창구, 제한된 작업
공간, 서류 중심의 판정, 필요할 때만 꺼내는 물리적 도구라는 관료적 검사 화면의 원리를
판타지 길드에 적용한다. 특정 게임의 에셋·캐릭터·문구·화면을 복제하지 않는다.

## Locked composition

- 상단: 더 좁고 어두운 대면 창구와 의뢰인 반응
- 창구 바로 아래: 한 줄 대사 영역
- 중앙: 질문 칸 7개와 위험도 자국 영역이 있는 큰 양피지 의뢰서
- 왼쪽 가장자리: 작게 펼쳐 둔 수첩
- 오른쪽 위: 닫혀 있는 길드마스터북과 색인 탭
- 오른쪽 세로: 응대/인내 기록 3개
- 의뢰서 우하단: 닫힌 상태의 단일 위험도 도장 도구

## Interaction rules

- 등급 다섯 개는 기본 화면에 노출하지 않는다. 단일 도장 도구를 누르면 코드 기반
  팝오버가 열리고 `D/C/B/A/S`를 고른다.
- 수첩과 길드마스터북은 클릭하면 작업면 위로 펼쳐지는 보조 도구다.
- 의뢰서가 항상 가장 밝고 큰 활성 작업면이다.
- 인물은 반응을 읽는 곳이며 클릭 대상이 아니다.

## Source and provenance

- Edited with the built-in OpenAI image generation tool on 2026-08-10.
- Edit target: `counter-visual-target-v1.png`.
- Style references inherited from v1: Ninja Adventure Asset Pack, CC0 1.0.
- Directional reference is limited to general document-inspection UI principles; no external game
  assets, characters, logos, text, or exact layout were copied.

## QA

- Exact size: PASS — 1280×720
- Aspect ratio: PASS — 16:9
- Full-frame content bounds: PASS
- Native-scale hierarchy: PASS
- Visible grade control count: PASS — one compact tool
- Production pixel palette: FAIL — 14,656 colors; this remains a layout target, not a runtime asset
- In-engine review: pending

## Production rule

이 PNG를 런타임 배경으로 사용하지 않는다. 승인 후 각 물체를 Ninja 팔레트의 개별
에셋으로 다시 만들고, 한글과 팝오버는 DOM/CSS로 구현한다.
