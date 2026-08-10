# Counter Visual Target v1

**Status:** Superseded — dense stamp row rejected
**Date:** 2026-08-10
**Runtime target:** 1280×720
**Logical pixel grid:** 320×180, displayed at 4× nearest-neighbor

## Purpose

창구 화면의 구도, 픽셀 밀도, 재질, 조명, 정보 계층을 결정하는 비주얼 기준점이다.
게임에 그대로 넣는 배경 에셋이 아니다. 실제 화면은 DOM 텍스트와 개별 상호작용
오브젝트로 다시 조립한다.

## Locked composition

- 상단 38%: 정면 창구, 의뢰인 상반신, 어두운 길드 내부
- 중앙 경계: 두꺼운 나무 카운터 레일
- 하단 왼쪽: 수첩
- 하단 중앙: 가장 밝고 큰 양피지 의뢰서, 질문 칸 7개, 위험도 도장란 1개
- 하단 오른쪽: 펼친 길드마스터북과 응대/인내 기록 3개
- 하단 앞쪽: `D/C/B/A/S` 도장 5개, 잉크병, 펜, 인주

## Visual locks

- Ninja Adventure의 따뜻한 갈색, 석재 회색, 양피지 크림, 먼지 낀 주황 팔레트
- 단단한 픽셀 덩어리와 짙은 외곽선
- 의뢰서는 화면에서 가장 밝고 큰 단일 오브젝트
- 현대식 카드, 체크박스, 진행률 바, 발광 테두리 없음
- 동적 한글은 이미지에 굽지 않고 DOM 텍스트로 렌더링

## Source and provenance

- Generated with the built-in OpenAI image generation tool on 2026-08-10.
- Style references: `src/assets/cast-faces.png`, `src/assets/hall-room.png`.
- Reference source: Ninja Adventure Asset Pack by Pixel-boy and AAA, CC0 1.0.
- Final edit corrected the stamp row to exactly `D/C/B/A/S`.

## QA

- Exact size: PASS — 1280×720
- Aspect ratio: PASS — 16:9
- Full-frame content bounds: PASS
- Alpha required: N/A — visual target only
- Native-scale readability: PASS for layout and object hierarchy
- Production pixel palette: FAIL — 21,750 colors; generated source contains pseudo-pixel variation
- In-engine review: pending

## Production rule

이 PNG를 런타임 배경으로 사용하지 않는다. 승인 후 초상, 창틀, 수첩, 의뢰서,
길드마스터북, 응대 기록, 도장을 별도 자산으로 재제작하고 CSS Grid로 조립한다.
