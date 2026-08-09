# Story 009: 소문 획득 판정 (신뢰·성격 필터·왜곡)

> **Day**: 2 | **Status**: Superseded | **Layer**: Feature | **Type**: Logic
> **Estimate**: 2h
> **Spec**: `design/quick-specs/rumor-network-2026-08-08.md` §4–6
> **ADR**: N/A — 3일 마감으로 ADR 파이프라인 생략

> **2026-08-09 전면 개정 영향** — 이 스토리는 3일 마감판의 as-built 기록이다.
> 본문은 당시 구현을 그대로 서술하며 수정하지 않는다.
>
> **폐기된 것**: **사실의 출처가 길드원이라는 전제.** AC-1·AC-3이 `Client.knownBy`
> 조회를 사실 공개의 관문으로 삼고, 그 조회 대상이 길드 홀에 출석한 길드원이다
> (`RumorClient = Pick<Client, 'id' | 'knownBy' | 'wealth'>`). 컨셉이 이것을
> *"길드원이 사람이 아니라 정보 단말기였다"* 로 지목했다 — 내 길드원이 온 도시의
> 비밀을 아는 것은 세계관적으로 이상하다. 개정 후 **길드원은 사실을 말하지 않는다**
> (의견·관계·자원만). 함께 흔들리는 것: 잔금 미지급이 폐지되면서 `realWealth` 사실이
> 소비처를 잃고, 그에 따라 `balance.json`의 `rumor.factsPerContract: 2`와
> AC-4(*"`talkative`는 1회에 사실 2개"*)의 "2"가 근거를 잃는다.
> **대체·확장**: `production/roadmap.md` **P0**(`realWealth`의 처분 결정 — 살릴지
> 죽일지에 따라 위 연쇄가 전부 따라 움직인다) 및 **P4**(소문 출처를 외부인·정보상으로
> 이동, `rumor.ts` 개정). 새 요구사항은 그쪽이 소유한다.
> 성격 필터, 신뢰 임계값, 왜곡과 게이트의 분리, 화자 귀속(`tellerId`)은 전부 생존하며
> 출처만 갈아 끼운다. 통합 중 뒤집은 **신뢰 게이트 → 값 게이트 순서**도 유지한다.

## Context

**필수 테스트 3번**(`technical-preferences.md`)이자 이 게임의 차별점이다. 컨셉 문서가
하루를 온전히 투입하라고 지정한 시스템.

핵심 장치는 **두 단계의 분리** — 인맥은 신뢰 무관으로 열리고, 사실은 신뢰 판정을 거친다.
이 분리가 외부 모험가 정찰(Story 015)을 성립시킨다.

## Acceptance Criteria

- [x] 대화 시 ① 그 사람이 아는 **열린 의뢰의 의뢰인**이 `discoveredContacts`에 기록된다 — **신뢰 무관**
- [x] ② 사실 공개는 성격별 신뢰 임계값을 넘어야 한다 (`default` 0.4 / `cautious` 0.6 / `loyal` 0.2)
- [x] `Client.knownBy`에 없는 사람은 그 의뢰의 사실을 **절대** 말하지 않는다
- [x] `talkative`는 1회에 사실 2개, 그 외는 1개
- [x] `greedy`는 `greedyPrice`(20G)를 요구하고, 지불을 거절하면 침묵한다
- [x] `bitter`는 위험도를 `+traitDistortion` 만큼 높게, `boastful`은 낮게 전한다
- [x] 왜곡은 **표시값에만** 걸린다 — `revealedFacts`에는 사실 id가 그대로 들어간다
- [x] 획득한 사실마다 **누가 말했는지**를 보관한다 (결과 대조용)
- [~] 하루에 같은 사람과 두 번 대화할 수 없다
- [~] 의뢰가 종료되면 그 의뢰의 사실은 더 이상 조회되지 않는다
- [x] 같은 시드 + 같은 대화 순서면 항상 같은 사실이 나온다

## Implementation Notes

- 파일: `src/domain/rumor.ts`
- **왜곡과 게이트를 분리하는 것이 핵심이다.** 위험 고지 축(Story 011)이 열리는 조건은
  "사실을 획득했는가"이지 "값이 정확한가"가 아니다. `boastful`의 말을 믿고 위험을
  과소평가하는 것이 곧 플레이어의 실수가 되어야 한다
- "누가 말했는지"를 보관하지 않으면 결과 대조 화면에서 *"당신은 카린의 말을 믿었다"*
  를 쓸 수 없다. 이것이 성격 필터를 학습 가능하게 만드는 유일한 연결이다
- 성격 태그는 플레이어에게 **항상 보인다**. 왜곡이 무작위가 아니라 체계적이어야
  "저 사람 말은 깎아 듣자"를 배울 수 있다

## Out of Scope

