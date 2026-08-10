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
  | 'wasDeceived' // 위험을 듣지 못한 채 갔다
  | 'forcedAssignment'; // 내키지 않는다고 했는데도 보내졌다

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
   * 부상에서 회복해 `available`로 돌아오는 날. `injured`일 때만 값이 있다.
   *
   * 부상의 실질 비용은 아픈 것이 아니라 **그동안 길드 홀에 나오지 않는 것**이다 —
   * 정보원이 며칠 비는 것이 진짜 대가다.
   */
  recoversOnDay?: number;
  /**
   * 근속 연수. 의뢰 생성 시 {@link Client.knownBy}에 뽑힐 가중치가 된다.
   *
   * 베테랑이 죽으면 사람만 잃는 것이 아니라 정보망이 무너진다 — 그 긴장의 기계적
   * 근거가 이 필드다.
   */
  readonly tenureYears: number;
}

/**
 * 의뢰인. `wealth` / `urgency` / `hasAlternative` 세 개가 계약 협상 두 축(보상,
 * 위험 고지)의 수용 범위를 결정하는 숨은 상태다.
 */
/** 의뢰인의 생업. 무지·은폐 분포와 압박에 통하는 범주를 정한다. */
export type Occupation = 'resident' | 'merchant' | 'official' | 'noble' | 'gang';

export const OCCUPATIONS: readonly Occupation[] = [
  'resident',
  'merchant',
  'official',
  'noble',
  'gang',
];

/** 들이대기 재료와 의뢰인의 약점이 공유하는 닫힌 어휘. */
export type LeverageTag = 'procedure' | 'profit' | 'face';

