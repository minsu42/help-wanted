# Story P1-002: 의뢰인의 직업 — 무지와 은폐의 실현

> **Phase**: P1 | **Status**: Ready | **Layer**: Domain | **Type**: Logic
> **GDD**: `design/gdd/intake-system.md` (v6.2) F1 · R6
> **ADR**: ADR-001 D5·D6·D7 / ADR-004 D1 (Accepted — 칸 7개의 소비 순서)
> **Created**: 2026-08-10

## Context

**`Client`에 직업이 없어서 무지·은폐 분포를 정할 입력이 없다.** 청취의 두 축
(`knows` = 안다 / `tells` = 말해준다)이 전부 직업에서 나오는데, 그것을 뽑을 근거가
타입에 존재하지 않는다.

이 스토리는 **의뢰 생성 시점에 세계를 확정한다.** F1이 *"**여기서만 RNG를 쓴다**"* 고
못박은 자리이며, 이후 청취 전 과정은 순수 함수다 (R10).

**직업이 정하는 것은 셋이고, 셋 다 성격이 다르다:**

| | 무엇 | 어디에 쓰이나 |
| ---- | ---- | ---- |
| `knowsDist` | 얼마나 아는가 | **일깨우기**로 뚫는 벽 |
| `tellsDist` | 얼마나 말해주는가 | **들이대기**로 뚫는 벽 |
| `keyLeverage` | 무엇이 아픈가 | 들이대기가 **통하는 범주** |

**직업은 성격(`traits`)과 직교한다** — 수다스러운 갱단이 존재해야 한다. 이것이
ADR-001이 *"`traits` 재사용"* 안을 기각한 이유다: `traits`는 이미 소문 네트워크와
서술 텍스트가 소비하고 있고, 세 번째 소비처를 붙이면 밸런싱이 서로를 밀어낸다.

> ⚠ **P1에 실제로 앉는 것은 3종이다.** `noble`·`gang`은 **데이터는 생성되지만
> 등장 확률 0**이다 (ADR-001 D5) — 은폐형 앞에서 갈 곳이 없기 때문이며, 그들을
> 상대할 재료 공급원인 **소문 채널은 P4**다. 코드와 밸런스는 5종을 전부 갖추되
> **착석 추첨에서만 제외한다.** 데이터를 지우면 P4에서 다시 만들어야 한다.

## GDD 요구 인용

- **F1** — *"`knows[칸] = weightedPick(rng, occupation.knowsDist)` /
  `tells[칸] = weightedPick(rng, occupation.tellsDist)`"* — **의뢰 실현에서만 RNG를 쓴다.**
- **F1** — *"**`종류` 클램프**: `knows[종류]`·`tells[종류]`를 최소 `vague`로 올린다 —
  갱단도 자기 의뢰가 무슨 종류인지는 말한다."*
- **F1** — *"**RNG 소비 순서 고정**: 칸은 스키마 순서로 소비한다. […] 데이터 배열
  순서에 의존하면 밸런스 수정이 회귀 테스트를 깨뜨린다."*
- **R6** 표 — `keyLeverage`: 관리=**절차** / 상인=**손익** / 영주·귀족=**체면** /
  주민=*(은폐가 거의 없다)* / 갱단=**없음**.
- **R6** — *"**맞는 조건: 범주다.** 재료의 `leverageTag`가 의뢰인의 `keyLeverage`와
  같아야 한다."*
- **Edge Cases 「막힘」** — *"**갱단(`keyLeverage=없음`)**: 어떤 무기로도 안 열린다.
  **그것이 정보다.**"*
- **Edge Cases 「축퇴 의뢰」** — *"전 칸이 `none`으로 실현되면 […] **유효한 상태이며
  오류가 아니다.**"*
- **ADR-001 D7** — *"`kind` 슬롯 클램프는 **상류에서** 한다. **파생값 `reach`를 올리지
  않는다.**"*

## Acceptance Criteria

