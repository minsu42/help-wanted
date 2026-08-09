# 에셋 출처와 라이선스

이 게임에 들어간 **모든 그림은 CC0(퍼블릭 도메인)** 이다. 저작권 표기 의무는 없지만
아래에 남긴다 — 심사에서 출처를 묻는 경우가 있고, 무엇보다 **나중에 이 파일들이 어디서
왔는지 알 수 없게 되는 것**을 막기 위해서다.

## 사용 중

### Ninja Adventure Asset Pack

| | |
|---|---|
| 제작 | Pixel-boy, AAA |
| 라이선스 | **CC0 1.0 Universal** (팩에 `LICENSE.txt` 동봉) |
| 출처 | https://pixel-boy.itch.io/ninja-adventure-asset-pack |
| 확인일 | 2026-08-09 |

라이선스 원문: *"They are released under the Creative Commons Zero (CC0) license.
You can use any and all of the assets found in this package in your own games,
even commercial ones. Attribution is not required but appreciated."*

원본 팩은 94MB이고 우리가 쓰는 것은 **19KB**다. 저장소에는 원본을 넣지 않는다
(`.gitignore`의 `*.zip`) — `tools/asset-pipeline/build-hall-assets.cjs`가 필요한 조각만
구워 `src/assets/`로 내보낸다.

실제로 쓴 부분:

| 결과물 | 원본 | 용도 |
|---|---|---|
| `hall-room.png` | `Backgrounds/Tilesets/Interior/*`, `TilesetElement.png` | 길드 홀 배경 (합성) |
| `cast-sprites.png` | `Actor/Character/*/SpriteSheet.png` 24명 | 방 안 인물 |
| `cast-faces.png` | `Actor/Character/*/Faceset.png` 24명 | 대화창 초상 |
| `ui-panel.png` 외 4장 | `Ui/Theme/Theme Wood/*` | 9-slice 나무 틀·버튼 |

## 검토했으나 쓰지 않음

의사결정 기록이다. 같은 팩을 다시 검토하는 낭비를 막는다.

| 팩 | 라이선스 | 쓰지 않은 이유 |
|---|---|---|
| **Tiny Swords** (Pixel Frog) | 재배포 금지 | 공개 저장소에 에셋 파일이 그대로 올라가므로 **라이선스 위반이다.** 품질과 무관하게 사용 불가 |
| **Tiny RPG Character Pack** (Zerie) | 재배포 금지 | 같은 이유 (*"You can't Resell/redistribute this asset"*) |
| **Dungeon Crawl Stone Soup** | CC0 | 쓸 수는 있다. 32×32라 더 어둡고 인물도 95명으로 많지만, **16px 가구 옆에 서면 두 칸 높이로 솟는다.** 대화용 얼굴(faceset)도 없다 |
| **Kenney Roguelike 계열** | CC0 | 쓸 수는 있다. 납작한 로그라이크 룩이라 「양피지와 봉랍」의 무게와 맞지 않고, 얼굴·UI 테마가 없다 |

> **새 에셋을 넣기 전에 반드시 라이선스를 확인할 것.** itch.io의 "무료"는 재배포
> 허용을 뜻하지 않는다. 이 프로젝트는 공개 저장소에 에셋을 커밋하고 GitHub Pages로
> 배포하므로, **재배포가 명시적으로 허용된 것(CC0, CC-BY 등)만** 쓸 수 있다.
> CC-BY-SA는 전염성이 있어 피한다.

## 에셋을 다시 굽는 법

```bash
node tools/asset-pipeline/build-hall-assets.cjs "<압축 푼 Ninja Adventure 팩 경로>"
```

`src/assets/`의 PNG들과 `src/data/hall-layout.json`이 갱신된다. 자리 좌표는 가구를
배치한 그 코드에서 나오므로, **방을 고치면 사람 자리도 자동으로 따라온다.**
