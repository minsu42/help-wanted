# Story P1-003: `balance.json` — `intake` · `commission` 절 신설

> **Phase**: P1 | **Status**: Ready | **Layer**: Data | **Type**: Config/Data
> **GDD**: `design/gdd/intake-system.md` (v6.2) F1 · F4 · R6 · Tuning Knobs
> **ADR**: ADR-001 D5 / ADR-004 D5 (Accepted — `RiskGrade`와 실제 위험 `T`)
> **Created**: 2026-08-10

## Context

**청취의 노브가 갈 곳이 없다.** `balance.json`에 `intake` 절이 존재하지 않으므로,
P1-002가 읽어야 할 `knowsDist`·`tellsDist`·`keyLeverage`가 전부 코드에 박히거나
아예 없다. GDD Dependencies 표가 이 절을 **⚠ 절 신설 필요**로 표시하고 있다.

**금지 규칙이 이 스토리의 존재 이유다** —
`.claude/docs/technical-preferences.md` Forbidden Patterns:
*"밸런스 숫자 하드코딩 금지 — 모든 수치는 `balance.json` 한 파일에 격리한다."*
GDD Tuning Knobs도 같은 문장을 반복한다: *"**코드에 숫자를 박지 않는다.**"*

**두 절을 함께 만드는 이유**: `intake`는 *"의뢰인이 무엇을 아는가"*, `commission`은
*"그 일이 실제로 얼마나 위험한가"* 다. 둘 다 **P1 착지에 필요하고 소비처가 갈린다** —
`intake`는 청취 판정이, `commission`의 `threatByGrade`는 파견 판정 `D = P + C − T`가
읽는다. 나눠 두면 P1 착지에 절 신설 스토리가 둘이 된다.

> **이 스토리의 핵심 산출물은 숫자가 아니라 빌드 게이트다.**
> `0 < easy < counter ≤ cap`은 **테스트가 아니라 빌드에서** 깨져야 한다 (AC-F4-02).
> 이유는 F4가 *"불변식 (빌드 게이트)"* 라고 명시했기 때문만이 아니다 — **계수 조합이
> 이 식을 깨면 지갑 판정의 「부담」 구간이 소멸하거나 역제안이 수락 구간 안으로
> 들어와** 청취의 마지막 막이 조용히 무의미해진다. **화면에서 버그로 보이지 않는
> 종류의 고장이다.**

## GDD 요구 인용

- **Tuning Knobs 머리** — *"전부 `balance.json`의 `intake` 절과 `quest-templates.json`이
  소유한다. **코드에 숫자를 박지 않는다.**"*
- **F1** 표 — `knowsDist`/`tellsDist` `[none, vague, certain]`:
  주민 `[15,55,30]`/`[0,5,95]` · 상인 `[10,35,55]`/`[5,20,75]` ·
  관리 `[5,25,70]`/`[10,35,55]` · 갱단 `[0,5,95]`/`[70,25,5]` ·
  영주·귀족 `[5,20,75]`/`[45,35,20]`.
- **F4** — *"**불변식 (빌드 게이트)**: `0 < easy < counter ≤ cap`. `a`는 정수.
  `cap = round(시세 × walletMult[직업])`."*
- **F4** 표 — `walletMult`: 주민 `0.5~0.9` · 상인 `0.9~1.4` · 관리 `1.0~1.5` ·
  갱단 `1.5~4.0` · 영주·귀족 `2.0~5.0`.
- **R6** 표 — `keyLeverage`: 관리=절차 · 상인=손익 · 영주·귀족=체면 ·
  주민=(은폐 거의 없음) · 갱단=**없음**.
- **Tuning Knobs** — **인내 (의뢰인당)** 기본 **3**, 안전 범위 **2~5**.
  *"너무 높으면 헛발이 싸져 무차별 대입 / 너무 낮으면 한 번 실수로 파토 — 억울함."*
- **Tuning Knobs** — **선제 진술 깊이** 기본 **`전부`**, 범위 `전부 / 1단만 / 최소`.
  *"너무 낮으면 잡일 부활."*
- **ADR-004 Context** — *"실제 위험 `T` […] `D=3 C=4 B=5 A=6 S=7`."*
- **AC-F4-02** *(빌드 게이트)* — *"`0 < easy < counter ≤ cap`을 깨는 계수 조합은
  **빌드 실패**."*

## Acceptance Criteria

- [ ] `balance.json`에 **`intake` 절**이 신설되고, 아래를 전부 담는다:
  - [ ] `occupations[직업].knowsDist` / `tellsDist` — F1 표와 **값이 일치**한다 (ADR-001 D5의 경로명 규약)
  - [ ] `occupations[직업].keyLeverage` — R6 표. **갱단은 `null`**이다
  - [ ] `occupations[직업].walletMult` — F4 표의 `[min, max]` 범위
  - [ ] 지갑 계수 `{cap, easy, counter}` — 시세 대비 계수. 기본 `easy 0.7` / `counter 0.85`
  - [ ] `patience` = **3** (의뢰인당)
  - [ ] `openingStatementDepth` = **`"all"`** (`"all"` | `"firstRung"` | `"minimal"`)
