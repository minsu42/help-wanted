# 심문·추리 게임 시장조사 — 2026-08-09

> **왜 이 문서가 있는가**: `design/gdd/intake-system.md`의 **R4 개정(질문 깊이 등급)** 과
> **Q4(하루 행동 칸 = 12)** 가 이 조사를 근거로 결정됐다. 근거를 대화에만 두면 사라지므로
> 남긴다. 조사 범위는 **(가) 슬롯당 질문 1개 vs (나) 깊이 2등급** 중 하나를 고르기
> 위한 것이었고, 결론은 **(나)** 였다.

## 1. 장르 시장

| 지표 | 값 | 출처 |
| ---- | ---- | ---- |
| Steam 내러티브 장르 순위 | **#6(2022) → #4(2023) → #2(2024) → #1(2025)** | How To Market A Game |
| 2025년 1,000리뷰 돌파 내러티브 게임 | **51종** | 동일 |
| 그중 중국산 FMV | **19종** — 빼면 전통 내러티브는 3위 | 동일 |
| 1,000리뷰의 매출 환산 | **$150,000+** | 동일 |
| 탐정·추리 장르 | 2025년이 **장르 사상 최고의 해** 평가 | PC Gamer 외 |

**결론: 장르 수요는 확실히 있다.**

## 2. 배포 채널 — **해소됨 (같은 날, 사용자 결정)**

> **결론부터: GitHub Pages 고정. NAN2026 예선 제출용이므로 재검토하지 않는다.**
> 결정 기록의 소유는 `production/roadmap.md`의 「배포 채널」 절이다.
>
> 아래 §2 본문은 **조사 당시의 문제 제기**이며, 답이 나왔으므로 기록으로만 읽는다.
> 다만 **§2가 만든 파생 리스크 하나는 살아 있고 오히려 커졌다** — 이 절 끝의 「남은 것」 참조.

### (기록) 조사 당시의 문제 제기

| | Steam | itch.io |
| ---- | ---- | ---- |
| 활성 사용자 | **1억 3천만** | 프로젝트 80만+, 누적 지급 $2억+ |
| 적합한 것 | 정식 상업 출시 | **게임잼·실험작·프로토타입·2시간 이하·브라우저 게임** |
| 발견 경로 | 알고리즘 (기존 트랙션 우대) | 태그·컬렉션·**게임잼** |

**이 프로젝트는 GitHub Pages 웹 게임이고 캠페인은 8~15시간이다.**
itch에는 **너무 길고**, Steam에 올리려면 웹 배포 전제(정적 호스팅·서버 없음·`base: "./"`)가
만든 기술 결정 상당수가 의미를 잃는다.

> ~~로드맵에 배포 채널 결정이 없다.~~ → **결정됨. 채널은 GitHub Pages이고 Steam은
> 선택지가 아니다.** 따라서 *"Steam이면 「넘을 수 없는 제약」 1번을 재검토할 수 있다"* 는
> 가능성은 **소멸했다** — 서버 없음은 **영구 제약**이다.

### 남은 것 — 이 조사가 만든 진짜 리스크

배포 채널이 정해지면서 문제가 사라진 것이 아니라 **형태가 바뀌었다.**

itch/Steam 비교는 무의미해졌지만, **"8~15시간 캠페인을 20~30분만 보고 심사한다"** 는
사실은 그대로다. 오히려 채널이 고정되면서 **회피 경로가 없어졌다.**

> **심사자는 완주하지 않는다.** 로드맵의 P1~P3 → GATE 순서는 *"이 게임이 재미있는가"* 를
> 검증하는 순서이고 그건 옳지만, *"첫 30분이 심사에서 이기는가"* 는 다른 질문이다.

조치: GATE 통과 기준에 *"첫 30분만 플레이한 사람도 이 게임이 무엇인지 말할 수 있다"* 를
추가했다. 그리고 **첫 화면 1초 / 초기 전송 1MB 예산이 여기서 성능 문제가 아니라 심사
리스크가 된다** — 심사자는 링크를 열고 로딩을 기다려 주지 않는다.
자세한 것은 `production/roadmap.md` 「배포 채널」 절.

## 3. 가장 가까운 구조적 비교작 — 경고

**Interrogation: You Will Be Deceived** (Critique Gaming, 2019-12-05)

스토어 설명이 이 프로젝트와 거의 겹친다:

