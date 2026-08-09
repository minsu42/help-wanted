# ADR-001 — `Contract` 슬롯 집합과 `Client.occupation`

| | |
| ---- | ---- |
| **상태** | **Accepted** |
| **날짜** | 2026-08-10 |
| **결정자** | 강민수 (사용자 승인) + `lead-programmer` 관점 |
| **로드맵 단계** | P1 — 청취 + 의뢰서 작성 |
| **근거 설계 문서** | `design/gdd/intake-system.md` (정식 GDD, `/design-review` full 통과 후 2회 개정) |
| **대체하는 것** | 없음 — **이 저장소의 첫 ADR이다** |

---

## 이 디렉터리에 대하여

`.claude/docs/coding-standards.md`는 *"모든 시스템은 `docs/architecture/`에 대응 ADR이
있어야 한다"* 를 요구하는데 **디렉터리가 존재하지 않았다.** 3일 마감으로 파이프라인을
축약했고 그 근거가 소멸했다.

**전 시스템 ADR 요구를 소급 적용하지 않는다.** `production/roadmap.md`의
「ADR을 언제 쓰는가」가 정한 기준은 **경계가 바뀔 때만**이다 — 타입 스키마 변경 ·
계층 경계 이동 · 지속성 포맷 · 런타임 의존성 추가. 이 ADR은 그중 첫 번째에 해당한다.

---

## Context

### 무엇이 문제인가

`Contract` 타입에 **무슨 일인가를 담는 필드가 하나도 없다.**

```ts
// 현재 (src/domain/types.ts)
export interface Contract {
  readonly id: string;
  readonly client: Client;
  readonly statedRisk: number;   // 의뢰인이 주장하는 위험도
  readonly realRisk: number;     // 실제 위험도 (렌더링 금지)
  readonly concealment: number;  // 숨긴 비율
  readonly baseReward: number;
  readonly maxPartySize: number;
  readonly durationDays: number;
  readonly isTemptation: boolean;
  readonly facts: readonly Fact[];
}
```

위험도라는 **스칼라 하나**가 의뢰의 전부다. *"숲에 트롤 세 마리"* 와 *"북쪽 길의 호위"* 를
구별하는 필드가 없다. `game-concept.md`의 2026-08-09 전면 개정이 이것을 첫 번째 개정
사유로 지목했다 — *"게임의 무대가 텅 빈 채로 나머지가 지어졌다."*

청취(P1)는 **의뢰의 빈칸을 좁히는 시스템**이므로, 좁힐 빈칸이 타입에 존재하지 않으면
구현할 수 없다. 그리고 `Client`에는 **직업**이 없어서 무지·은폐 분포를 정할 입력이 없다.

### 왜 두 변경을 한 ADR로 묶는가

`Client.occupation`과 `Contract`의 슬롯은 **같은 생성 경로(`createContract()`)에서 함께
실현된다.** 직업이 `knows`/`tells` 분포를 정하고, 그 분포로 슬롯의 숨은 상한을 뽑는다.
나눠 쓰면 두 ADR이 서로를 전제하게 되므로 하나로 쓴다. GDD의 Dependencies 절도 같은
권고를 적고 있다.

### 제약

1. **결정론** — 같은 시드 + 같은 입력이면 항상 같은 결과 (기둥 5, 「넘을 수 없는 제약」 2번)
2. **서버 없음** — GitHub Pages 정적 배포. NAN2026 예선용이며 **영구 제약**이다
3. **밸런스 하드코딩 금지** — 수치는 `balance.json`, 구조는 `quest-templates.json` /
   `questions.json`
4. **런타임 의존성 0개**
5. **기존 진실/지식 분리 규약** — `types.ts` 머리주석이 정한 것: `Contract`는 **진실**,
   `PlayerKnowledge`는 **플레이어가 알아낸 것**. *"이 정보가 공개됐던가?"* 플래그를
   필드마다 흩뿌리지 않는다

---

## Decision

### D1. 슬롯 어휘는 6개이고 타입이 닫는다

```ts
/**
 * 의뢰가 가질 수 있는 빈칸의 전체 목록. **닫힌 유니온이다.**
 *
 * 의뢰 종류는 *어느 슬롯이 열리는지*만 정하고 슬롯 자체는 공유한다 — 이것이 질문
 * 카탈로그의 조합 폭발을 막는 유일한 장치다. 의뢰 종류를 12종으로 늘려도 이 유니온은
 * 그대로다.
 */
export type SlotName = 'kind' | 'target' | 'scale' | 'place' | 'deadline' | 'route';

export const SLOT_NAMES: readonly SlotName[] = [
  'kind', 'target', 'scale', 'place', 'deadline', 'route',
];
```

