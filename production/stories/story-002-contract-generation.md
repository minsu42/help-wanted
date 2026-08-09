# Story 002: 의뢰인·의뢰 생성 (숨은 진실 포함)

> **Day**: 1 | **Status**: Superseded | **Layer**: Core | **Type**: Logic
> **Estimate**: 2h | **Last Updated**: 2026-08-08
> **Spec**: `design/quick-specs/guild-scale-and-difficulty-2026-08-08.md` §2,
> `design/quick-specs/rumor-network-2026-08-08.md` §1–2
> **ADR**: N/A — 3일 마감으로 ADR 파이프라인 생략

> **2026-08-09 전면 개정 영향** — 이 스토리는 3일 마감판의 as-built 기록이다.
> 본문은 당시 구현을 그대로 서술하며 수정하지 않는다.
>
> **폐기된 것**: `Contract`가 **무슨 일인가**를 담지 않는다는 전제 전체 — 종류·대상·
> 규모·장소 슬롯이 하나도 없고, 의뢰는 위험도·보상·정원·소요일수라는 숫자 묶음이다.
> 격차가 **은폐**(`concealment`) 한 축뿐이라는 전제도 폐기된다 — 의뢰인 본인도 모르는
> **무지**(vagueness) 축이 신설된다. `Client`가 `wealth`/`urgency`/`hasAlternative`
> 세 값으로만 규정되는 것도 폐기된다 — **직업**이 숨은 값의 분포와 인내심을 정한다.
> **대체·확장**: `production/roadmap.md` **P1**(의뢰 내용 데이터 모델, 무지 축,
> 의뢰인 직업 5종, `quest-templates.json`) 및 **P5**(성직·군인 추가).
> 새 요구사항은 그쪽이 소유한다.

## Context

**숨은 진실 시스템의 발원지다.** 공개 위험도와 실제 위험도의 격차가 여기서 만들어지고,
그 격차가 이 게임의 정보 경제 전체를 굴린다. 격차가 0이면 소문이 무의미해지고, 너무
크면 도박이 된다.

**제약**: `Math.random()` 금지, 숫자 하드코딩 금지.

## Acceptance Criteria

- [x] `Client`를 생성한다 — `wealth`/`urgency`는 0~1 정규화, `hasAlternative`는 boolean
- [x] `기대 위험도 = riskBase + riskPerReputation × 현재 명성`
- [x] `실제 위험도 = 기대 위험도 × (1 ± riskSpread)`
- [x] `은폐폭 = rng.range(concealmentMin, concealmentMax)` — **의뢰마다 다르다**
- [x] `공개 위험도 = 실제 위험도 × (1 − 은폐폭)`
- [x] `기본 보상 = 공개 위험도 × rewardPerRisk` — **실제가 아니라 공개 기준이다**
- [x] `maxPartySize = clamp(ceil(공개 위험도 / 60), 1, 3)`
- [x] `durationDays = clamp(round(공개 위험도 / 50), 1, 4)`
- [x] `temptationChance` 확률로 유혹 의뢰: 위험 ×1.6, 보상 ×2.0
- [x] `Client.knownBy`에 `knownByMin`~`knownByMax`명을 담되, `tenureYears^1.5`를 가중치로 뽑는다
- [x] 의뢰마다 사실 `factsPerContract`(2)개 — `realRisk`, `realWealth`
- [x] 사실 id는 `` `${contractId}:${kind}` `` 형식
- [x] 같은 시드 + 같은 명성이면 항상 같은 의뢰가 나온다

## Implementation Notes

- 파일: `src/domain/contract.ts`
- **기본 보상이 공개 위험도 기준인 것이 핵심이다.** 의뢰인은 자기가 주장하는 위험만큼만
  값을 부른다. 그래서 실제 위험을 알아내 고지하면 더 받아낼 수 있다 — 위험 고지 축의
  경제적 근거가 여기서 성립한다
- 은폐폭이 0에 가까운 **정직한 의뢰인**이 섞여야 한다. 그때는 실제 ≯ 공개이므로 위험
  고지 축이 열리지 않고, 소문은 "들은 그대로다"라는 다른 정보를 준다
- `knownBy` 가중 추출은 월드 풀 **전체**(길드원 + 외부인)에서 한다. 외부인이
  `knownBy`에 있는 것이 영입 정찰의 근거다

## Out of Scope

- 사실을 실제로 흘리는 판정 — Story 009
- 협상 — Story 003

## QA Test Cases

- **AC: 공개 < 실제**
  - Given: 은폐폭 > 0인 의뢰
  - Then: `공개 위험도 < 실제 위험도`
  - Edge: 은폐폭 == 0이면 공개 == 실제 (위험 고지 축이 안 열려야 함)
