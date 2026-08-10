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
import questTemplates from './data/quest-templates.json';
import handbook from './data/handbook.json';
import {
  advanceWeek,
  createGameState,
  type GameConfig,
  type ResolvedDispatch,
} from './domain/gameState';
import type { GuildConfig } from './domain/guild';
import type { RumorConfig } from './domain/rumor';
import type { RiskGrade } from './domain/types';
import {
  buildSlotContentCatalog,
  type IntakeGenerationConfig,
} from './domain/occupation';
import type { IntakeMaterial } from './domain/intake';
import type { ScreenHandle } from './presentation/screen';
import {
  mountDispatchScreen,
  type DispatchSettlement,
} from './presentation/ui/DispatchScreen';
import { mountEndingScreen, type EndingTextBank } from './presentation/ui/EndingScreen';
import { mountGuildHallScreen } from './presentation/ui/GuildHallScreen';
import { mountOutcomeScreen, type HeardFact } from './presentation/ui/OutcomeScreen';
import { mountIntakeScreen } from './presentation/ui/IntakeScreen';
import './presentation/styles/base.css';
import './presentation/styles/dispatch.css';
import './presentation/styles/guildHall.css';
import './presentation/styles/outcome.css';
import './presentation/styles/ending.css';
import './presentation/styles/intake.css';

const intakeGeneration = {
  occupations: balance.intake.occupations,
  seatedOccupations: balance.intake.seatedOccupations,
  questTypes: questTemplates.questTypes,
  patience: balance.intake.patience,
  openingStatementDepth: balance.intake.openingStatementDepth,
} as unknown as IntakeGenerationConfig;

const slotContent = buildSlotContentCatalog(intakeGeneration.questTypes);
const handbookEntries = handbook.entries as unknown as readonly IntakeMaterial[];

