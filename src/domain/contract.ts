/**
 * 의뢰인·의뢰 생성 — 숨은 진실이 태어나는 곳.
 *
 * 공개 위험도({@link Contract.statedRisk})와 실제 위험도({@link Contract.realRisk})의
 * 격차가 여기서 만들어지고, **그 격차가 이 게임의 정보 경제 전체를 굴린다.** 격차가
 * 0이면 소문이 무의미해지고, 너무 크면 도박이 된다.
 *
 * ## 왜 실제 위험도가 무작위여야 하는가
 *
 * 명성에서 결정론적으로 나오면 계산하면 되므로 **소문이 무가치해진다.** 흔들리기
 * 때문에 알아낼 가치가 생긴다. 정보를 얻는다는 것은 이 무작위를 지우는 일이다 —
 * 무작위성과 정보 게임은 대립하지 않고 서로를 필요로 한다.
 *
 * ## 보상이 공개 위험도 기준인 것이 핵심이다
 *
 * 의뢰인은 자기가 인정한 위험만큼만 값을 부른다. 그래서 실제 위험을 알아내 고지하면
 * 더 받아낼 수 있다 — 흥정의 위험 고지 축이 성립하는 경제적 근거가 이것이다.
 *
 * 출처: `design/quick-specs/guild-scale-and-difficulty-2026-08-08.md` §2,
 * `design/quick-specs/rumor-network-2026-08-08.md` §1–2
 */
import { pickTwoTraits, pickUniqueName, type NamePool } from './person';
import type { Rng } from './rng';
import { FACT_KINDS, GOALS, type Adventurer, type Client, type Contract, type Fact } from './types';

/** 의뢰 생성에 필요한 수치. 전부 `balance.json`에서 온다. */
export interface ContractConfig {
  /** 명성 0에서의 기대 위험도 */
  readonly riskBase: number;
  /** 명성 1점당 기대 위험도 증가분 — 압력 곡선의 기울기 */
  readonly riskPerReputation: number;
  /** 실제 위험도가 기대치에서 흔들리는 폭. **정보의 가치를 정하는 노브다** */
  readonly riskSpread: number;
  readonly concealmentMin: number;
  readonly concealmentMax: number;
  readonly temptationChance: number;
  readonly temptationRiskMultiplier: number;
  readonly temptationRewardMultiplier: number;
  readonly rewardPerRisk: number;
  readonly partySizeRiskDivisor: number;
  readonly maxPartySizeCap: number;
  readonly durationRiskDivisor: number;
  readonly durationDaysMin: number;
  readonly durationDaysMax: number;
  /** 의뢰인이 다른 길드라는 대안을 가질 확률 */
  readonly alternativeChance: number;
  readonly clientInitialTrust: number;
  readonly knownByMin: number;
  readonly knownByMax: number;
  /** 근속 가중치의 지수. 높을수록 정보가 베테랑에 집중된다 = 죽음이 더 아프다 */
  readonly tenureWeightExponent: number;
  readonly factsPerContract: number;
}

/** 의뢰 하나를 만드는 데 필요한 바깥 상황. */
export interface ContractContext {
  /** 이 의뢰의 id. 사실 id가 여기서 파생된다 */
  readonly id: string;
  /** 현재 명성. 압력 곡선의 입력이다 */
  readonly reputation: number;
  /** 월드 모험가 풀 **전체**. 길드원과 외부인을 가리지 않는다 */
  readonly roster: readonly Adventurer[];
  /** 이름 표 */
  readonly names: NamePool;
  /** 이미 쓰인 이름. 모험가 명부와 공유해야 의뢰인이 동명이인이 되지 않는다 */
  readonly usedNames?: Set<string>;
}

/**
 * 의뢰 하나를 만든다.
 *
 * 같은 `rng` 시드 + 같은 `reputation` + 같은 `roster`면 언제나 같은 의뢰가 나온다.
 *
 * @throws `roster`가 비어 있고 `knownByMin > 0`일 때 — 아는 사람을 뽑을 대상이 없다
 */