**`SLOT_NAMES`의 배열 순서가 RNG 소비 순서다** (D6 참조). 한국어 표시명은 `text.json`이
소유한다 — 코드에는 영문 리터럴만 둔다 (`technical-preferences.md`의 명명 규약: Result /
State 리터럴은 소문자 문자열 유니온).

### D2. 사다리는 `Reach` 3단, 화면 상태는 `SlotState` 4단 — 갈라 둔다

```ts
/** 얼마나 깊이 아는가 / 말해주는가 / 물었는가. 순서 있는 사다리다. */
export type Reach = 'none' | 'vague' | 'certain';

/** 슬롯의 플레이어 측 상태. **`unknown`과 `blocked`를 반드시 갈라 저장한다.** */
export type SlotState = 'unknown' | 'blocked' | 'vague' | 'certain';
```

`Reach`와 `SlotState`가 `vague`/`certain`을 공유하는 것은 의도다 — `reach`가 곧 상태로
승격되기 때문이다. 다른 점 둘:

- `reach='none'` → `state='blocked'` (**물었으나 얻지 못했다**, 사유가 붙는다)
- `state='unknown'`에 대응하는 `reach`는 **없다** (**묻지 않았다** — 판정을 돌린 적이 없다)

> **이 둘을 합치면 안 되는 이유가 이 ADR에서 가장 중요하다.** 정보량으로는 같다(어느
> 쪽이든 플레이어는 모른다). 그러나 **`unknown`은 플레이어의 태만이고 `blocked`는
> 불가항력**이며, 그 구별이 **P2의 3단 대조가 책임과 억울함을 가르는 유일한 근거**다
> (기둥 6). 타입이 둘을 갈라 놓지 않으면 P2에서 복원할 방법이 없다.
>
> ⚠ `production/roadmap.md`의 P1 절이 **슬롯을 3상태로 적고 있었다**(`blocked` 누락).
> 2026-08-09에 정정했다. **같은 실수가 재발하기 쉬운 지점이다.**

### D3. 정체 사유는 3값이다

```ts
/** 슬롯이 더 열리지 않은 이유. `reach !== 'certain'`인 모든 경우에 계산된다. */
export type Limiter =
  | 'knowledge'   // 의뢰인이 모른다 (무지)
  | 'disclosure'  // 알지만 말하지 않는다 (은폐)
  | 'question';   // **뭉툭하게 물었다 — 벽이 의뢰인이 아니라 플레이어다**
```

`'question'`은 `reach='none'`에서 **구조적으로 나올 수 없다** (`knows`나 `tells`가
`none`이면 그것이 항상 최솟값이다). GDD의 F2 경계값 표가 전 조합을 검증한다.

### D4. 진실은 `Contract`에, 진행은 `PlayerKnowledge`에 — 기존 규약을 지킨다

**이것이 이 ADR의 핵심 계층 결정이다.**

```ts
/** 슬롯 하나의 숨은 진실. **렌더링 금지.** 의뢰 생성 시점에 확정되고 이후 불변이다. */
export interface SlotTruth {
  /** 의뢰인이 아는 최대치 */
  readonly knows: Reach;
  /** 의뢰인이 말해줄 최대치 */
  readonly tells: Reach;
  /** 실제 값의 텍스트 키. `text.json`이 문장으로 만든다 */
  readonly valueKey: string;
  /** F5 정보 충실도의 가중치. `quest-templates.json`이 종류별로 정한다 */
  readonly weight: number;
}

export interface Contract {
  // ... 기존 필드 전부 유지 ...
  /** 이 의뢰의 종류. `quest-templates.json`의 키 */
  readonly questKind: string;
  /**
   * 열린 슬롯의 숨은 진실. **`kind`는 항상 존재한다** (R2).
   *
   * `Partial`이 아니라 `ReadonlyMap`인 이유: 어느 슬롯이 열리는지가 데이터(의뢰 종류)로
   * 정해지므로, 타입이 6개 전부를 옵셔널로 여는 것보다 "있는 것만 담는다"가 정확하다.
   */
  readonly slots: ReadonlyMap<SlotName, SlotTruth>;
}
```

```ts
/** 슬롯 하나에 대해 플레이어가 알아낸 것. */
export interface SlotProgress {
  readonly state: SlotState;
  /** `state`가 `'certain'`이 아닐 때만 존재한다 (D3) */
  readonly limiter?: Limiter;
}

export interface PlayerKnowledge {
  // ... 기존 3필드 유지 ...
  /**
   * 청취로 좁힌 슬롯 상태. 키는 `` `${contractId}:${slotName}` ``.
   *
   * **`Contract`가 아니라 여기 있는 이유**: 이것은 진실이 아니라 **플레이어가 알아낸
   * 것**이고, `types.ts` 머리주석이 정한 분리가 정확히 그것이다. 진실 옆에 진행도를
   * 두면 *"이 정보가 공개됐던가?"* 플래그를 필드마다 흩뿌리는 길로 돌아간다.
   *
   * 없는 키는 `state='unknown'`과 같다 — **묻지 않은 것은 기록되지 않는다.**
   */
  readonly slotProgress: ReadonlyMap<string, SlotProgress>;
}
```