> *"심문은 **대화 퍼즐**이다. 배경과 동기를 이해해야 접근법을 고를 수 있다.
> **보편적 해답은 없다.**"* + **제한된 예산 관리 · 팀 편성 · 언론 대응 · 여론 관계**

**성적: 6년간 리뷰 382개(구매자 리뷰 320개 중 77% 긍정), ₩13,500.**
1,000리뷰 문턱을 넘지 못했다.

반대편의 **Papers, Please는 500만 장**(Steam 400만+, 연 50만 장)이지만:
- **이상치다** (Lucas Pope 1인 개발, 장르 정의작)
- **심문 게임이 아니라 대조(matching) 게임**이다 — 규칙집과 서류를 맞춘다.
  이 프로젝트가 **안티 기둥으로 명시 배제한** 구조다

> **읽어야 할 것**: 심문+경영 조합은 **이미 시도됐고, 평가는 나쁘지 않았고, 시장은 못
> 만들었다.** 차별점(기둥 6 — 내가 쓴 의뢰서로 사람이 죽는다)이 **마케팅 문구가 아니라
> 플레이에서 실제로 느껴져야** 하며, 그것을 확인하는 곳이 **로드맵의 GATE**다.
>
> YWBD의 부진 요인 하나로 **복잡도**가 읽힌다(예산+팀+여론+심문을 한 번에). 이 프로젝트도
> 청취·의뢰서·흥정·파견·행동 칸·세력 평판 6종·세계 변화를 쌓는 중이다.
> **단, (나)는 새 자원이 아니라 기존 자원(행동 칸)의 쓰임을 깊게 하는 것**이므로 성격이
> 다르다 — F3(인내심)을 폐기할 때 적용한 *"자원이 둘이면 무엇을 아끼는지 모른다"* 원칙을
> (나)는 어기지 않는다.

## 4. 설계 선례 — (나)를 선택한 실제 근거

### 4.1 Ace Attorney `Press` = (가)의 미래 ⚠

공략 문서가 **대놓고 이렇게 가르친다**:

> *"어떤 진술이든 누를 수 있다. 대개 정보가 조금 더 나온다.
> **위험이 거의 없으니, 모든 진술을 누르는 습관을 들여라.**"*

**무비용 + 단일 등급 = 전부 눌러보기가 지배 전략.** `intake-system.md`가
「이 판타지가 깨졌다는 신호」로 지목한 상태 그대로다.

**그 게임이 무너지지 않은 이유는 2층 구조다:**

| | 무엇 | 비용 |
| ---- | ---- | ---- |
| **Press** | 안전한 탐색. 새 진술을 끌어낸다 | **무비용** |
| **Present** | 증거를 들이대 확정한다 | **5회 페널티, 소진 시 즉시 패배** |

**탐색은 싸고 확정은 비싸다** → **R4-2 + 하루 행동 칸**이 정확히 이 구조다.
**이것이 Q4를 (나)의 부속물이 아니라 전제 조건으로 격상시킨 근거다.**

### 4.2 L.A. Noire = (가)의 다른 실패 모드 ⚠⚠

3지선다(진실/의심/거짓) 중 하나만 정답.

> *"진짜로 심문하거나 대화를 탐색하는 게 아니라 **정답 하나를 고르는 것**이다."*
> *"'의심'은 무차별 대입 선택지가 됐다 — 표정을 못 읽어서가 아니라 **게임이 뭘 원하는지
> 몰라서** 누르는 것."*

그리고 비평가들이 **처방까지 적어 놓았다**:

> *"**실제 심문 논리라면 틀린 선택에도 부분 정보가 나왔어야 한다.**"*

**뭉툭한 질문이 `모호`를 주는 것이 정확히 그 처방이다.**

> **이 사례가 앞선 판단 하나를 뒤집었다.** 검토 초기에 *"(나)가 안티 기둥 「정답이 있는
> 적발 퍼즐」에 (가)보다 가깝다"* 고 적었으나 **반대다.** 정답 퍼즐이 되는 것은 선택지가
> **하나의 옳은 값으로 붕괴할 때**이고, 부분 정보를 주는 단계 구조는 그것을 **막는** 쪽이다.
> (나)의 실제 리스크는 "정답화"가 아니라 **"두 번 누르는 절차화"** 이며, 방어는 Q4뿐이다.

### 4.3 Her Story — 후보 개수를 의도적으로 캡했다

