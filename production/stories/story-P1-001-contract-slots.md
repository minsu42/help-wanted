# Story P1-001: 의뢰서의 칸 — 타입과 저장

> **Phase**: P1 | **Status**: Done | **Layer**: Domain | **Type**: Logic
> **GDD**: `design/gdd/intake-system.md` (v6.2) R1 · R7 · F1
> **ADR**: ADR-001 D1·D2·D3·D4·D6 / ADR-004 (**Accepted** — 칸 어휘 7개 재정의, `Limiter` 2값, 저장 5종/표시 3종)
> **Created**: 2026-08-10

## Context

**완료 전에는 청취가 좁힐 빈칸이 타입에 존재하지 않았다.** `Contract`는 위험도 스칼라
하나로 의뢰의 전부를 표현했고, *"숲에 트롤 세 마리"* 와 *"북쪽 길의 호위"* 를
구별하는 필드가 없었다. 2026-08-10 P1-001 구현으로 슬롯 타입과 진실/진행 저장 위치가
추가됐으며, 실제 직업별 실현은 P1-002가 이어받는다.

이 스토리는 **P1 전체의 지반**이다. P1-002(직업 실현)·P1-004(응답 판정)·의뢰서
화면·P2 결과 대조가 전부 여기서 정의되는 타입 위에 선다.

**두 가지가 이 스토리에서 영구히 굳는다:**

1. **칸 배열 순서 = RNG 소비 순서 = 저장 포맷의 일부.** `SLOT_NAMES`의 순서를
   바꾸는 것은 밸런스 조정이 아니라 **스키마 변경**이다
2. **`미상` ≠ `막힘`.** 정보량으로는 같지만 하나는 플레이어의 태만이고 하나는
   불가항력이며, **그 구별이 P2 책임 귀속의 유일한 근거다** (기둥 6)

> **ADR-004는 Accepted다 (2026-08-10).** 6→7 확장과 `Limiter` 2값화의 소유자는
> ADR-004이고, 이 스토리는 그 결정의 **구현**이지 결정의 소유자가 아니다.
> *"ADR-001대로 되어 있다"* 로 인용하면 사실이 아닌 것을 근거로 삼게 된다.

**지금이 유일한 무료 구간이다** — 세이브 파일이 세상에 0개이므로 마이그레이션 비용이
정확히 0이다. 이 창이 닫힌 뒤에는 같은 변경이 공짜가 아니다.

## GDD 요구 인용

- **R1** — *"**칸 어휘는 7개다**"*:
  `의뢰 종류 · 대상 · 규모 · 장소 · 기한 · 경로 · 특징 및 약점`.
  *"**전부 자동 기록이며 플레이어는 수정할 수 없다.** 칸을 채우는 유일한 주체는 청취
  판정(F2)이다."*
- **R1** — *"**`미상`과 `막힘`은 반드시 갈라 저장한다** — P2 책임 귀속의 유일한
  근거다 (불변)."*
- **R1** — *"`막힘`은 화면상 `미확인`에 접히지만 **저장에서는 반드시 갈라 둔다**."*
- **F1** — *"**RNG 소비 순서 고정**: 칸은 **스키마 순서**로 소비한다."*
- **F1** — *"**새 칸은 반드시 스키마 맨 뒤에 붙인다.** 중간에 끼우면 그 뒤 칸 전부의
  RNG 소비 위치가 밀려 **같은 시드가 다른 의뢰를 낳는다.**"*
- **R7** — *"칸을 비운 채 다음으로 간다. **막다른 길은 없다**"* — 미채움은 유효 상태다.
- **ADR-001 D4** — *"진실은 `Contract`에, 진행은 `PlayerKnowledge`에."*
- **ADR-004 D3** — *"표시 3종은 **파생 뷰**다. 저장하지 않는다."*

## Acceptance Criteria