export interface Client extends Person {
  readonly occupation: Occupation;
  /** `null`이면 어떤 들이대기 재료도 통하지 않는다. */
  readonly keyLeverage: LeverageTag | null;
  /** 자금력 — 보상 축의 수용 범위를 정한다 */
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
 * `urgency`와 `hasAlternative`는 **여기 없다.** 그 둘은 흥정에서 어디까지 밀리는지가
 * 알려준다 — 같은 배율을 불렀는데 누구는 받고 누구는 반박한다. 정보원이 둘로 나뉘어
 * 있어야 홀에서의 대화만으로 모든 것이 풀리지 않는다.
 *
 * > 2026-08-09 개정 — 원래 예시는 *"선불은 도저히 안 되겠소"* 였다. 선불 축이
 * > 폐기되면서(`roadmap.md` P0 항목 1) **반박이 축을 지목해 주던 채널이 사라졌다.**
 * > 남은 축이 보상 하나뿐이라 반박은 언제나 보상을 가리키고, 정보는 "지목된 축"이
 * > 아니라 "어느 배율에서 꺾이는가"로만 새어 나온다. 이 채널을 복구하는 것이
 * > 로드맵 P3의 「근거 기반 협상」이다.
 */
export type FactKind =
  | 'realRisk' // 실제 위험도 — 흥정의 위험 고지 축을 연다
  | 'realWealth'; // 실제 지불 여력 — 보상 축의 수용 범위를 알려준다

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

/** 의뢰가 가질 수 있는 빈칸의 전체 목록. 배열 순서는 RNG 스키마가 소유한다. */
export type SlotName =
  | 'kind'
  | 'target'
  | 'scale'
  | 'place'
  | 'deadline'
  | 'route'
  | 'weakness';

/** 의뢰인이 한 칸을 얼마나 깊이 알고 있거나 말해 줄 수 있는가. */
export type Reach = 'none' | 'vague' | 'certain';

/** 플레이어 쪽에 저장되는 칸 상태. `unknown`과 `blocked`는 책임 귀속이 다르다. */
export type SlotState = 'unknown' | 'blocked' | 'vague' | 'certain';

/** 물었지만 칸이 열리지 않은 이유. */
export type Limiter = 'knowledge' | 'disclosure';

/** 슬롯 하나의 숨은 진실. 의뢰 생성 뒤에는 바뀌지 않는다. */
export interface SlotTruth {
  readonly knows: Reach;
  readonly tells: Reach;
  readonly valueKey: string;
  readonly weight: number;
}

/**
 * 슬롯 하나에 대해 플레이어가 알아낸 것.
 *
 * 판별 유니온으로 `limiter`가 `blocked`에만, 그리고 반드시 존재하도록 강제한다.
 */
export type SlotProgress =
  | { readonly state: 'unknown'; readonly limiter?: never }
  | { readonly state: 'blocked'; readonly limiter: Limiter }
  | { readonly state: 'vague'; readonly limiter?: never }
  | { readonly state: 'certain'; readonly limiter?: never };

/**
 * 하나의 의뢰. **숨은 진실 시스템의 실체가 이 타입이다.**
 *
 * {@link statedRisk}와 {@link realRisk}가 갈라져 있는 것이 이 게임 전체의 정보 경제를
 * 굴린다. 격차가 0이면 소문이 무의미해지고, 너무 크면 도박이 된다.
 */
export interface Contract {
  readonly id: string;
  readonly client: Client;
  /** 이 의뢰의 종류. 후속 템플릿 스키마의 키다. */
  readonly questKind: string;
  /** 같은 종류 안에서 실제 문안 사슬을 고르는 안정 식별자. */
  readonly scenarioId: string;
  /** 열린 슬롯의 숨은 진실. 진행 상태는 {@link PlayerKnowledge}에만 둔다. */
  readonly slots: ReadonlyMap<SlotName, SlotTruth>;
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
 * 소문으로 들은 사실 하나의 **상세**. 결과 대조 화면이 좌변을 그리는 데 쓴다.
 *
 * {@link PlayerKnowledge.revealedFacts}가 "얻었는가"만 답하는 반면 이것은 "무엇을
 * 얼마로 들었고 누가 말했는가"를 답한다. 둘을 나눠 두는 이유는 소비처가 다르기 때문이다 —
 * 위험 고지 축의 개폐(`canDisclose`)는 획득 여부만 보면 되고 왜곡값을 알 필요가 없다.
 *
 * **`tellerId`가 이 타입의 존재 이유다.** 성격 필터를 학습 가능하게 만드는 유일한
 * 연결이며, `boastful`에게 속았다는 것을 결과 화면에서 알아야 다음에 깎아 듣는다.
 * 화자를 기록하지 않으면 왜곡은 그냥 무작위로 느껴지고, 그것이 이 게임의 1순위
 * 설계 리스크다.
 */
export interface HeardRumor {
  /** 성격 필터를 거친, 플레이어가 실제로 들은 값 */
  readonly statedValue: number;
  readonly tellerId: string;
  /** 들은 날. 나중에 "사흘 전에 들었다" 같은 서술에 쓸 수 있다 */
  readonly day: number;
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
  /**
   * 들은 사실의 상세. 키는 {@link revealedFacts}와 같은 사실 id다.
   *
   * **두 필드는 항상 같이 쓴다** — 소문을 얻는 곳(길드 홀 대화)에서 한 번에 둘 다
   * 기록한다. 하나만 채우면 축은 열리는데 결과 화면에 화자가 안 나오거나(또는 그 반대)
   * 조용히 어긋난다.
   */
  readonly heardFacts: ReadonlyMap<string, HeardRumor>;
  /** 청취로 좁힌 슬롯 상태. 키는 `` `${contractId}:${slotName}` `` 형식이다. */
  readonly slotProgress: ReadonlyMap<string, SlotProgress>;
}

/**
 * 창구에서 타결된 조건. **의뢰가 아직 배정되지 않았을 때만 존재한다.**
 *
 * 이 타입이 프레젠테이션이 아니라 도메인에 있는 이유: 배정 화면을 나갔다가 창구로
 * 돌아와도 조건이 유지되어야 하는데, 그러려면 {@link GameState}가 들고 있어야 하고
 * 도메인은 프레젠테이션 타입(`CounterScreen`의 `Settlement`)을 참조할 수 없다.
 * `Settlement`가 들고 있는 `Contract` 참조는 여기 없다 — 키가 의뢰 id이므로 중복이다.
 *
 * **왜 조건을 보존해야 하는가**: `evaluateOffer`는 `offerNumber >= maxOffers`면 무조건
 * 결렬이다. 타결은 1~2회차에서만 일어나므로, 조건을 버리고 창구로 돌려보내면 플레이어가
 * 무슨 선택지를 누르든 그것이 3회차라서 즉시 결렬된다 — "열린 채로 유지"가 실질적으로
 * 파기가 된다. 기록: `design/quick-specs/assignment-reluctance-2026-08-09.md` §5.
 */
export interface SettledTerms {
  /** 흥정이 끝난 최종 보상. 완수하면 전액 들어온다 */
  readonly agreedReward: number;
  /** 위험을 고지했는가. 숨겼으면 사망 시 신뢰 하락폭이 커진다 */
  readonly discloseRisk: boolean;
}

/**
 * 길드 등급 하나. `balance.json`의 `guildTiers` 룩업 테이블 한 행이다.
 *
 * **한 번의 구매가 세 가지를 준다.** 그중 `hallAttendanceMax`가 핵심이다 — 돈으로
 * 힘이 아니라 **앎을 산다.** 사람이 더 드나들면 정보가 더 들어온다.
 */
export interface GuildTier {
  readonly tier: number;
  readonly rosterCap: number;
  readonly hallAttendanceMax: number;
  readonly concurrentContracts: number;
  readonly cost: number;
}

/**
 * {@link PlayerKnowledge}의 쓰기 가능한 형태. {@link GameState}만 이것을 들고 있다.
 *
 * 화면에는 {@link PlayerKnowledge}로 넘겨서 읽기 전용으로 보이게 한다 — UI가 실수로
 * "알아낸 것"을 늘리지 못하게 하는 것이 이 두 타입이 나뉜 이유다.
 */
export interface MutableKnowledge {
  readonly discoveredContacts: Set<string>;
  readonly revealedFacts: Set<string>;
  /** 들은 사실의 상세. `revealedFacts`와 **항상 같이** 채운다 */
  readonly heardFacts: Map<string, HeardRumor>;
  /** 청취 판정만 쓰는 슬롯 진행 상태. */
  readonly slotProgress: Map<string, SlotProgress>;
}

/** 플레이어가 의뢰서에 직접 찍는 유일한 판단 값. */
export type RiskGrade = 'D' | 'C' | 'B' | 'A' | 'S';

export const RISK_GRADES: readonly RiskGrade[] = ['D', 'C', 'B', 'A', 'S'];

/** 도장 전후의 의뢰서 상태. 자동 기록 7칸은 `slotProgress`에서만 읽는다. */
export interface CommissionSheet {
  readonly contractId: string;
  playerGrade?: RiskGrade;
  sealed: boolean;
}

export type ClientExpression = 'neutral' | 'tell' | 'ignorance' | 'concealment';

/** 화면을 나갔다 돌아와도 유지되어야 하는 의뢰인별 청취 회계. */
export interface IntakeSession {
  patience: number;
  clientPresent: boolean;
  message: string;
  expression: ClientExpression;
  selectedSlot?: SlotName;
  materialMode?: 'insight' | 'pressure';
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
