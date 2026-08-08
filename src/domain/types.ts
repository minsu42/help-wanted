/**
 * 도메인 데이터 모델 — 모험가와 의뢰인이 공유하는 스키마.
 *
 * 이 파일은 **모양만** 정의한다. 숫자는 하나도 들어 있지 않으며, 전부 `balance.json`에
 * 있다. 마감 직전 밸런싱 시간에 코드를 열지 않기 위해서다.
 *
 * ## 두 개의 세계
 *
 * 이 게임의 핵심은 "당신이 알았던 것 vs 실제였던 것"의 대조다. 그래서 타입 수준에서
 * 둘을 나눈다:
 *
 * - {@link Person} 계열 — **진실**. 시뮬레이션이 아는 세계의 실제 상태
 * - {@link PlayerKnowledge} — **플레이어가 알아낸 것**. 소문으로 밝혀진 부분집합
 *
 * 이 분리가 없으면 "이 정보가 공개됐던가?" 플래그를 필드마다 흩뿌리게 되고, 결과 대조
 * 화면을 만들 때 그 흩어진 플래그를 전부 모아야 한다. 나눠 두면 두 객체를 나란히
 * 렌더링하는 것으로 끝난다.
 *
 * ## 불확실성의 축은 하나뿐이다
 *
 * **장부는 정직하고, 세상이 거짓말한다.** 모험가의 역량은 표시된 등급 그대로다.
 * 숨은 진실은 오직 의뢰 쪽(실제 위험도, 실제 지불 여력)에만 있다.
 *
 * 사람 쪽에도 숨은 진실을 두면 결과 화면이 "둘 다 몰랐네"가 되어 플레이어가 자기
 * 판단의 인과를 추적할 수 없다. 그러면 창발이 무작위로 느껴지고, 그것이 이 게임의
 * 1순위 설계 리스크다.
 */

/**
 * 성격 태그. 인물마다 정확히 2개를 가진다.
 *
 * 두 곳에서 소비된다 — 소문 네트워크(무엇을 어떻게 흘릴지)와 서술 텍스트 조립
 * (어떤 감정·행동 어휘를 쓸지).
 */
export type Trait =
  | 'talkative' // 수다스럽다 — 묻지 않아도 말한다
  | 'cautious' // 신중하다 — 확신이 없으면 입을 다문다
  | 'greedy' // 탐욕스럽다 — 정보에도 대가를 원한다
  | 'loyal' // 의리 있다 — 길드를 먼저 생각한다
  | 'bitter' // 냉소적이다 — 나쁜 쪽으로 비틀어 전한다
  | 'boastful'; // 허풍스럽다 — 부풀린다

/**
 * {@link Trait}의 런타임 전체 목록. 생성기가 여기서 뽑는다.
 *
 * 유니온 타입은 컴파일 타임에만 존재하므로 뽑기용 배열이 따로 필요하다. 태그를
 * 추가하면 위 유니온과 이 배열을 **둘 다** 고쳐야 한다.
 */
export const TRAITS: readonly Trait[] = [
  'talkative',
  'cautious',
  'greedy',
  'loyal',
  'bitter',
  'boastful',
];

/**
 * 인물이 원하는 것. 하나만 가진다.
 *
 * 장식이 아니라 실제로 행동을 바꾼다 — 파견 배정을 거부하거나, 조건을 요구하거나,
 * 자원한다. 구체적인 임계값은 `balance.json`에 있다.
 */
export type Goal =
  | 'money' // 보상 배분을 더 요구한다
  | 'glory' // 위험한 의뢰에 자원한다
  | 'survival' // 고위험 배정을 거부하거나 위험 수당을 요구한다
  | 'revenge'; // 특정 의뢰 종류에 우선 자원한다

/** {@link Goal}의 런타임 전체 목록. {@link TRAITS}와 같은 이유로 존재한다. */
export const GOALS: readonly Goal[] = ['money', 'glory', 'survival', 'revenge'];

/**
 * 장부에 적히는 역량 등급. **플레이어가 보는 유일한 역량 표현이다.**
 *
 * 원본 숫자({@link Adventurer.capability})는 절대 화면에 내보내지 않는다. 숫자가
 * 보이면 배정이 뺄셈이 되고, 뺄셈은 판단이 아니다. 등급이 뭉툭해서 동점이 자주 나는
 * 것이 의도다 — 그때 판단을 가르는 것은 성격·목표·인맥이지 숫자가 아니다.
 */
export type Grade = 'green' | 'steady' | 'skilled' | 'veteran';

