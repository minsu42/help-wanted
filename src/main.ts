/**
 * 조립 지점 — 설정 파일과 도메인과 화면을 여기서만 잇는다.
 *
 * `balance.json`을 읽는 곳이 여기 하나뿐인 것이 중요하다. 도메인 모듈들은 전부
 * 설정을 주입받게 만들어 뒀고, 그 규칙이 지켜지는지는 이 파일이 유일한 import
 * 지점인지로 확인할 수 있다.
 */
import balance from './data/balance.json';
import names from './data/names.json';
import textBank from './data/text.json';
import {
  advanceDay,
  createGameState,
  type GameConfig,
  type ResolvedDispatch,
} from './domain/gameState';
import type { GuildConfig } from './domain/guild';
import { canDisclose, type DisclosureReason } from './domain/negotiation';
import type { RumorConfig } from './domain/rumor';
import type { Contract } from './domain/types';
import type { ScreenHandle } from './presentation/screen';
import {
  mountCounterScreen,
  type DisclosureStatus,
  type Settlement,
} from './presentation/ui/CounterScreen';
import { mountDispatchScreen } from './presentation/ui/DispatchScreen';
import { mountEndingScreen, type EndingTextBank } from './presentation/ui/EndingScreen';
import { mountGuildHallScreen } from './presentation/ui/GuildHallScreen';
import { mountOutcomeScreen, type HeardFact } from './presentation/ui/OutcomeScreen';
import './presentation/styles/base.css';
import './presentation/styles/counter.css';
import './presentation/styles/dispatch.css';
import './presentation/styles/guildHall.css';
import './presentation/styles/outcome.css';
import './presentation/styles/ending.css';

const config: GameConfig = {
  totalDays: balance.session.totalDays,
  startingFunds: balance.economy.startingFunds,
  startingReputation: balance.economy.startingReputation,
  injuredDays: balance.dispatch.injuredDays,
  guildTiers: balance.guildTiers,
  names,
  roster: {
    worldRosterSize: balance.world.worldRosterSize,
    startingGuildSize: balance.world.startingGuildSize,
    capabilityMin: balance.adventurer.capabilityMin,
    capabilityMax: balance.adventurer.capabilityMax,
    tenureYearsMin: balance.adventurer.tenureYearsMin,
    tenureYearsMax: balance.adventurer.tenureYearsMax,
    guildInitialTrust: balance.world.guildInitialTrust,
    visitorInitialTrust: balance.recruit.initialTrust,
  },
  contract: {
    riskBase: balance.scaling.riskBase,
    riskPerReputation: balance.scaling.riskPerReputation,
    riskSpread: balance.scaling.riskSpread,
    concealmentMin: balance.scaling.concealmentMin,
    concealmentMax: balance.scaling.concealmentMax,
    temptationChance: balance.scaling.temptationChance,
    temptationRiskMultiplier: balance.scaling.temptationRiskMultiplier,
    temptationRewardMultiplier: balance.scaling.temptationRewardMultiplier,
    rewardPerRisk: balance.economy.rewardPerRisk,
    partySizeRiskDivisor: balance.scaling.partySizeRiskDivisor,
    maxPartySizeCap: balance.scaling.maxPartySizeCap,
    durationRiskDivisor: balance.scaling.durationRiskDivisor,
    durationDaysMin: balance.scaling.durationDaysMin,
    durationDaysMax: balance.scaling.durationDaysMax,
    alternativeChance: balance.client.alternativeChance,
    clientInitialTrust: balance.client.initialTrust,
    knownByMin: balance.rumor.knownByMin,
    knownByMax: balance.rumor.knownByMax,
    tenureWeightExponent: balance.rumor.tenureWeightExponent,
    factsPerContract: balance.rumor.factsPerContract,
  },
  dispatch: {
    successRatio: balance.dispatch.successRatio,
    injuryRatio: balance.dispatch.injuryRatio,
    maxUncertainty: balance.dispatch.maxUncertainty,
    certaintyBand: balance.dispatch.certaintyBand,
    casualtyBias: balance.dispatch.casualtyBias,
  },
  economy: {
    repOnSuccess: balance.dispatch.repOnSuccess,
    repOnDeath: balance.dispatch.repOnDeath,
    repInjuryPenalty: balance.dispatch.repInjuryPenalty,
  },
  reputation: {
    trustOnSurvive: balance.rumor.trustOnSurvive,
    trustOnWound: balance.rumor.trustOnWound,
    trustOnDeath: balance.rumor.trustOnDeath,
    trustOnDeceit: balance.rumor.trustOnDeceit,
    dangerThreshold: balance.rumor.dangerMemoryThreshold,
  },
  hall: {
    hallAttendanceMin: balance.rumor.hallAttendanceMin,
    visitorMin: balance.rumor.visitorMin,
    visitorMax: balance.rumor.visitorMax,
  },
};