> **`Contract.slots`에 `state`를 같이 두는 안을 기각했다.** 한 객체만 보면 되니 편해
> 보이지만, `Contract`가 *"세상이 아는 진실"* 에서 *"플레이어 세션 상태"* 로 성격이
> 바뀐다. 그러면 (1) 결과 대조 화면이 진실과 인식을 나란히 못 놓고, (2) 저장 포맷이
> 진실까지 직렬화하게 되어 **`localStorage`를 열면 정답이 보인다** — 정적 호스팅에서
> 세이브 스캐밍 방어가 이미 약한데 여기서 더 약해진다.

### D5. `Client.occupation` — 분포의 출처

```ts
/**
 * 의뢰인의 직업. **무지·은폐 분포와 문안 레지스터를 동시에 정한다.**
 *
 * 성직·군인은 P5 이후. 갱단·귀족은 데이터는 있으나 **P1에서는 등장 확률 0**이다 —
 * 소문 채널(P4)이 없으면 은폐형 앞에서 갈 곳이 없다.
 */
export type Occupation = 'resident' | 'merchant' | 'official' | 'noble' | 'gang';

export const OCCUPATIONS: readonly Occupation[] = [
  'resident', 'merchant', 'official', 'noble', 'gang',
];

export interface Client extends Person {
  // ... 기존 필드 전부 유지 ...
  readonly occupation: Occupation;
}
```

분포는 `balance.json`의 `intake.occupations[occupation].knowsDist / tellsDist`
(`[none, vague, certain]` 가중치)에 있다. **코드에 숫자를 박지 않는다.**

### D6. RNG 소비 순서를 `SLOT_NAMES`에 고정한다

`createContract()`가 슬롯을 순회할 때 **`quest-templates.json`의 배열 순서가 아니라
`SLOT_NAMES`의 고정 순서**를 따른다.

```ts
for (const slot of SLOT_NAMES) {
  if (!template.opensSlots.includes(slot)) continue;
  // knows → tells 순서로 소비
}
```

**근거**: 데이터 배열 순서에 묵시적으로 의존하면 *"코드는 안 건드리고 밸런스 데이터만
고쳤는데 회귀 테스트가 깨진다"* 가 발생한다. 이 순서는 **저장 포맷의 일부처럼 취급한다** —
`SLOT_NAMES`의 순서를 바꾸는 것은 스키마 변경이다.

### D7. `kind` 슬롯 클램프는 상류에서 한다

```ts
knows.kind = max(knows.kind, 'vague');
tells.kind = max(tells.kind, 'vague');
```

**파생값 `reach`를 올리지 않는다.** `reach`만 올리면 재질문 경로에서 `limiter()`가
클램프 이전 값으로 계산되어 **공짜로 열린 슬롯에 엉뚱한 사유가 붙는다.**

부수 효과가 정확히 맞는다 — 갱단(`knows='certain'`, `tells='none'→'vague'`)은
`limiter='disclosure'`가 되고, 이는 *"간단한 일이오"*(종류는 말하지만 그 이상은 주지
않는다) 계열 문안과 일치한다.

---

## Alternatives Considered

| 안 | 왜 기각했나 |
| ---- | ---- |
| **슬롯을 `Contract`의 평면 옵셔널 필드로** (`target?: SlotTruth` …) | 6개가 전부 옵셔널이 되어 *"이 의뢰에 이 슬롯이 열렸는가"* 를 타입이 말해주지 못한다. 그리고 슬롯을 추가할 때마다 타입이 자란다 — `ReadonlyMap`은 자라지 않는다 |
| **슬롯 상태를 `Contract`에 함께 저장** | D4의 기각 기록 참조. 진실과 인식이 섞이고 세이브에 정답이 들어간다 |
| **`SlotName`을 `string`으로 열어 두고 데이터가 정의** | 조합 폭발을 막는 장치가 *"어휘가 유한하다"* 인데, `string`이면 그 보장이 타입에서 사라진다. 질문 카탈로그가 슬롯 단위 공용인 것도 성립하지 않는다 |
| **`Reach`와 `SlotState`를 한 타입으로 통합** | `unknown`(묻지 않았다)과 `blocked`(물었으나 못 얻었다)가 합쳐질 위험이 상시 존재한다. **기둥 6의 근거가 타입에서 사라진다** |
| **`Limiter`를 2값 유지** (`knowledge`/`disclosure`) | 질문 깊이 등급(GDD R4)이 도입되면서 *"벽이 플레이어 자신"* 인 경우가 생겼다. 2값으로 두면 그 경우를 `knowledge`로 뭉개게 되고, **이 저장소가 소문 시스템에서 이미 한 번 낸 사고**(`rumorNothingToTell`)와 같은 형태가 된다 |
| **`Client.occupation` 대신 기존 `traits` 재사용** | `traits`는 이미 소문 네트워크와 서술 텍스트가 소비하고 있다. 세 번째 소비처를 붙이면 밸런싱이 서로를 밀어낸다. 그리고 직업은 성격과 직교한다 — 수다스러운 갱단이 존재해야 한다 |