- [ ] `balance.json`에 **`commission` 절**이 신설되고 `threatByGrade`를 담는다: **`D:3 C:4 B:5 A:6 S:7`**
- [ ] `threatByGrade`의 안전 범위가 **2~9**로 문서화된다 — 범위 밖 값은 빌드 게이트가 잡는다
- [ ] **AC-F4-02** *(빌드 게이트)* — `0 < easy < counter ≤ cap`을 깨는 계수 조합에서 **`npm run check`가 실패한다.** 테스트 실패가 아니라 **빌드 실패**여야 한다
- [ ] 빌드 게이트가 **직업 5종 전부**에 대해 검사한다 — `cap`이 `walletMult`에서 파생되므로 한 직업만 통과해도 다른 직업이 깨질 수 있다
- [ ] 빌드 게이트가 `threatByGrade`의 **5등급 전원 존재 + 2~9 범위 + 단조 증가**를 함께 검사한다
- [ ] *(정적)* `src/**` 어디에도 F1 표·F4 표·`threatByGrade`의 숫자가 리터럴로 존재하지 않는다 — Forbidden Patterns
- [ ] 각 노브에 **`_comment`가 붙어 근거를 가리킨다.** 기존 `balance.json`의 관용구를 따른다 — *"왜 이 값인가"* 와 *"무엇과 함께 움직여야 하는가"* 를 적는다
- [ ] `patience`와 `openingStatementDepth`가 **미확정 노브임이 주석에 적혀 있다** — Q1·Q7, 프로토 4회차에서 잰다
- [ ] 기존 스위트 전부 통과. `npm run check` 통과 (gzip 크기 한 줄 포함)

## Implementation Notes

- 파일: `src/data/balance.json` (확장), 빌드 게이트 스크립트 (`tools/` 또는
  `npm run check` 체인)
- **빌드 게이트를 테스트로 만들고 싶은 유혹이 크다. 하지 마라.** 테스트는 스킵할 수
  있고 CI에서 꺼질 수 있다. F4가 *"빌드 게이트"* 라고 못박은 것은 **밸런싱 중인
  사람이 값을 만지다가 조용히 부수는 것**을 막기 위해서이고, 그 사람은 테스트를
  안 돌린다. `npm run check`가 이미 gzip 크기를 한 줄 뱉으므로 **같은 체인에 붙인다**
- **`keyLeverage`를 `null`로 쓴다.** `"none"` 문자열은 재료의 `leverageTag`와 우연히
  매칭될 수 있다 (P1-002 Implementation Notes와 같은 근거)
- `walletMult`를 **범위**로 두는 이유: 값 하나면 *"시세의 네 배"* 가 직업을 **확정**해
  버린다. F4가 노린 것은 *"배수 3 이상은 갱단·귀족뿐"* 이라는 **추론**이지 확정이
  아니다. 범위가 겹치는 구간이 있어야 판별이 판단이 된다
- `openingStatementDepth`는 문자열 열거다. **숫자로 두지 않는다** — `1단만`과 `최소`가
  같은 축의 대소가 아니라 서로 다른 실험군이다 (Q7)
- ⚠ `threatByGrade`는 **`commission` 절에 두고 `intake`에 두지 않는다.** 소비처가
  파견 판정(`assignment-dispatch.md` F2·F3)이고, 청취는 이 값을 **읽지 않는다** —
  실제 위험 `T`는 파견 후에만 공개된다 (ADR-004 D6)
- ⚠ **`T`를 세이브에 평문으로 두지 않는다**는 ADR-004 D6의 요구는 이 스토리 밖이지만,
  이 절이 그 값의 **출처**가 되므로 세이브 DTO 작업자가 여기를 찾아온다.
  `_comment`에 그 사실을 적어 둔다

## Out of Scope

- 지갑 판정 로직 `respond`/`counter` 구현 — 흥정 스토리 (F4의 소비처)
- `quest-templates.json` 신설 (`w[칸]`·`opensSlots`·`topic`·`hintTags`) — 별도 스토리.
  **`w[칸]`은 이 파일이 아니라 템플릿이 소유한다** (GDD Tuning Knobs 표)
- 길드마스터북 항목 수 (`handbook` 소관, Q2) — 별도 스토리
- 인내 **소모 판정** 로직 — 청취 판정 스토리 (여기서는 초기값만)
- 실제 위험 `T`의 **세이브 재구성 경로** — ADR-002·ADR-004 D6 소관
- 값의 **튜닝** — Q1(인내 3)·Q7(선제 진술 깊이)은 프로토 4회차가 답한다.
  이 스토리는 **자리를 만들고 기본값을 넣는다**

## Test Evidence

`tests/unit/data/balance.test.ts` — `intake`·`commission` 절의 스키마 완결성
(직업 5종 × 필드 전원 존재), F1·F4·R6 표와의 값 일치, `threatByGrade` 단조 증가.

빌드 게이트 자체의 증거는 **`npm run check`의 실패 재현**이다 — 불변식을 의도적으로
깨뜨린 계수로 `npm run check`가 비영 종료하는 것을 기록한다
(`production/qa/smoke-2026-08-10.md` 또는 스토리 커밋 본문).

## Dependencies

- **Depends on**: 없음 — **데이터 절 신설은 독립적이다.** 다만 **P1-002와 함께
  착지해야 한다** (P1-002가 이 값을 읽는다. 한쪽만 머지하면 빌드가 서지 않는다)
- **Unlocks**: **P1-002** (분포·`keyLeverage`) · **P1-004** (인내 초기값) ·
  흥정 스토리 (지갑 계수) · **P2 파견 판정** (`threatByGrade` = `T`)