export function createContract(
  rng: Rng,
  config: ContractConfig,
  context: ContractContext,
): Contract {
  const { id, reputation, roster, names } = context;
  const usedNames = context.usedNames ?? new Set<string>();

  const isTemptation = rng.chance(config.temptationChance);

  // 명성이 압력을 만든다. 성공할수록 감당 못 할 것이 온다.
  const expectedRisk =
    (config.riskBase + config.riskPerReputation * reputation) *
    (isTemptation ? config.temptationRiskMultiplier : 1);

  const realRisk = expectedRisk * (1 + rng.range(-config.riskSpread, config.riskSpread));
  const concealment = rng.range(config.concealmentMin, config.concealmentMax);
  const statedRisk = realRisk * (1 - concealment);

  // 보상은 **공개** 위험도 기준이다. 의뢰인은 자기가 인정한 위험만큼만 값을 부른다.
  const baseReward =
    statedRisk *
    config.rewardPerRisk *
    (isTemptation ? config.temptationRewardMultiplier : 1);

  // 파티 정원과 기한도 공개 위험도에서 나온다 — 플레이어가 보고 판단할 수 있어야 한다.
  const maxPartySize = clamp(
    Math.ceil(statedRisk / config.partySizeRiskDivisor),
    1,
    config.maxPartySizeCap,
  );
  const durationDays = clamp(
    Math.round(statedRisk / config.durationRiskDivisor),
    config.durationDaysMin,
    config.durationDaysMax,
  );

  const knownByCount = rng.int(config.knownByMin, config.knownByMax);
  const knownBy = pickByTenureWeight(rng, roster, knownByCount, config.tenureWeightExponent);

  const client: Client = {
    id: `${id}-client`,
    name: pickUniqueName(rng, names, usedNames),
    traits: pickTwoTraits(rng),
    goal: rng.pick(GOALS),
    trust: config.clientInitialTrust,
    memories: [],
    wealth: rng.range(0, 1),
    urgency: rng.range(0, 1),
    hasAlternative: rng.chance(config.alternativeChance),
    knownBy,
  };

  return {
    id,
    client,
    statedRisk,
    realRisk,
    concealment,
    baseReward,
    maxPartySize,
    durationDays,
    isTemptation,
    facts: buildFacts(id, config.factsPerContract),
  };
}

/**
 * 이 의뢰에 심을 사실을 만든다.
 *
 * `factsPerContract`가 종류 수보다 적으면 앞에서부터 자른다 — `realRisk`가 먼저인
 * 이유는 그것이 위험 고지 축을 여는, 게임에서 더 중요한 정보이기 때문이다.
 */
function buildFacts(contractId: string, count: number): readonly Fact[] {
  return FACT_KINDS.slice(0, Math.max(0, count)).map((kind) => ({
    id: `${contractId}:${kind}`,
    contractId,
    kind,
  }));
}

/**
 * 근속 연수를 가중치로 서로 다른 모험가 `count`명을 뽑아 id를 돌려준다.
 *
 * 가중치는 `tenureYears ^ tenureWeightExponent`. 베테랑이 뽑힐 확률이 높으므로
 * **베테랑이 죽으면 사람만 잃는 것이 아니라 정보망이 무너진다** — 그 긴장의 기계적
 * 근거가 이 함수다.
 *
 * 근속 0년은 가중치가 0이라 뽑히지 않는다. 의도한 것이다 — 갓 들어온 사람이 상단주를
 * 알 이유가 없다. 다만 **전원이 0년이면** 뽑을 대상이 사라지므로 그때만 균등 추출로
 * 물러선다. 그러지 않으면 "아무도 모르는 의뢰"만 나오는 죽은 월드가 된다.
 */
function pickByTenureWeight(
  rng: Rng,
  roster: readonly Adventurer[],
  count: number,
  exponent: number,
): readonly string[] {
  const weightOf = (person: Adventurer): number => Math.pow(person.tenureYears, exponent);

  const anyWeighted = roster.some((person) => weightOf(person) > 0);
  const remaining = anyWeighted ? roster.filter((person) => weightOf(person) > 0) : [...roster];

  const chosen: string[] = [];
  const wanted = Math.min(count, remaining.length);

  for (let picked = 0; picked < wanted; picked += 1) {
    const index = anyWeighted
      ? rollWeightedIndex(rng, remaining.map(weightOf))
      : rng.int(0, remaining.length - 1);
    chosen.push(remaining[index].id);
    remaining.splice(index, 1);
  }

  return chosen;
}

/**
 * 가중치 배열에서 인덱스 하나를 뽑는다. 모든 가중치가 양수라고 가정한다.
 *
 * 누적합 방식. 부동소수 오차로 끝까지 도달하는 경우를 대비해 마지막 인덱스가 기본값이다.
 */
function rollWeightedIndex(rng: Rng, weights: readonly number[]): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = rng.next() * total;

  for (let index = 0; index < weights.length; index += 1) {
    roll -= weights[index];
    if (roll < 0) return index;
  }

  return weights.length - 1;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
