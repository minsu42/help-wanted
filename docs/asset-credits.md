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

> **2026-08-10 — 이 팩에서 더 뽑아 쓸 예정이다.** 아트 바이블 §5.9(창구 인물 뷰)
> 결정으로 창구에도 같은 팩의 faceset을 쓴다. 원본 팩에는 **50명 이상**의
> faceset이 있는데 현재 파이프라인은 24명만 뽑고 있다. 확장 작업 셋: ① 추출을
> 50명+로 늘리기 ② 어깨 실루엣 합성(faceset은 목 위만 있다) ③ 표정 4종
> (평상·기색·무지·은폐) 변형 굽기. **CC0이므로 2차 저작에 제약이 없다.**

## 창구 인물 검토 *(2026-08-10)*

창구를 「창」 레지스터로 만들면서 별도 초상 팩을 들일지 검토했고, **기존 팩을
크게 쓰는 쪽으로 결론**냈다. 같은 검토를 반복하지 않도록 남긴다.

| 후보 | 라이선스 | 판정 |
|---|---|---|
| **Ninja Adventure faceset (기존 팩)** | CC0 | ✅ **채택.** 홀과 화풍이 완전히 같고, 라이선스 리스크 0, 파이프라인 존재, 50명+ 확보 가능. **팩이 하나면 같은 인물이 창구와 홀에 겹쳐 나와도 되므로 캐스트 분리 규약이 통째로 불필요해진다** — 이것이 결정적이었다 |
| **Character Portrait Kit** (DezrasDragons, OpenGameArt) | CC-BY 4.0 / OGA-BY 3.0 | ❌ 한때 추천했다가 **실물을 보고 철회.** 설명의 *"부위당 2~4색"* 과 달리 실제로는 부드러운 그라데이션 셰이딩이라 **Ninja Adventure의 플랫한 덩어리와 나란히 두면 다른 게임으로 보인다.** 캐스트도 엘프·오크·판금 갑옷 중심이라 창구에 필요한 **주민·상인·관리가 없다.** 얼굴 종류도 30종 남짓 |
| **NPC Fantasy Inn Portraits** (gamespritehub) | CC0 | ❌ 512×512에 인물 3명. 16px 기반 게임 옆에서 해상도가 정면 충돌하고, 3명으로는 캐스트가 안 된다 |
| **CC0 Portraits** (Technopeasant 컬렉션, OpenGameArt) | 개별 상이 | ❌ 여러 작가 모음이라 화풍이 제각각이고 항목마다 표기 의무가 다르다. **특수 인물 1회성 조달처로만** 유효 |
| **CaptainSkolot 주민·농민 초상 팩** 등 itch 유료 | 유료 · 재배포 대개 금지 | ❌ **표정이 9~12종 내장이라 내용은 가장 잘 맞았다.** 그러나 재배포 금지면 이 저장소에 넣을 수 없다. 빌드 시점 합성도 결과물 커밋이 곧 재배포라 우회가 아니다 |
| **LPC (Liberated Pixel Cup) 계열** | 대개 CC-BY-SA 3.0 | ❌ 전염성 라이선스라 이 프로젝트가 배제한다 (아래 「새 에셋을 넣기 전에」 참조) |

> **이 검토에서 배운 것**: 이 프로젝트의 라이선스 제약(CC0/CC-BY만)이 초상 팩
> 시장의 대부분을 걸러낸다 — 좋은 표정 내장 팩은 거의 유료·재배포 금지다.
> **다음에 인물 에셋이 필요해지면 시장 탐색보다 기존 CC0 팩의 2차 저작을 먼저
> 검토하는 것이 빠르다.**
>
> ⚠ **그리고 설명만 보고 채택하지 말 것.** 위 두 번째 줄이 그 사고다 —
> OpenGameArt 설명문의 색 수 주장과 실물이 달랐고, 시트를 열어 보고서야
> 화풍 불일치가 드러났다. **반드시 실물 시트를 보고 결정한다.**

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

## 생성·파생 에셋

### 창구 대표 의뢰인 표정 시트

| | |
|---|---|
| 결과물 | `src/assets/client-portrait-expressions.png` |
| 생성일 | 2026-08-10 |
| 제작 | OpenAI 내장 이미지 생성 + Codex 로컬 정규화 |
| 참조 | 승인된 `counter-visual-target-v2`, Ninja Adventure 형태·팔레트 |
| 규격 | 64×64 4프레임, `평상 / 기색 / 무지 / 은폐`, 투명 배경, 47색 |
| 상태 | 기술 검증 통과, 게임 내 검증 대기 |

생성 원본과 크로마키 제거본은 `design/art/source/`에 보존한다. 게임용 아틀라스는
프레임 정렬, 공통 팔레트 양자화, 하드 알파 처리를 거친 파생물이다.
