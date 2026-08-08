/**
 * 소문 판정 — 대화 한 번의 결과를 두 단계로 가른다.
 *
 * **필수 테스트 3번**(`technical-preferences.md`)이자 이 게임의 차별점이다. 핵심
 * 장치는 인맥 공개(①)와 사실 공개(②)의 분리다: ①은 신뢰·성격과 무관하게 항상
 * 일어나고, ②만 성격 필터와 신뢰 임계값을 거친다. 이 분리 덕분에 "무엇을 아는지는
 * 못 들어도 누구를 아는지는 안다"가 성립하고, 외부 모험가 정찰(Story 015)이 여기서
 * 갈라져 나온다.
 *
 * ## 왜곡과 게이트는 서로 다른 축이다
 *
 * `bitter`/`boastful`은 사실을 **얻었는지**에는 관여하지 않는다. 오직 **표시값**만
 * 비튼다. `revealedFacts`에 들어가는 사실 id는 항상 진짜이므로, 위험 고지 축
 * (Story 011)이 열리는 조건은 "실제 위험도에 대한 사실을 얻었는가"이지 "그 값이
 * 정확한가"가 아니다. `boastful`을 믿고 위험을 과소평가하는 것 자체가 플레이어의
 * 실수가 되어야 한다 — 그래서 게이트(신뢰·`knownBy`)와 왜곡(성격)을 함수 내부에서도
 * 완전히 분리된 두 단계로 짠다.
 *
 * ## 상태 전이는 여기서 하지 않는다
 *
 * `dispatch.ts`·`negotiation.ts`와 같은 원칙이다. `PlayerKnowledge`에 반영하는 것도,
 * `greedyPrice`를 자금에서 실제로 빼는 것도 호출자의 몫이다. 이 함수는 "이번 대화에서
 * 무엇이 드러났는가"만 판정한다.
 *
 * 출처: `design/quick-specs/rumor-network-2026-08-08.md` §4–6
 */
import type { Rng } from './rng';
import type { Client, Contract, FactKind, Person, Trait } from './types';

/**
 * 대화 판정이 실제로 보는 말하는 사람의 부분.
 *
 * `Person` 전체를 받지 않는다. 판정은 `traits`(성격 필터)와 `trust`(임계값 비교)만
 * 읽으므로, 좁은 타입이 "이름이나 기억은 대화 결과에 영향을 주지 않는다"는 사실을
 * 타입으로 못박는다. `id`는 `knownBy` 조회와 "누가 말했는지" 기록에 쓴다.
 */
export type RumorTalker = Pick<Person, 'id' | 'traits' | 'trust'>;

/** 대화 판정이 실제로 보는 의뢰인의 부분. `knownBy`가 ①의 전부, `wealth`가 사실 값의 원천이다. */
export type RumorClient = Pick<Client, 'id' | 'knownBy' | 'wealth'>;

/**
 * 대화 판정이 실제로 보는 의뢰의 부분.
 *
 * `id`를 넣지 않았다 — 사실 쪽 id는 각 `Fact.contractId`가 이미 들고 있으므로 여기서
 * 또 필요하지 않다. **호출자가 이미 열려 있는 의뢰만 넘긴다고 가정한다** — 의뢰가
 * 결렬·타결되면 그 사실이 더 이상 조회되지 않아야 한다는 규칙은, "닫힌 의뢰는 애초에
 * 이 배열에 넣지 않는다"로 호출부에서 지킨다 (다른 도메인 함수들처럼 이 모듈은 상태를
 * 모르는 순수 함수다).
 */
export type RumorContract = Pick<Contract, 'realRisk' | 'facts'> & {
  readonly client: RumorClient;
};

/** 대화 판정에 필요한 수치. 전부 `balance.json`의 `rumor` 절에서 온다. */
export interface RumorConfig {
  readonly trustThresholdDefault: number;
  readonly trustThresholdCautious: number;
  readonly trustThresholdLoyal: number;
  /** 위험도 표시값이 실제에서 벌어지는 비율. `bitter`는 +, `boastful`은 −로 쓴다 */
  readonly traitDistortion: number;
  /** `greedy`가 사실을 말하는 대가로 요구하는 금액 */
  readonly greedyPrice: number;
}

/** 대화 시작 전에 호출자가 이미 정한 것. 화면(UI)이 플레이어의 선택을 여기로 넘긴다. */
export interface TalkOptions {
  /**
   * `greedy`가 요구하는 값을 치를지.
   *
   * `greedy`가 아닌 사람에게는 아무 효과가 없다. **신뢰 임계값과는 독립된 별도
   * 게이트다** — 값을 치렀어도 신뢰가 모자라면 여전히 침묵한다. 성격 태그는 항상
   * 보이므로 플레이어는 신뢰를 몰라도 "값을 낼지"는 미리 결정할 수 있다.
   */
  readonly payGreedyPrice?: boolean;
}

/**
 * 이번 대화에서 공개된 사실 하나.
 *
 * `actualValue`(진짜)와 `statedValue`(성격 필터를 거친 표시값)를 둘 다 담는다 —
 * 결과 대조 화면이 "당신은 카린의 말을 믿었다"를 쓰려면 대조할 두 값이 모두 필요하다.
 */
