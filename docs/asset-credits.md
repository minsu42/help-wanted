# 에셋 출처와 런타임 사용 상태

## 현재 런타임 에셋

| 파일 | 역할 | 출처 |
|---|---|---|
| `client-faces.png` | 의뢰인 6인 초상 아틀라스 (38×38 × 6) | Pixel-boy · AAA, `Ninja Adventure Asset Pack` (CC0 1.0)에서 Faceset 6장 추출 · `tools/asset-pipeline/build-client-faces.py`로 구움 |
| `counter-commission-form.png` | 의뢰서 패널 장식 | OpenAI 생성 후 프로젝트 정규화 |
| `counter-handbook.png` | 자료집 패널 장식 | OpenAI 생성 후 프로젝트 정규화 |

생성 프롬프트와 정규화 이력은 다음 문서가 소유한다.

- `design/art/source/client-portrait-expression-v1.md`
- `design/art/source/counter-desk-objects-v1.md`
- `design/art/asset-manifest.json`

## 참고 라이선스

초기 시각 방향은 Pixel-boy와 AAA의 `Ninja Adventure Asset Pack`을 참고했다. 해당 팩은 CC0 1.0 Universal이며 출처는 `https://pixel-boy.itch.io/ninja-adventure-asset-pack`이다. 현재 런타임의 `client-faces.png`가 해당 팩에서 직접 추출한 산출물이다. 배역은 Woman · Noble · Villager · OldMan · Hunter · SorcererOrange이며, 원본 zip은 저장소에 커밋하지 않는다(gitignore).

## 반입 규칙

- 공개 저장소와 Pages 배포에 재배포 가능한 라이선스만 사용한다.
- 새 에셋은 원본, 라이선스, 생성·변형 과정과 런타임 사용 여부를 기록한다.
- 빌드에서 참조되지 않는 런타임 에셋은 제출 전 제거한다.