const guildConfig: GuildConfig = {
  recruit: {
    costBase: balance.recruit.costBase,
    costPerCapability: balance.recruit.costPerCapability,
    costPerTenure: balance.recruit.costPerTenure,
    initialTrust: balance.recruit.initialTrust,
  },
  guildTiers: balance.guildTiers,
};

const rumorConfig: RumorConfig = {
  trustThresholdDefault: balance.rumor.trustThresholdDefault,
  trustThresholdCautious: balance.rumor.trustThresholdCautious,
  trustThresholdLoyal: balance.rumor.trustThresholdLoyal,
  traitDistortion: balance.rumor.traitDistortion,
  greedyPrice: balance.rumor.greedyPrice,
};

/**
 * 위험 고지 축의 닫힘 사유를 화면 문구로 바꾼다.
 *
 * 도메인은 사유 코드만 돌려주고 한국어는 여기서 붙인다. **두 문구가 전달하는 것이
 * 서로 다르다는 점이 중요하다** — 하나는 "소문을 캐러 가라"는 지시이고, 다른 하나는
 * "들은 그대로다"라는 **정보**다. 후자를 "축을 쓸 수 없다"로 뭉개면 정직한 의뢰인이
 * 섞여 있다는 사실 자체를 플레이어가 배울 수 없다.
 */
const DISCLOSURE_REASONS: Readonly<Record<DisclosureReason, string>> = {
  unknownRisk: '이 의뢰의 실제 위험을 모른다. 홀에서 물어볼 것.',
  noGap: '들은 그대로다. 더 요구할 근거가 없다.',
};

function disclosureStatus(contract: Contract): DisclosureStatus {
  const gate = canDisclose(contract, state.knowledge);
  if (gate.allowed) return { allowed: true };
  return { allowed: false, reason: DISCLOSURE_REASONS[gate.reason] };
}

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app 요소를 찾을 수 없다');

/**
 * 이번 회차의 시드. **엔딩 화면에 그대로 표시된다** — 같은 시드로 재현할 수 있어야
 * 심사·디버깅·동영상 촬영에서 좋은 회차를 다시 만들 수 있다.
 *
 * `Math.random()`을 쓰지 않는다. 프로젝트 규칙이기도 하지만, 시드를 만드는 방식이
 * 재현 불가능하면 "시드를 표시한다"는 것이 반쪽이 된다.
 */
let seed = Date.now() >>> 0;
let state = createGameState(seed, config);

/**
 * 지금 떠 있는 화면. 갈아끼우기 전에 반드시 `destroy()`를 부른다.
 *
 * 화면 모듈이 리스너를 루트에 걸어 두므로, 정리하지 않고 다음 화면을 얹으면 죽은
 * 화면의 핸들러가 계속 살아 있다 — 클릭 한 번이 두 번 처리되는 종류의 버그가 된다.
 */
let current: ScreenHandle | undefined;

function swapTo(mount: (root: HTMLElement) => ScreenHandle): void {
  current?.destroy();
  current = mount(app!);
}

/**
 * 하루를 넘기고, 회차가 끝났으면 결산으로 보낸다.
 *
 * **`advanceDay`를 부르는 곳이 이 함수 하나뿐인 것이 요점이다.** 화면이 직접 부르면
 * 하루가 지날 때의 전역 효과(다른 파견 판정, 신뢰·기억 반영, 의뢰 리필, 홀 출석
 * 재추첨)를 프레젠테이션 계층이 소유하게 되고, 두 화면이 각자 부르기 시작하면 진행의
 * 주인이 사라진다.
 *
 * 넘긴 뒤 판정된 파견이 있으면 **결과 대조 화면을 먼저 보여준다.** 그것이 실력 성장의
 * 유일한 피드백 채널이므로 조용히 지나가게 두면 안 된다.
 */
function endDay(): void {
  const report = advanceDay(state, config);

  if (report.phase === 'ended') {
    showEnding();
    return;
  }

  const [first] = report.resolved;
  if (first !== undefined) {
    showOutcome(first);
    return;
  }

  showCounter();
}

/**
 * 판정된 파견 하나를 결과 대조 화면으로 넘긴다.
 *
 * 좌변("알았던 것")을 채우는 일이 여기 있는 이유: 화면은 명부를 조회하지 않으므로
 * 화자 id를 사람 이름·성격으로 풀어서 넘겨야 한다. `heardFacts`에 없는 사실은 아예
 * 넘기지 않고, "몰랐다"는 화면이 채운다 — 빈칸으로 두지 않는 것이 이 화면의 규약이다.
 */