export interface RevealedFact {
  /** `${contractId}:${kind}` 형식. `negotiation.ts`·`types.ts`와 합의된 규약이다 */
  readonly factId: string;
  readonly contractId: string;
  readonly kind: FactKind;
  /** 성격 필터를 거친 값. 왜곡되어 있을 수 있다 */
  readonly statedValue: number;
  /** 진짜 값. 왜곡과 무관하게 항상 정확하다 */
  readonly actualValue: number;
  /** 이 사실을 말한 사람의 id — 결과 대조와 "저 사람 말은 깎아 듣자" 학습의 근거 */
  readonly tellerId: string;
}

/** 대화 한 번의 결과. */
export interface TalkResult {
  /**
   * 이번에 새로 밝혀진 인맥 관계. `PlayerKnowledge.discoveredContacts`에 그대로
   * 합칠 수 있는 키 형식({@link discoveredContactKey})으로 나간다.
   *
   * 신뢰·성격·`greedy` 지불 여부와 **완전히 무관하다.** 대화만 하면 채워진다.
   */
  readonly discoveredContactKeys: readonly string[];
  /** 이번에 공개된 사실들. 게이트를 통과하지 못했으면 빈 배열이다 */
  readonly revealedFacts: readonly RevealedFact[];
  /**
   * `greedy`에게 실제로 지불하기로 한 금액. 자금 차감은 호출자의 몫이며, 여기서는
   * "얼마를 냈어야 하는가"만 알려준다. `greedy`가 아니거나 지불하지 않았으면
   * `undefined`다.
   */
  readonly greedyPriceCharged?: number;
}

/** `PlayerKnowledge.discoveredContacts`가 쓰는 키 형식. `types.ts`의 문서와 합의된 규약이다. */
export function discoveredContactKey(talkerId: string, clientId: string): string {
  return `${talkerId}->${clientId}`;
}

/**
 * 대화 한 번을 판정한다.
 *
 * 같은 `rng` 시드 + 같은 인자면 언제나 같은 결과다. `openContracts`는 **호출자가
 * 이미 열려 있는 의뢰만 걸러 넘긴다고 가정한다** — 하루 1회 대화 제한, 홀 출석 여부,
 * `greedy` 지불 확정 같은 그 앞 단계의 결정도 전부 호출자의 몫이다.
 *
 * ## 판정 순서
 *
 * 1. **①인맥 공개** — `openContracts` 중 `client.knownBy`에 이 사람이 있는 것을
 *    전부 기록한다. 이 시점에서는 어떤 게이트도 걸지 않는다.
 * 2. **`greedy` 게이트** — `greedy`인데 값을 안 냈으면 ②는 통째로 막힌다.
 * 3. **신뢰 게이트** — 성격별 임계값(`cautious`/`loyal`/기본)에 못 미치면 막힌다.
 * 4. **사실 선택** — 위 두 게이트를 통과하면, 이 사람이 아는 사실 후보 중
 *    `talkative`는 최대 2개, 그 외는 최대 1개를 `rng`로 고른다.
 * 5. **왜곡** — 고른 사실이 `realRisk`면 `bitter`/`boastful`이 표시값을 비튼다.
 *    사실 id·실제값은 절대 비틀리지 않는다.
 */
export function resolveTalk(
  talker: RumorTalker,
  openContracts: readonly RumorContract[],
  rng: Rng,
  config: RumorConfig,
  options: TalkOptions = {},
): TalkResult {
  const knownContracts = openContracts.filter((contract) =>
    contract.client.knownBy.includes(talker.id),
  );
  const discoveredContactKeys = knownContracts.map((contract) =>
    discoveredContactKey(talker.id, contract.client.id),
  );

  // 신뢰를 **먼저** 본다. 순서가 뒤집히면 값을 치르고도 침묵을 사는 일이 생기고,
  // 플레이어는 신뢰 수치를 볼 수 없으므로 그것이 이유 없는 손실로 보인다 — 컨셉의
  // 1순위 리스크("창발이 무작위로 느껴짐")를 정면으로 건드린다.
  //
  // 이 순서의 부수 효과가 오히려 좋다: **greedy가 값을 요구한다는 것 자체가
  // "신뢰는 충분하다"는 신호**가 된다. 성격 태그는 항상 보이므로 플레이어는
  // "이 사람은 돈만 내면 말한다"를 읽어낼 수 있다.
  if (talker.trust < trustThresholdFor(talker.traits, config)) {
    return { discoveredContactKeys, revealedFacts: [] };
  }

  const greedyPriceCharged = greedyChargeFor(talker.traits, options, config);

  // 말할 의사는 있으나 값을 안 냈다. 돈은 오가지 않는다.
  if (talker.traits.includes('greedy') && greedyPriceCharged === undefined) {
    return { discoveredContactKeys, revealedFacts: [] };
  }

  const candidates = knownContracts.flatMap((contract) =>
    contract.facts.map((fact) => ({ fact, contract })),
  );
  const revealCount = Math.min(revealCountFor(talker.traits), candidates.length);
  const chosen = pickDistinct(rng, candidates, revealCount);

  const revealedFacts = chosen.map(({ fact, contract }): RevealedFact => {
    const actualValue = actualValueOf(contract, fact.kind);
    return {
      factId: fact.id,
      contractId: fact.contractId,
      kind: fact.kind,
      actualValue,
      statedValue: distortedValueOf(fact.kind, actualValue, talker.traits, config),
      tellerId: talker.id,
    };
  });

  return { discoveredContactKeys, revealedFacts, greedyPriceCharged };
}