- [ ] `Occupation`이 닫힌 유니온 5값이다 — `'resident' | 'merchant' | 'official' | 'noble' | 'gang'`. `OCCUPATIONS` 배열이 함께 있다 (ADR-001 D5)
- [ ] `Client.occupation`이 존재하고 `createContract()`가 이를 실현한다
- [ ] **AC-F1-01** — 직업별 `knows`/`tells` 실현이 F1 표와 **버킷별 ±3×SE 이내**다 (몬테카를로). 5직업 × 2축 × 3버킷 = 30버킷 전부 검사한다
- [ ] **AC-F1-02** — 갱단의 `종류`가 `none`으로 실현돼도 클램프가 `vague`로 올린다
- [ ] **AC-F4-03** — 배수 3 이상은 **갱단·귀족에서만** 나온다 (몬테카를로). `walletMult` 범위가 직업을 말해 준다
- [ ] 클램프가 **상류**에서 일어난다 — `SlotTruth.knows`/`tells` 자체가 올라간다. **파생값만 올리는 구현은 실패한다** (ADR-001 D7)
- [ ] 클램프의 부수 효과가 맞다: 갱단(`knows='certain'`, `tells='none'→'vague'`)이 `limiter='disclosure'`가 된다 — *"간단한 일이오"* 계열 (ADR-001 D7)
- [ ] **AC-F1-03** — **템플릿의 칸 배열 순서를 뒤섞어도 같은 시드면 같은 실현이다.** 순회는 `SLOT_NAMES`를 따르고 `template.opensSlots`는 **필터로만** 쓴다 (ADR-001 D6)
- [ ] **AC-DET-01** — 같은 시드 + 같은 템플릿 → 같은 `knows`/`tells` 실현
- [ ] 소비 순서가 칸마다 `knows` → `tells`다. 이 순서도 고정 테스트를 갖는다
- [ ] `keyLeverage`가 직업별로 다르고, **갱단은 `null`**이다 — 어떤 `leverageTag`와도 매칭되지 않는다 (R6 · AC-R6-02의 전제)
- [ ] **AC-EDGE-04** — 전 칸 `none` 실현(축퇴)이 **오류가 아니다.** 주민 기준 확률 `0.15³ ≈ 0.3%`이므로 시드를 찾아 테스트로 고정한다
- [ ] P1 착석 추첨에서 `noble`·`gang`이 **뽑히지 않는다.** 그러나 두 직업의 분포·`keyLeverage` 데이터는 **존재한다** (ADR-001 D5)
- [ ] 모든 수치가 `balance.json`의 `intake` 절에서 읽힌다 — **코드에 분포 숫자가 0개다**

## Implementation Notes

- 파일: `src/domain/contract.ts` (확장), `src/domain/occupation.ts` (신설 가능)
- 기존 `rollWeightedIndex`(`src/domain/weighted.ts`)를 재사용한다 — 새 추첨 유틸을
  만들지 않는다
- **순회는 반드시 이렇게 쓴다:**
  ```ts
  for (const slot of SLOT_NAMES) {
    if (!template.opensSlots.includes(slot)) continue;
    // knows → tells 순서로 소비
  }
  ```
  `template.opensSlots`를 **순회하면** AC-F1-03이 즉시 깨진다. 데이터 배열 순서에
  묵시적으로 의존하면 *"코드는 안 건드리고 밸런스 데이터만 고쳤는데 회귀 테스트가
  깨진다"* 가 발생한다 (ADR-001 D6)
- **클램프를 상류에서 하는 이유가 미묘하다.** `reach`만 올리면 재질문 경로에서
  `limiter()`가 클램프 이전 값으로 계산되어 **공짜로 열린 칸에 엉뚱한 사유가 붙는다.**
  버그가 화면에서 *"이상한 대사"* 로만 보이므로 발견이 늦다 (ADR-001 D7)
- **`keyLeverage`를 `null`로 두고 `'none'` 문자열을 쓰지 않는다.** `'none'`은 재료의
  `leverageTag`와 우연히 매칭될 수 있는 값이고, 갱단의 성질은 *"없는 범주"* 가 아니라
  **"매칭이 성립하지 않음"** 이다
- 몬테카를로는 **시드 고정**으로 돌린다 — `Math.random()` 금지는 테스트에도 적용된다.
  ±3×SE는 `SE = sqrt(p(1−p)/n)`이며 `n`은 재현 가능한 상수여야 한다

## Out of Scope

- `SlotName`·`SlotTruth`·`SLOT_NAMES` **정의** — P1-001 (여기서는 소비만 한다)
- `balance.json`의 `intake` 절 **신설** — P1-003 (여기서는 읽기만 한다)
- 일깨우기·들이대기의 **판정 로직** — P1-004 및 후속
- 재료(`hintTags`·`leverageTag`)의 공급원인 **길드마스터북** — 별도 스토리 (#26)
- **소문 채널 (P4)** — `noble`·`gang`을 P1에 앉히지 않는 이유가 정확히 이것이다
- 지갑 판정 `respond`/`counter` 로직 — P1-004 · 흥정 스토리

## Test Evidence

`tests/unit/domain/occupation.test.ts` — 분포 몬테카를로(AC-F1-01, AC-F4-03),
클램프 상류 검증(AC-F1-02), `keyLeverage` 표 고정.

`tests/unit/domain/contract.test.ts` (확장) — RNG 소비 순서 불변성(AC-F1-03),
결정론(AC-DET-01), 축퇴 의뢰(AC-EDGE-04).

## Dependencies

- **Depends on**: **P1-001** (`SlotName`·`SLOT_NAMES`·`SlotTruth`) ·
  **P1-003** (`intake` 절의 분포 숫자) — *P1-003과는 함께 착지해야 한다. 한쪽만
  머지하면 빌드가 서지 않는다*
- **Unlocks**: P1-004 (응답 판정이 `knows`/`tells`를 읽는다) · 일깨우기·들이대기 ·
  의뢰인 착석 화면
