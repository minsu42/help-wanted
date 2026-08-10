# Counter Desk Objects v1

**Status:** Candidate — technical and native-scale checks passed; in-game wiring pending  
**Date:** 2026-08-10

## Purpose

승인된 `counter-visual-target-v2`를 런타임에서 재구성할 수 있도록 책상 위 네 도구를
개별 투명 PNG로 만든다. 생성 결과는 원본 초안일 뿐이며, 실제 에셋은
`tools/asset-pipeline/build-counter-targets.py`가 크롭·하드 알파·47색 양자화·논리 크기
고정을 수행한 결과다.

## Runtime candidates

| 역할 | 경로 | 논리 크기 |
|---|---|---:|
| 수첩 | `src/assets/counter-notebook.png` | 72×52 |
| 의뢰서 | `src/assets/counter-commission-form.png` | 168×80 |
| 길드마스터북 | `src/assets/counter-handbook.png` | 54×62 |
| 응대 기록 3개 + 단일 도장 | `src/assets/counter-response-tools.png` | 54×48 |

모든 파일은 RGBA, 하드 알파, 최대 47색, nearest-neighbor 전용이다. 한글·질문·숫자와
등급 선택 팝오버는 이미지에 굽지 않고 DOM으로 올린다.

## Generation prompt

Built-in OpenAI image generation을 사용했다. 입력 이미지는 승인된
`design/art/targets/counter-visual-target-v2.png`이며 역할은 형태·팔레트·재질·카메라·광원
참조다.

```text
Create one coherent family of four isolated pixel-art desk objects: an open ring-bound field
notebook, a blank parchment commission form with seven subtle field marks, a closed guildmaster
handbook with four index tabs, and three response tokens plus one compact stamp tool. Preserve the
approved target's brown/ochre palette, dark umber outline, top-front desk view, upper-left warm
light, chunky pixel density, and restrained bureaucratic-fantasy tone. Place the four objects in a
separated 2x2 layout on a perfectly flat #ff00ff chroma-key background. No readable text, letters,
numbers, labels, logos, watermark, shadows, scenery, characters, duplicate grade stamps, cropped
edges, smooth vector edges, painterly blur, gradients, or photorealism.
```

## Provenance and QA

- Source: `counter-desk-objects-source-v1.png`
- Chroma-key result: `counter-desk-objects-keyed-v1.png`
- Tool: OpenAI built-in image generation + local Pillow normalization
- Directional reference: approved project-owned visual target; inherited Ninja Adventure references
  are CC0 1.0 and credited in `docs/asset-credits.md`
- Exact dimensions: PASS
- Alpha channel and transparent bounds: PASS
- Palette ≤48 colors: PASS — 47 colors each
- Native 320×180 composite: PASS
- In-game interaction and focus states: pending