- [x] `SlotName`이 **닫힌 유니온 7값**이다 — `'kind' | 'target' | 'scale' | 'place' | 'deadline' | 'route' | 'weakness'` (ADR-004 D1)
- [x] `SLOT_NAMES` 배열이 **정확히 이 순서**다: `kind → target → scale → place → deadline → route → weakness`. `weakness`가 **맨 뒤**다 (F1 · ADR-004 D1)
- [x] `SLOT_NAMES`의 순서를 고정하는 테스트가 존재한다 — 배열을 재정렬하면 **실패한다**. 이 테스트의 실패 메시지가 *"스키마 변경이다"* 를 말한다 (F1)
- [x] `Reach`가 3단(`none`/`vague`/`certain`), `SlotState`가 4단(`unknown`/`blocked`/`vague`/`certain`)이며 **별개 타입**이다 (ADR-001 D2)
- [x] `Limiter`가 **2값**이다 — `'knowledge' | 'disclosure'`. `'question'`이 존재하지 않는다 (ADR-004 D2)
- [x] `SlotProgress`의 `limiter`는 `state === 'blocked'`일 때만 존재한다 — `certain`/`vague`/`unknown`에 사유가 붙지 않는다 (ADR-001 D3)
- [x] **구별 가능한 5종이 직렬화 왕복에서 보존된다** — `('unknown',—)` / `('blocked','knowledge')` / `('blocked','disclosure')` / `('vague',—)` / `('certain',—)`. 하나라도 같아지면 실패 — **AC-DET-04**
- [x] `sheetMark()`가 5종을 3종(`confirmed`/`ambiguous`/`unfilled`)으로 접고, **`unfilled`가 `미상`·`막힘(무지)`·`막힘(은폐)` 셋을 전부 덮는다** (ADR-004 D3)
- [x] *(정적)* `SheetMark`를 인자로 받아 `SlotState`/`SlotProgress`를 만드는 함수가 **존재하지 않는다**. 세이브 DTO에 `SheetMark`가 **등장하지 않는다** — 역방향 경로 0개 (ADR-004 D3)
- [x] `SlotTruth`(`knows`/`tells`/`valueKey`/`weight`)가 `Contract.slots: ReadonlyMap<SlotName, SlotTruth>`에 있고 **불변**이다 (ADR-001 D4)
- [x] `SlotProgress`가 `PlayerKnowledge.slotProgress: ReadonlyMap<string, SlotProgress>`(키 `` `${contractId}:${slotName}` ``)에 있다. **`Contract`에 진행도 필드가 0개다** (ADR-001 D4)
- [x] 키가 없는 것은 `state='unknown'`과 같다 — **묻지 않은 것은 기록되지 않는다** (ADR-001 D4)
- [x] *(정적)* 플레이어 입력이 칸 값에 도달하는 코드 경로가 **0개**다 — 칸의 유일한 기록자는 청취 판정이다 — **AC-R13-04**
- [x] **AC-CF-05** — 의뢰서가 읽는 값이 전부 `slotProgress`에서 파생되고, 의뢰서가 칸 값을 쓰지 않는다
- [x] `npx tsc --noEmit` 무경고. 기존 스위트 전부 통과

## Implementation Notes

- 파일: `src/domain/types.ts` (확장), `src/domain/slots.ts` (신설 — `SLOT_NAMES`·`sheetMark()`)
- **기존 필드를 하나도 제거하지 않는다.** 협상·파견·소문이 영향받지 않아야 한다
  (ADR-001 「되돌리는 법」). `Contract`에 `questKind`와 `slots`를 **더한다**
- **`SheetMark`의 리터럴이 `SlotState`와 겹치지 않는 것은 의도다.** 겹치면 잘못된
  자리에 대입해도 컴파일이 통과하고, *"화면이 3종이니 타입도 3종이면 되겠다"* 는
  오독으로 미끄러지는 경사면이 된다 (ADR-004 Alternatives 1행)
- **`ReadonlyMap`을 쓰는 이유**: 어느 칸이 열리는지가 데이터로 정해지므로 7개를
  전부 옵셔널로 여는 것보다 *"있는 것만 담는다"* 가 정확하다. 그리고 **평면
  옵셔널 필드는 칸을 늘릴 때마다 타입이 자라지만 `Map`은 자라지 않는다**
- ⚠ **`Map` 직렬화는 자동이 아니다.** `Map ↔ 배열` 변환 규약은 ADR-002 소관이며,
  이 스토리는 **왕복 보존만** 책임진다
- **P1-001 자체는 RNG를 더 소비하지 않는다.** 이 스토리는 타입과 저장 위치만 만들고,
  `knows`/`tells` 실현은 P1-002가 소유한다. 기존 생성 경로는 `questKind='legacy'`와 빈
  슬롯 맵을 사용하므로 기존 시드 결과가 유지된다. P1-002에서 소비가 늘어날 때 시드
  기대값 변경을 **스키마 변경의 결과**로 함께 기록한다
- 한국어 표시명은 `text.json`이 소유한다 — **코드에는 영문 리터럴만** 둔다
- 런타임 리터럴은 `'weakness'`로 확정됐다. `'trait'`을 쓰지 않은 이유는
  **`Client.traits`와 grep이 섞이기 때문**이다

## Out of Scope

- `knows`/`tells`의 **실현**(직업별 분포 추첨) — P1-002
- `balance.json`의 `intake` 절 신설 — P1-003
- `respond()` 판정과 `completeness` — P1-004
- `quest-templates.json` 신설 (칸별 사슬·`topic`·`hintTags`·`weight`) — 별도 스토리
- `Map ↔ 배열` 직렬화 규약 본체 — ADR-002 소관
- 의뢰서 화면 렌더링 — 프레젠테이션 스토리
- `RiskGrade`·`CommissionSheet` (ADR-004 D5·D7) — 의뢰서 스토리

## Test Evidence

`tests/unit/domain/slots.test.ts` — 어휘·순서 고정, 5종 왕복 보존(AC-DET-04),
`sheetMark()` 접힘, 역방향 경로 부재 정적 검사.

기존 `tests/unit/domain/contract.test.ts`는 과도기 `legacy` 의뢰와 주입된 슬롯 진실이
진행 상태와 분리되는 것을 검증한다. RNG 기대값 갱신은 실제 실현이 들어오는 P1-002에서 한다.

## Dependencies

- **Depends on**: 없음 — **P1의 첫 스토리다**
- **Unlocks**: P1-002 (직업 실현) · P1-003 (밸런스 절) · P1-004 (응답 판정) ·
  의뢰서 화면 · **P2 결과 대조** (`미상` vs `막힘` 구별이 여기서 저장되지 않으면
  P2가 할 말이 없다)