function showOutcome(resolved: ResolvedDispatch): void {
  const { dispatch, result } = resolved;
  const { contract } = dispatch;

  const heardFacts = contract.facts.flatMap((fact): HeardFact[] => {
    const heard = state.knowledge.heardFacts.get(fact.id);
    if (heard === undefined) return [];

    const teller = state.roster.find((person) => person.id === heard.tellerId);
    if (teller === undefined) return [];

    return [
      {
        kind: fact.kind,
        statedValue: heard.statedValue,
        tellerId: heard.tellerId,
        tellerName: teller.name,
        tellerTraits: teller.traits,
      },
    ];
  });

  swapTo((root) =>
    mountOutcomeScreen(root, {
      outcome: {
        contract,
        result,
        party: dispatch.partyIds.flatMap((id) => {
          const member = state.roster.find((person) => person.id === id);
          return member === undefined ? [] : [member];
        }),
        concealedKnownRisk: dispatch.concealedKnownRisk,
        heardFacts,
      },
      gradeThresholds: balance.adventurer.gradeThresholds,
      certaintyBand: balance.dispatch.certaintyBand,
      knowledge: state.knowledge,
      rng: state.rng,
      text: textBank,
      onContinue: showCounter,
    }),
  );
}

function showGuildHall(): void {
  swapTo((root) =>
    mountGuildHallScreen(root, {
      state,
      rumor: rumorConfig,
      guild: guildConfig,
      gradeThresholds: balance.adventurer.gradeThresholds,
      text: textBank,
      onAdvanceDay: endDay,
      onReturnToCounter: showCounter,
    }),
  );
}

function showEnding(): void {
  swapTo((root) =>
    mountEndingScreen(root, {
      state,
      text: textBank as EndingTextBank,
      reputationTiers: {
        low: balance.ending.reputationLow,
        high: balance.ending.reputationHigh,
      },
      seed,
      onRestart: restart,
    }),
  );
}

/**
 * 새 시드로 완전히 새 회차를 시작한다.
 *
 * 시드를 이전 시드에서 파생시키는 이유: `Math.random()`을 쓰지 않으면서도 매번 다른
 * 회차가 나와야 한다. 여기서 나온 시드도 엔딩 화면에 표시되므로 그 회차를 다시
 * 재현할 수 있다.
 */
function restart(): void {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  state = createGameState(seed, config);
  showCounter();
}

function showCounter(): void {
  swapTo((root) =>
    mountCounterScreen(root, {
      state,
      negotiation: {
        wReward: balance.negotiation.wReward,
        wAdvance: balance.negotiation.wAdvance,
        toleranceBase: balance.negotiation.toleranceBase,
        wealthWeight: balance.negotiation.wealthWeight,
        urgencyWeight: balance.negotiation.urgencyWeight,
        alternativePenalty: balance.negotiation.alternativePenalty,
        disclosureBonus: balance.negotiation.disclosureBonus,
        maxOffers: balance.negotiation.maxOffers,
      },
      bounds: {
        rewardMin: balance.negotiation.offerRewardMin,
        rewardMax: balance.negotiation.offerRewardMax,
        step: balance.negotiation.offerStep,
      },
      text: textBank,
      disclosureStatus,
      onSettled: showDispatch,
      onVisitHall: showGuildHall,
      onEndDay: endDay,
    }),
  );
}

/**
 * 타결된 계약 하나를 배정 화면으로 넘긴다.
 *
 * **`advanceDay`를 부르는 곳이 여기 하나뿐인 것이 요점이다.** 화면이 직접 부르면
 * 하루가 지날 때의 전역 효과(다른 파견 판정, 의뢰 리필, 이후 홀 출석)를 프레젠테이션
 * 계층이 소유하게 되고, Story 010이 또 부르기 시작하면 진행의 주인이 사라진다.
 */
function showDispatch(settlement: Settlement): void {
  swapTo((root) =>
    mountDispatchScreen(root, {
      state,
      settlement,
      gradeThresholds: balance.adventurer.gradeThresholds,
      assignmentRules: {
        survivalRefusalRisk: balance.dispatch.survivalRefusalRisk,
        assignmentTrustThreshold: balance.dispatch.assignmentTrustThreshold,
        gloryVolunteerRisk: balance.dispatch.gloryVolunteerRisk,
      },
      text: textBank,
      onAdvanceDay: () => advanceDay(state, config),
      onReturnToCounter: showCounter,
    }),
  );
}

/**
 * 배정 화면은 자기 계약의 결과만 보여준 뒤 창구로 돌아간다.
 *
 * 그 화면의 `onAdvanceDay`가 `advanceDay`를 직접 부르는 것은 **자기 파견의 결과를
 * 그리기 위해 `DayReport`를 즉시 받아야 하기 때문**이다. 그래서 결과 대조 화면은
 * 배정 화면 경로에서는 뜨지 않고, 창구·홀에서 하루를 넘길 때(`endDay`) 뜬다.
 * 두 경로가 갈리는 것이 지금의 구조이며, story-017에서 배정 화면도 결과 대조를
 * 거치도록 합칠 여지가 있다.
 */

showCounter();