---

## Consequences

### 좋아지는 것

- 청취(P1)·의뢰서(P1)·3단 대조(P2)가 딛고 설 타입이 생긴다
- **`unknown`/`blocked` 구별이 타입 수준에서 강제**되어 기둥 6이 컴파일러의 보호를 받는다
- 슬롯 어휘가 닫힌 유니온이라 **의뢰 종류를 늘려도 질문 카탈로그가 안 자란다**
- `slotProgress`가 `PlayerKnowledge`에 있으므로 저장 포맷에 진실이 섞이지 않는다

### 대가와 위험

1. **⚠ 기존 시드가 전부 다른 세계를 만든다.** `createContract()`의 RNG 소비가 늘어나므로
   (직업 추첨 + 슬롯당 `knows`/`tells`), **같은 시드의 이전 결과가 재현되지 않는다.**
   - 결정론 요구는 **앞으로는** 유지된다 — 깨지는 것은 과거와의 호환뿐이다
   - 시드를 하드코딩한 기존 테스트가 깨진다. **기대값을 갱신해야 하며, 그것을 "테스트를
     고쳤다"가 아니라 "스키마가 바뀌었다"로 기록할 것**
   - 세이브 파일은 아직 없으므로 마이그레이션 대상이 없다. **이것이 지금 하는 이유다**
2. **`Contract`가 커진다.** `ReadonlyMap`이 들어오면서 JSON 직렬화가 자동이 아니게 된다
   — `persistence` 스펙이 `Map ↔ 배열` 변환을 정해야 한다. **다음 ADR의 입력이다**
3. **`quest-templates.json`이 신설된다.** 종류별 열리는 슬롯 + F5 가중치. 가중치 상한
   3:1은 **질문 깊이 2등급과 한 몸**이므로 따로 튜닝하면 안 된다 (GDD Tuning Knobs)
4. **`text.json`에 문안 36종이 필요하다** — 슬롯 6 × `(reach, limiter)` 6조합, 직업
   레지스터 변형 포함. 없으면 원시 값이 노출된다 (GDD AC-R10-03)

### 되돌리는 법

`slots` / `occupation` / `slotProgress` 필드를 지우면 이전 상태로 돌아간다 — 기존 필드를
**하나도 제거하지 않았으므로** 협상·파견·소문은 영향받지 않는다. 다만 **RNG 소비 순서가
원복되지 않으므로 시드는 여전히 갈린다.**

---

## Verification

이 ADR이 코드에 실제로 반영됐는지는 GDD의 수용 기준이 증명한다:

| 무엇 | AC |
| ---- | ---- |
| 슬롯 집합이 종류대로 열린다 | AC-R1-01 |
| `kind`가 항상 `vague` 이상, 열린 슬롯 0개가 없다 | AC-R2-01 |
| 클램프가 **상류**에서 일어난다 (파생값만 올리는 구현은 실패) | AC-F4-03 |
| `unknown`/`blocked`가 별개 판별자로 직렬화되고 `blocked`에만 사유가 붙는다 | AC-CORE-03 · AC-CORE-04 |
| RNG 소비가 **데이터 배열 순서에 의존하지 않는다** | AC-F4-02 |
| 판정이 순수 함수다 (`Rng` 미import) | AC-R9-01 |
| `Limiter`의 `'question'`이 `reach='none'`에서 나오지 않는다 | AC-F2-02 |

---

## 다음 ADR 후보

- **ADR-002 — 지속성 포맷.** `ReadonlyMap` 직렬화, 스키마 버전 필드, 세이브 스캐밍 억제.
  재현 키는 **매칭된 질문 id**로 이미 정해졌고, **로그 재생 방식은 기각**됐다
  (GDD 「결정론」 엣지 케이스). `game-concept.md`의 지속성 절도 이에 맞춰 정정됐다
- **ADR-003 — 부분 렌더링 경계.** 청취 화면의 `<input>`/후보 `<ul>`만 마운트 시 1회
  생성하는 규약(GDD U7)은 기존 6화면의 전체 재렌더 관용구를 **처음으로 깨는 것**이므로
  계층 경계 변경에 해당한다
