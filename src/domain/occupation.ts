import type { Rng } from './rng';
import { SLOT_NAMES } from './slots';
import type {
  LeverageTag,
  Occupation,
  Reach,
  SlotName,
  SlotTruth,
} from './types';
import { rollWeightedIndex } from './weighted';

export interface OccupationBalance {
  readonly knowsDist: readonly [number, number, number];
  readonly tellsDist: readonly [number, number, number];
  readonly keyLeverage: LeverageTag | null;
  readonly walletMult: readonly [number, number];
}

export interface SlotContent {
  readonly topic: string;
  readonly vague: string;
  readonly certain: string;
  readonly weight: number;
  readonly hintTags: readonly string[];
}

export interface QuestScenarioDefinition {
  readonly id: string;
  readonly fits: readonly Occupation[];
  readonly intro: string;
  readonly slots: Partial<Readonly<Record<SlotName, SlotContent>>>;
}

export interface QuestTypeDefinition {
  readonly id: string;
  readonly scenarios: readonly QuestScenarioDefinition[];
}

export interface IntakeGenerationConfig {
  readonly occupations: Readonly<Record<Occupation, OccupationBalance>>;
  readonly seatedOccupations: readonly Occupation[];
  readonly questTypes: readonly QuestTypeDefinition[];
  readonly patience: number;
  readonly openingStatementDepth: 'all' | 'firstRung' | 'minimal';
}

export interface RealizedIntake {
  readonly occupation: Occupation;
  readonly keyLeverage: LeverageTag | null;
  readonly questKind: string;
  readonly scenarioId: string;
  readonly slots: ReadonlyMap<SlotName, SlotTruth>;
}

const REACHES: readonly Reach[] = ['none', 'vague', 'certain'];

/** 의뢰 생성 시점에만 직업과 칸의 무지·은폐를 실현한다. */
export function realizeIntake(rng: Rng, config: IntakeGenerationConfig): RealizedIntake {
  const occupation = rng.pick(config.seatedOccupations);
  const occupationBalance = config.occupations[occupation];
  const questType = rng.pick(config.questTypes);
  const matching = questType.scenarios.filter((scenario) => scenario.fits.includes(occupation));
  const scenario = rng.pick(matching.length > 0 ? matching : questType.scenarios);
  const slots = new Map<SlotName, SlotTruth>();

  for (const slot of SLOT_NAMES) {
    const definition = scenario.slots[slot];
    if (definition === undefined) continue;

    let knows = weightedReach(rng, occupationBalance.knowsDist);
    let tells = weightedReach(rng, occupationBalance.tellsDist);
    if (slot === 'kind') {
      knows = clampToVague(knows);
      tells = clampToVague(tells);
    }
    slots.set(slot, {
      knows,
      tells,
      valueKey: `${questType.id}:${scenario.id}:${slot}`,
      weight: definition.weight,
    });
  }

  return {
    occupation,
    keyLeverage: occupationBalance.keyLeverage,
    questKind: questType.id,
    scenarioId: scenario.id,
    slots,
  };
}

export function buildSlotContentCatalog(
  questTypes: readonly QuestTypeDefinition[],
): Readonly<Record<string, SlotContent>> {
  const catalog: Record<string, SlotContent> = {};
  for (const questType of questTypes) {
    for (const scenario of questType.scenarios) {
      for (const slot of SLOT_NAMES) {
        const content = scenario.slots[slot];
        if (content !== undefined) catalog[`${questType.id}:${scenario.id}:${slot}`] = content;
      }
    }
  }
  return catalog;
}

export function scenarioIntro(
  questTypes: readonly QuestTypeDefinition[],
  questKind: string,
  scenarioId: string,
): string {
  return questTypes
    .find((type) => type.id === questKind)
    ?.scenarios.find((scenario) => scenario.id === scenarioId)?.intro ?? '의뢰인이 서류를 내밀었다.';
}

function weightedReach(rng: Rng, weights: readonly number[]): Reach {
  const eligible = weights
    .map((weight, index) => ({ weight, index }))
    .filter(({ weight }) => weight > 0);
  if (eligible.length === 0) throw new Error('직업 분포에는 양수 가중치가 하나 이상 필요하다');
  const picked = rollWeightedIndex(rng, eligible.map(({ weight }) => weight));
  return REACHES[eligible[picked].index];
}

function clampToVague(reach: Reach): Reach {
  return reach === 'none' ? 'vague' : reach;
}