- 홀 출석자 결정 — Story 010
- 위험 고지 축 연동 — Story 011
- 신뢰 갱신 — Story 013

## QA Test Cases

- **AC: knownBy 밖은 침묵**
  - Given: `knownBy`에 없는 모험가, 신뢰 1.0
  - When: 대화
  - Then: 해당 의뢰의 사실이 하나도 공개되지 않는다
- **AC: 성격별 임계값**
  - Given: 신뢰 0.5, `cautious`(0.6) / `default`(0.4) / `loyal`(0.2)
  - Then: `cautious`만 침묵, 나머지는 말한다
  - Edge: 신뢰가 임계값과 정확히 같으면 말한다 (`>=`)
- **AC: 왜곡 방향**
  - Given: 실제 위험도 100, `traitDistortion` 0.15
  - Then: `bitter` 전달값 115 > 실제 100 > `boastful` 전달값 85
- **AC: 왜곡이 게이트를 막지 않음**
  - Given: `boastful`에게서 `realRisk` 획득
  - Then: `revealedFacts`에 사실 id가 들어간다 (표시값이 낮아도)
- **AC: talkative 개수**
  - Given: 사실 2개를 아는 `talkative`
  - Then: 1회 대화에서 2개 전부 공개
- **AC: 결정론**
  - Given: 같은 시드, 같은 대화 순서
  - Then: 공개된 사실 집합과 표시값이 동일

## Test Evidence

`tests/unit/domain/rumor.test.ts` — **필수 테스트 3번**
**Status**: [x] 작성 완료 · 통과 — 테스트 27개. 전체 스위트 247개 통과.

## Implementation Deviations

> 이 스토리는 **서브에이전트(gameplay-programmer)가 병렬로 구현**했고, 통합과 아래
> 순서 변경은 메인 세션이 했다.

### AC 9/11 — 두 항목은 호출자의 몫으로 남았다

`resolveTalk`은 순수 함수이고 세션 상태를 모른다. 그래서:

- **"하루에 같은 사람과 두 번 대화할 수 없다"** — 대화 이력을 들고 있어야 하므로
  `GameState`가 할 일이다. Story 010(길드 홀)이 `talkedToday` 같은 집합을 두고 막는다.
- **"의뢰가 종료되면 그 의뢰의 사실은 더 이상 조회되지 않는다"** — `resolveTalk`은
  넘겨받은 `openContracts`만 본다. **호출자가 열린 의뢰만 넘기면 자동으로 성립**하지만
  지금은 관례일 뿐 강제되지 않는다. Story 010 통합 시 확인할 것.

### 통합 중 바꾼 것: 신뢰 게이트를 값 게이트보다 앞으로

에이전트의 최초 구현은 **값을 치렀는데 신뢰가 모자라면 돈만 받고 침묵**했다.
스펙이 두 게이트를 따로 정의하니 해석 자체는 타당했지만, **플레이어는 신뢰 수치를 볼 수
없다.** 20G를 내고 아무 설명 없이 침묵을 사는 것은 컨셉의 1순위 리스크("창발이 무작위로
느껴짐")를 정면으로 건드린다.

순서를 뒤집어 신뢰를 먼저 본다. 부수 효과가 오히려 설계적으로 낫다 — **`greedy`가 값을
요구한다는 것 자체가 "신뢰는 충분하다"는 읽을 수 있는 신호**가 된다. 성격 태그는 항상
보이므로 플레이어는 "이 사람은 돈만 내면 말한다"를 배울 수 있다.
`test_distrusting_greedy_person_does_not_take_the_money`와
`test_greedy_person_who_trusts_you_does_take_the_money`가 양방향으로 고정한다.

### 에이전트의 해석 판단 (확인 후 유지)

1. **왜곡은 `realRisk`에만 건다.** 스펙 §5의 표가 "위험도"만 가리키고 `realWealth`
   왜곡은 정의되어 있지 않다. `realWealth`는 항상 진짜 값으로 전해진다.
2. **성격 태그가 둘 다 걸릴 때(`cautious`+`loyal`, `bitter`+`boastful`)는 `traits`
   배열 순서상 먼저 오는 쪽.** `text.ts`의 `variantFor`와 같은 규칙이라 일관된다.
3. **`RevealedFact`가 `statedValue`와 `actualValue`를 둘 다 싣는다.** 결과 대조
   화면(Story 014)이 "당신은 카린의 말을 믿었다"를 쓰려면 대조할 두 값이 모두 필요하다.
   `tellerId`도 같은 이유로 실린다.

### 공유 파일 변경: 없음

`balance.json`의 `rumor` 절에 필요한 노브 5개가 이미 전부 있었다.

## Dependencies

- Depends on: Story 001, 002, 006
- Unlocks: Story 010, 011, 014, 015