/**
 * `greedy`가 요구하는 값을 실제로 냈다면 그 금액을, 아니면 `undefined`를 돌려준다.
 *
 * `greedy`가 아닌 사람에게 `payGreedyPrice: true`를 넘겨도 아무 효과가 없다 —
 * 요구하지도 않은 값을 냈다는 결과가 나오면 안 되기 때문이다.
 */
function greedyChargeFor(
  traits: readonly Trait[],
  options: TalkOptions,
  config: RumorConfig,
): number | undefined {
  if (!traits.includes('greedy')) return undefined;
  return options.payGreedyPrice === true ? config.greedyPrice : undefined;
}

/**
 * 성격에 맞는 신뢰 임계값을 고른다.
 *
 * 한 사람이 `cautious`와 `loyal`을 동시에 가질 수 있다 (서로 다른 태그이므로
 * 타입상 막을 이유가 없다). 그때 어느 쪽을 쓸지는 스펙에 없으므로, `text.ts`의
 * `variantFor`와 같은 규칙을 따른다 — **`traits` 배열의 순서대로 먼저 걸리는 것을
 * 쓴다.** 규칙이 없으면 결정론이 깨지므로 임의로라도 고정해야 한다.
 */
function trustThresholdFor(traits: readonly Trait[], config: RumorConfig): number {
  for (const trait of traits) {
    if (trait === 'cautious') return config.trustThresholdCautious;
    if (trait === 'loyal') return config.trustThresholdLoyal;
  }
  return config.trustThresholdDefault;
}

/**
 * 이번 대화에서 말할 수 있는 사실의 최대 개수.
 *
 * `1`과 `2`는 `balance.json`의 노브가 아니라 스펙이 못박은 규칙이다 (Tuning Knobs
 * 표에 없다) — `dispatch.ts`가 사상자 1명을 하드코딩한 것과 같은 근거다.
 */
function revealCountFor(traits: readonly Trait[]): number {
  return traits.includes('talkative') ? 2 : 1;
}

/** 사실 종류에 대응하는 진짜 값. `realWealth`는 의뢰인의 `wealth`를 그대로 쓴다. */
function actualValueOf(contract: RumorContract, kind: FactKind): number {
  return kind === 'realRisk' ? contract.realRisk : contract.client.wealth;
}

/**
 * 표시값에 성격 왜곡을 건다.
 *
 * **`realRisk`에만 적용한다.** 스펙(§5)의 왜곡 규칙이 명시적으로 "위험도"만
 * 가리키고 `realWealth`(지불 여력)의 왜곡은 정의되어 있지 않다 — 그래서 지불 여력은
 * 항상 진짜 값 그대로 전해진다고 해석했다. 위험도만 왜곡되는 이유가 다르다면
 * (예: 모든 수치 정보에 왜곡을 걸어야 한다면) 이 부분을 게임 디자이너와 다시
 * 확인해야 한다.
 *
 * `bitter`와 `boastful`을 동시에 가진 사람은 {@link trustThresholdFor}와 같은 이유로
 * `traits` 순서상 먼저 걸리는 쪽을 따른다.
 */
function distortedValueOf(
  kind: FactKind,
  actualValue: number,
  traits: readonly Trait[],
  config: RumorConfig,
): number {
  if (kind !== 'realRisk') return actualValue;

  for (const trait of traits) {
    if (trait === 'bitter') return actualValue * (1 + config.traitDistortion);
    if (trait === 'boastful') return actualValue * (1 - config.traitDistortion);
  }
  return actualValue;
}

/**
 * 후보 중 서로 다른 `count`개를 고른다. `roster.ts`의 `pickDistinctIndices`와 같은
 * 부분 셔플이지만, 여기서는 인덱스가 아니라 항목 자체가 필요해 별도로 둔다 — 후보
 * 배열이 매 대화마다 새로 만들어지는 임시 배열이라 공유해도 얻는 것이 없다
 * (`weighted.ts`를 공유 대상으로 삼은 이유였던 "확률 코드의 미묘한 차이"가 여기서는
 * 해당하지 않는다. 가중치 없는 균등 추출이라 갈릴 여지 자체가 없다).
 */
function pickDistinct<T>(rng: Rng, items: readonly T[], count: number): T[] {
  const pool = [...items];
  const chosen: T[] = [];
  for (let picked = 0; picked < count; picked += 1) {
    const index = rng.int(0, pool.length - 1);
    chosen.push(pool[index]);
    pool.splice(index, 1);
  }
  return chosen;
}
