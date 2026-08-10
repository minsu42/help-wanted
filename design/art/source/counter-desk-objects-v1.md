# Counter Desk Objects v1 — Source Record

**상태:** 현재 런타임에서 자료집과 의뢰서 장식 사용

**생성일:** 2026-08-10

## 현재 사용 파일

| 역할 | 경로 | 논리 크기 |
|---|---|---:|
| 의뢰서 | `src/assets/counter-commission-form.png` | 168×80 |
| 접수원 자료집 | `src/assets/counter-handbook.png` | 54×62 |

두 파일은 책상 오브젝트 원본에서 크롭하고, 하드 알파와 공유 47색 팔레트로 정규화했다. CSS에서는 `image-rendering: pixelated`로 표시한다.

## 생성 프롬프트

```text
Create one coherent family of isolated pixel-art desk objects for a medieval fantasy guild
reception counter. Preserve the approved target's brown and ochre palette, dark umber outline,
top-front desk view, upper-left warm light, chunky pixel density, and restrained bureaucratic
fantasy tone. Use a flat chroma-key background. No readable text, logos, watermark, gradients,
photorealism, or cropped edges.
```

## 출처와 검증

- 생성: OpenAI built-in image generation
- 정규화: 프로젝트 로컬 이미지 파이프라인
- 원본: `counter-desk-objects-source-v1.png`
- 키 제거본: `counter-desk-objects-keyed-v1.png`
- 크기·알파·팔레트: 통과
- 실제 화면 검증: 1280×720 및 390×844 통과