/** 인물이 플레이어의 과거 결정에 대해 품는 기억의 종류. */
export type MemoryKind =
  | 'sentToDanger' // 위험한 곳으로 보내졌다
  | 'sentSafe' // 안전한 의뢰를 받았다
  | 'survived' // 살아 돌아왔다
  | 'wounded' // 다쳐서 돌아왔다
  | 'lostComrade' // 동료가 돌아오지 못했다
  | 'wasWarned' // 위험을 미리 들었다
  | 'wasDeceived'; // 위험을 듣지 못한 채 갔다

/**
 * 플레이어의 결정에 대한 인물의 기억 한 조각. 덧붙이기만 하고 지우지 않는다.
 *
 * 결과 대조 화면과 서술 텍스트가 이것을 읽는다 — "당신은 사흘 전에도 그를 보냈다".
 */
export interface Memory {
  readonly day: number;
  readonly kind: MemoryKind;
  /** 관련 인물이 있는 기억이면 그 인물의 id (예: 잃은 동료) */
  readonly subjectId?: string;
}

/**
 * 모험가와 의뢰인이 공유하는 기반. 이것이 시뮬레이션이 아는 **진실**이다.
 */
export interface Person {
  readonly id: string;
  readonly name: string;
  /** 정확히 2개. 튜플로 개수를 타입이 강제한다 */
  readonly traits: readonly [Trait, Trait];
  readonly goal: Goal;
  /** 플레이어에 대한 신뢰. 소문을 말해줄지, 배정을 받아들일지를 좌우한다 */
  trust: number;
  memories: Memory[];
}

/** 파견 가능 여부를 나타내는 모험가의 현재 상태. */
export type AdventurerStatus = 'available' | 'onMission' | 'injured' | 'dead';

export interface Adventurer extends Person {
  /**
   * 파견 판정에만 쓰이는 내부 값. **렌더링 금지.**
   *
   * 화면에는 {@link gradeOf}를 통과한 {@link Grade}만 나간다.
   */
  readonly capability: number;
  status: AdventurerStatus;
  /**
   * 길드에 소속되어 있는가. `false`면 외부 모험가다.
   *
   * 외부 모험가도 길드 홀을 방문하고 대화할 수 있지만 {@link Person.trust}가 낮아
   * 사실을 말해주지 않는다. 다만 **누구를 아는지는 알려주므로** 영입 전에 정보망
   * 가치를 정찰할 수 있다.
   */
  inGuild: boolean;
  /**
   * 근속 연수. 의뢰 생성 시 {@link Client.knownBy}에 뽑힐 가중치가 된다.
   *
   * 베테랑이 죽으면 사람만 잃는 것이 아니라 정보망이 무너진다 — 그 긴장의 기계적
   * 근거가 이 필드다.
   */
  readonly tenureYears: number;
}

/**
 * 의뢰인. `wealth` / `urgency` / `hasAlternative` 세 개가 계약 협상 4개 축의 수용
 * 범위를 결정하는 숨은 상태다.
 */
export interface Client extends Person {
  /** 자금력 — 보상과 선불의 상한을 정한다 */
  readonly wealth: number;
  /** 급박함 — 양보 폭을 정한다 */
  readonly urgency: number;
  /** 대안 유무 — 다른 길드에 갈 수 있으면 협상력이 올라간다 */
  readonly hasAlternative: boolean;
  /**
   * 이 의뢰인을 아는 모험가들의 id. 소문 1홉 판정의 전부다 — 여기 있는 사람만이
   * 이 의뢰의 숨은 사실을 말해줄 수 있다.
   *
   * 의뢰 생성 시 {@link Adventurer.tenureYears}를 가중치로 뽑아 정하고, 이후
   * 바뀌지 않는다. 간선을 모험가가 아니라 의뢰인 쪽에 두는 이유: 실제 질의가 언제나
   * "이 의뢰인을 아는 사람이 누구인가" 한 방향이고, 간선이 생기는 시점도 의뢰
   * 생성 때이기 때문이다.
   *
   * **플레이어에게 처음부터 보이지 않는다.** 대화로 밝혀낸 것만
   * {@link PlayerKnowledge.discoveredContacts}에 쌓인다.
   */
  readonly knownBy: readonly string[];
}

/**
 * 소문으로 얻을 수 있는 사실의 종류.
 *
 * `urgency`와 `hasAlternative`는 **여기 없다.** 그 둘은 흥정 중 의뢰인의 반박이
 * 알려준다 ("선불은 도저히 안 되겠소"). 정보원이 둘로 나뉘어 있어야 홀에서의 대화만으로
 * 모든 것이 풀리지 않는다.
 */
export type FactKind =
  | 'realRisk' // 실제 위험도 — 흥정의 위험 고지 축을 연다
  | 'realWealth'; // 실제 지불 여력 — 선불이냐 보상이냐를 가른다