- **AC: 명성이 압력을 만든다**
  - Given: 명성 10 / 50 / 100
  - Then: 기대 위험도가 단조 증가 (약 48 / 102 / 170)
- **AC: knownBy 가중치**
  - Given: 근속 8년 1명과 근속 0년 20명
  - When: 1000회 생성
  - Then: 근속 8년이 뽑힌 비율이 균등분포보다 유의하게 높다
- **AC: 결정론**
  - Given: 같은 시드, 같은 명성
  - Then: 생성된 의뢰가 깊은 비교로 동일

## Test Evidence

`tests/unit/domain/contract.test.ts` — 테스트 30개, 전부 통과 (2026-08-08).
전체 스위트 64개 통과, `npx tsc --noEmit` 무경고.

**Status**: [x] 작성 완료 · 통과

## Implementation Deviations

스토리는 `src/domain/contract.ts` 하나만 지목했으나 5개 파일이 더 필요했다. 전부 AC를
만족시키기 위한 것이며 기능 추가가 아니다.

1. **`rng.range()` 추가** (`src/domain/rng.ts`). AC가 명시적으로
   `rng.range(concealmentMin, concealmentMax)`를 요구하는데 `Rng`에 그 메서드가 없었다
   (`next`/`int`/`chance`/`pick`뿐). 반열린 구간 `[min, max)`으로 구현했다 — 연속값이라
   경계 하나가 게임에 의미를 갖지 않고, 구간을 이어 붙일 때 겹치지 않는다. 테스트 4개 추가.

2. **`src/domain/person.ts` 신설.** 의뢰인도 이름과 성격 태그가 필요한데 그 로직이
   `roster.ts`의 비공개 함수로 갇혀 있었다. 복사하면 **이름 충돌 방지가 두 곳으로
   갈라져 "모험가끼리는 안 겹치는데 의뢰인과는 겹치는"** 상태가 된다. 공통 모듈로 뺐다.

3. **`createWorldRoster` 시그니처 변경** — `names: NamePool`과 선택적 `usedNames`를
   받는다. story-001의 tech debt 1번(정적 import)을 함께 해소했으며, 그 결과 이름 고갈
   throw 경로가 처음으로 테스트 가능해졌다. story-001 테스트 전부 여전히 통과.

4. **`balance.json`에 `client` 절 추가** — `alternativeChance`(0.4),
   `initialTrust`(0.3). AC가 `hasAlternative`를 boolean으로 요구하지만 그 확률에 대한
   노브가 어디에도 없었고, `Client`는 `Person`이라 `trust`가 필수다. 하드코딩 대신 노브로 냈다.
   `wealth`/`urgency`는 0~1 균등 추출이라 노브를 두지 않았다 — 분포를 바꾸는 것은
   밸런싱이 아니라 설계 변경이다.

5. **`types.ts`에 `Contract` / `Fact` / `FactKind` / `FACT_KINDS` 추가.**

### 설계 판단: 유혹 의뢰의 배수 적용 지점

AC는 "위험 ×1.6, 보상 ×2.0"이라고만 적혀 있어 적용 순서가 두 갈래로 읽힌다.
**기대 위험도에 1.6을 곱한 뒤, 거기서 파생된 보상에 다시 2.0을 곱하는** 쪽을 택했다.

결과적으로 유혹 의뢰는 **위험 1.6배, 총 보상 3.2배**이고 위험당 보상 단가가 정확히
2배가 된다. `temptationRewardMultiplier`를 "보상 **단가** 배수"로 읽는 해석이며,
스펙의 *"위험보다 보상이 더 커야 실제로 유혹이 된다"* 를 가장 강하게 만족시킨다.
파티 정원과 소요 일수도 함께 커지는데, 큰 일이 사람을 많이·오래 묶는 것이 맞다.

대안(총 보상을 2.0배로 묶는 해석)은 위험당 단가가 1.25배에 그쳐 "알고도 보냈다"를
만들 만큼 유혹적이지 않다고 판단했다. **economy-designer 검토 대상이다** —
Day 3 밸런스 패스에서 뒤집을 수 있으며, 뒤집으려면 `contract.ts`의 `baseReward`
계산 한 줄만 고치면 된다.

### 미결

`knownBy` 가중치가 `tenureYears^1.5`이므로 **근속 0년은 뽑히지 않는다.** 갓 들어온
사람이 상단주를 알 이유가 없으니 의도한 동작으로 두었고, 전원이 0년일 때만 균등
추출로 물러선다(죽은 월드 방지). 기본 명부에서 근속 0년은 약 2~3명이며 이들은
정보망에서 완전히 제외된다 — 의도인지 systems-designer 확인이 필요하다.

## Dependencies

- Depends on: Story 001 (`knownBy` 추출에 명부 필요)
- Unlocks: Story 003, 009