const config: GameConfig = {
  totalWeeks: balance.session.totalWeeks,
  clientsPerWeek: balance.session.clientsPerWeek,
  startingFunds: balance.economy.startingFunds,
  startingReputation: balance.economy.startingReputation,
  injuredWeeks: balance.dispatch.injuredWeeks,
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
    durationWeeksMin: balance.scaling.durationWeeksMin,
    durationWeeksMax: balance.scaling.durationWeeksMax,
    alternativeChance: balance.client.alternativeChance,
    clientInitialTrust: balance.client.initialTrust,
    knownByMin: balance.rumor.knownByMin,
    knownByMax: balance.rumor.knownByMax,
    tenureWeightExponent: balance.rumor.tenureWeightExponent,
    factsPerContract: balance.rumor.factsPerContract,
    intake: intakeGeneration,
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
  intakeWallet: balance.intake.wallet,
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
 * 한 주를 넘기고, 회차가 끝났으면 결산으로 보낸다.
 *
 * **`advanceWeek`를 부르는 곳이 이 함수 하나뿐인 것이 요점이다.** 화면이 직접 부르면
 * 한 주가 지날 때의 전역 효과(다른 파견 판정, 신뢰·기억 반영, 의뢰 리필, 홀 출석
 * 재추첨)를 프레젠테이션 계층이 소유하게 되고, 두 화면이 각자 부르기 시작하면 진행의
 * 주인이 사라진다.
 *
 * 넘긴 뒤 판정된 파견이 있으면 **결과 대조 화면을 먼저 보여준다.** 그것이 실력 성장의
 * 유일한 피드백 채널이므로 조용히 지나가게 두면 안 된다.
 */
function endWeek(): void {
  const report = advanceWeek(state, config);
  pendingOutcomes.push(...report.resolved);
  showNextOutcomeOr(showIntake);
}

/**
 * 아직 플레이어에게 보여주지 않은 판정 결과들.
 *
 * 큐인 이유: 한 주에 파견 여러 건이 동시에 만기될 수 있고, 그때 하나만 보여주면
 * **나머지 사망이 조용히 지나간다.** 사람이 죽은 것을 통보 없이 넘기는 것은 이
 * 게임에서 가장 하면 안 되는 일이다 — 결과 대조 화면이 존재하는 이유 자체가 그것이다.
 */
const pendingOutcomes: ResolvedDispatch[] = [];

/**
 * 남은 결과가 있으면 하나 보여주고, 없으면 `fallback`으로 간다.
 *
 * 회차 종료 판정이 결과 표시보다 **뒤에** 오는 것이 의도다. 8주차에 사람이 죽었으면
 * 그 대조를 보고 나서 결산으로 가야 한다. 순서를 뒤집으면 마지막 주의 죽음만 유일하게
 * 설명 없이 사라진다.
 */
function showNextOutcomeOr(fallback: () => void): void {
  const next = pendingOutcomes.shift();
  if (next !== undefined) {
    showOutcome(next);
    return;
  }
  if (state.phase === 'ended') {
    showEnding();
    return;
  }
  fallback();
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
      rng: state.rng,
      text: textBank,
      copy: textBank.ui.outcome,
      // 남은 결과가 더 있으면 이어서 보여준다. 큐가 비면 창구(또는 결산)로.
      onContinue: () => showNextOutcomeOr(showIntake),
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
      onEndWeek: endWeek,
      onAssignContract: (contract) => {
        const terms = state.settlements[contract.id];
        if (terms === undefined) return;
        showDispatch({
          contract,
          offer: { rewardMultiplier: terms.agreedReward / contract.baseReward, discloseRisk: terms.discloseRisk },
          agreedReward: terms.agreedReward,
        });
      },
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
  showIntake();
}

function showIntake(): void {
  const intakeContract = state.openContracts.find(
    (contract) => contract.questKind !== 'legacy' && !state.commissionSheets[contract.id]?.sealed,
  );
  if (intakeContract !== undefined) {
    swapTo((root) =>
      mountIntakeScreen(root, {
        state,
        contract: intakeContract,
        slotContent,
        handbook: handbookEntries,
        statedGrade: statedGradeOf(intakeContract.statedRisk),
        copy: textBank.ui.intake,
        onSealed: (contract) => {
          const agreedReward = state.intakeSessions[contract.id]?.reward.agreedReward;
          if (agreedReward === undefined) throw new Error('보수 합의 없이 도장을 찍을 수 없다');
          state.settlements[contract.id] = { agreedReward, discloseRisk: false };
          showIntake();
        },
      }),
    );
    return;
  }

  showGuildHall();
}

function statedGradeOf(risk: number): RiskGrade {
  const thresholds = balance.commission.statedRiskThresholds;
  if (risk >= thresholds.S) return 'S';
  if (risk >= thresholds.A) return 'A';
  if (risk >= thresholds.B) return 'B';
  if (risk >= thresholds.C) return 'C';
  return 'D';
}

/**
 * 타결된 계약 하나를 배정 화면으로 넘긴다.
 *
 * 이 경로는 인원 배정만 열고 주를 넘기지 않는다. 주 진행은 길드 홀의 `endWeek`만
 * 소유한다.
 */
function showDispatch(settlement: DispatchSettlement): void {
  swapTo((root) =>
    mountDispatchScreen(root, {
      state,
      settlement,
      gradeThresholds: balance.adventurer.gradeThresholds,
      assignmentRules: {
        survivalRefusalRisk: balance.dispatch.survivalRefusalRisk,
        assignmentTrustThreshold: balance.dispatch.assignmentTrustThreshold,
        gloryVolunteerRisk: balance.dispatch.gloryVolunteerRisk,
        forcedAssignmentTrustPenalty: balance.dispatch.forcedAssignmentTrustPenalty,
        maxConcurrentDispatches: config.guildTiers.find((tier) => tier.tier === state.guildTier)?.concurrentContracts ?? 1,
      },
      // 배정 화면이 이미 자기 계약의 서술을 보여줬어도, 대조는 따로 보여준다 —
      // "무슨 일이 일어났는가"와 "왜 그렇게 됐는가"는 다른 정보다.
      //
      // 배정 단계에서 눌린 경우(「나중에 배정한다」)에도 같은 곳으로 간다. 큐가 비어
      // 있으면 그냥 창구이고, 의뢰는 아직 `openContracts`에 있으므로 잃는 것이 없다.
      onReturnToHall: showGuildHall,
    }),
  );
}

showIntake();