/** {@link FactKind}의 런타임 전체 목록. {@link TRAITS}와 같은 이유로 존재한다. */
export const FACT_KINDS: readonly FactKind[] = ['realRisk', 'realWealth'];

/**
 * 정보의 단위. 의뢰 하나에 몇 개씩 붙는다.
 *
 * **별도의 만료 로직이 없다.** 사실은 의뢰에 매달려 있으므로 의뢰가 타결되거나
 * 결렬되면 함께 사라진다 — "정보에는 유통기한이 있다"가 공짜로 성립한다.
 */
export interface Fact {
  /** `` `${contractId}:${kind}` `` 형식. 협상 쪽과 합의된 규약이다 */
  readonly id: string;
  readonly contractId: string;
  readonly kind: FactKind;
}

/**
 * 하나의 의뢰. **숨은 진실 시스템의 실체가 이 타입이다.**
 *
 * {@link statedRisk}와 {@link realRisk}가 갈라져 있는 것이 이 게임 전체의 정보 경제를
 * 굴린다. 격차가 0이면 소문이 무의미해지고, 너무 크면 도박이 된다.
 */
export interface Contract {
  readonly id: string;
  readonly client: Client;
  /**
   * 의뢰인이 **주장하는** 위험도. 플레이어가 처음부터 보는 유일한 위험 표현이다.
   *
   * 보상·파티 정원·소요 일수가 전부 이 값에서 나온다. 의뢰인은 자기가 인정한 위험만큼만
   * 값을 부르기 때문이다 — 실제 위험을 알아내 고지하면 더 받아낼 수 있는 경제적 근거가
   * 정확히 여기서 성립한다.
   */
  readonly statedRisk: number;
  /**
   * 실제 위험도. 파견 판정이 쓰는 진실. **렌더링 금지.**
   *
   * 소문으로 `realRisk` 사실을 얻으면 성격 필터를 거친 값이 보이고, 진짜 값은 결과
   * 대조 화면에서만 드러난다.
   */
  readonly realRisk: number;
  /**
   * 의뢰인이 숨긴 비율. `statedRisk = realRisk × (1 − concealment)`.
   *
   * 0에 가까우면 **정직한 의뢰인**이다. 그때는 위험 고지 축이 열리지 않고, 소문은
   * "들은 그대로다"라는 다른 종류의 정보를 준다.
   */
  readonly concealment: number;
  /** 흥정 전 기본 보상. {@link statedRisk} 기준이다 */
  readonly baseReward: number;
  readonly maxPartySize: number;
  readonly durationDays: number;
  /**
   * 명성 범위를 넘는 고보상·고위험 의뢰인가.
   *
   * *"이 숲이 위험하다는 걸 알고도 보상이 좋아서 신입을 보냈다"* 를 만드는 장치다.
   * 감당 가능한 것만 오면 그 문장은 나오지 않는다.
   */
  readonly isTemptation: boolean;
  /** 이 의뢰에 심긴 사실들. 소문으로 얻어야 열린다 */
  readonly facts: readonly Fact[];
}

/**
 * 플레이어가 실제로 알아낸 것. 결과 대조 화면의 **좌변**이다.
 *
 * 진실({@link Person} 계열, 의뢰의 실제 정보)의 부분집합만 담는다. 여기 없는 것은
 * 플레이어가 모르는 것이고, 화면에 나가서도 안 된다.
 */
export interface PlayerKnowledge {
  /** 밝혀낸 "누가 누구를 아는가" 관계. `"{personId}->{contactId}"` 형식의 키 */
  readonly discoveredContacts: ReadonlySet<string>;
  /** 소문으로 얻은 숨은 정보의 id 집합 */
  readonly revealedFacts: ReadonlySet<string>;
}

/**
 * `balance.json`에서 등급 판정에 쓰는 부분.
 *
 * 각 값은 그 등급이 되기 위한 {@link Adventurer.capability} 최소치다.
 */
export interface GradeThresholds {
  readonly steady: number;
  readonly skilled: number;
  readonly veteran: number;
}

/**
 * 내부 역량 숫자를 플레이어가 보는 등급으로 바꾼다.
 *
 * 임계값을 인자로 받는 이유: 싱글턴을 참조하면 테스트에서 값을 갈아 끼울 수 없고,
 * 밸런싱 중 임계값을 바꿔가며 확인하는 것이 정확히 하고 싶은 일이기 때문이다.
 */
export function gradeOf(capability: number, thresholds: GradeThresholds): Grade {
  if (capability >= thresholds.veteran) return 'veteran';
  if (capability >= thresholds.skilled) return 'skilled';
  if (capability >= thresholds.steady) return 'steady';
  return 'green';
}