키워드 하나에 결과가 5개를 넘으면 **6번째부터 접근 불가**로 잘랐다.
`intake-system.md`의 *"평균 후보 개수 1~3개"* 목표에 실측 선례가 있다.

Sam Barlow의 원칙: *"구글을 쓸 줄 알면 플레이할 수 있다"* —
**타이핑의 진입 장벽은 키워드 관대함으로 낮추고, 대신 결과 개수를 조인다.**
(이 프로젝트의 「질문당 keywords 8~12」 + 「평균 후보 1~3」과 같은 구조.)

### 4.4 Disco Elysium — 실패가 재미있으면 참여도가 오른다

> *"스킬 체크 실패가 성공만큼, 때로는 더 흥미로운 대사와 서사를 준다. 이것이 **실패에
> 대한 두려움을 없애** 플레이어가 시스템에 더 많이 관여하게 만든다."*

**(나)의 뭉툭한 질문은 "실패"가 아니라 부분 성공**이라 이 원리 위에 선다.
플레이어가 정확한 난이도 임계값을 미리 모른다는 점도 — 의뢰인의 `knows`/`tells` 상한을
모르는 이 게임의 구조와 같다.

## 5. 결론

**(나) 채택. 조사 전보다 근거가 강해졌다.**

찾은 두 개의 대형 실패 사례가 **둘 다 (가) 쪽 실패**이고, 두 사례의 처방이
**둘 다 (나)와 일치**한다:

| 실패작 | 실패 형태 | 처방 | 이 프로젝트의 구현 |
| ---- | ---- | ---- | ---- |
| Ace Attorney `Press` | 무비용 단일 등급 → 전부 누르기 | 확정 행위에 비용 | **R4-2 + 하루 행동 칸 12** |
| L.A. Noire | 정답 하나 고르기 | 틀린 선택에도 부분 정보 | **뭉툭 → `모호`** |

## 6. 찾지 못한 것

**Case of the Golden Idol / The Roottrees are Dead의 어휘 학습 설계 포스트모템을 못
찾았다.** 두 게임이 이 프로젝트와 가장 가까운 **최신 성공작**이라 아쉽다 —
Roottrees는 *"Obra Dinn의 빈칸 채우기 + Her Story의 검색 조사"* 로 평가되며 2025년
인디 추리 돌파작이었다. GDC Vault·개발자 인터뷰를 더 파 볼 가치가 있다.

## 참고 링크

- [What the hell happened in 2025? — How To Market A Game](https://howtomarketagame.com/2026/01/27/what-the-hell-happened-in-2025/)
- [2025 was the best year for the detective genre ever — PC Gamer](https://www.pcgamer.com/games/adventure/im-obsessed-with-detective-games-and-i-think-these-9-prove-that-2025-was-the-best-year-for-the-genre-ever/)
- [Interrogation: You will be deceived — Steam](https://store.steampowered.com/app/1016770/Interrogation_You_will_be_deceived/)
- [Interrogation: You will be deceived review — Adventure Gamers](https://adventuregamers.com/article/interrogation-you-will-be-deceived)
- [Phoenix Wright: Ace Attorney/Gameplay — StrategyWiki](https://strategywiki.org/wiki/Phoenix_Wright:_Ace_Attorney/Gameplay)
- [Trial — Ace Attorney Wiki](https://aceattorney.fandom.com/wiki/Trial)
- [L.A. Noire's Interrogation System — Game Developer](https://www.gamedeveloper.com/design/l-a-noire-s-interrogation-system)
- [L.A. Noire's Interrogation System — Significant Bits](https://significant-bits.com/l-a-noires-interrogation-system/)
- [Making 'Her Story' — GDC Vault](https://www.gdcvault.com/play/1023430/Making-Her-Story-Telling-a)
- [Interrogating Her Story Creator Sam Barlow — App Unwrapper](https://www.appunwrapper.com/2015/07/10/help-interrogate-sam-barlow-about-her-story/)
- [Disco Elysium and the Meaning of Failure](https://gameplayreflections.wordpress.com/disco-elysium-and-the-meaning-of-failure/)
- [Disco Elysium RPG System Analysis — Game Design Thinking](https://gamedesignthinking.com/disco-elysium-rpg-system-analysis/)
- [How many copies did Papers, Please sell? — LEVVVEL](https://levvvel.com/papers-please-statistics/)
- [Steam vs Itch.io for Indie Developers — Fungies.io](https://fungies.io/steam-vs-itch-io-indie-developers/)
