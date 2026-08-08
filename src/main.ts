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
import { createGameState, type GameConfig } from './domain/gameState';
import type { Contract } from './domain/types';
import {
  mountCounterScreen,
  type DisclosureStatus,
  type Settlement,
} from './presentation/ui/CounterScreen';
import './presentation/styles/base.css';
import './presentation/styles/counter.css';

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
};

/**
 * 위험 고지 축의 개폐 판정 — **Story 011이 여기를 채운다.**
 *
 * 지금은 언제나 잠겨 있고 사유를 돌려준다. 실제 규칙은 "그 의뢰의 `realRisk` 사실을
 * 소문으로 얻었고, 실제 위험도가 공개 위험도보다 클 때"다.
 */
function disclosureStatus(_contract: Contract): DisclosureStatus {
  return { allowed: false, reason: '이 의뢰의 실제 위험을 아직 모른다.' };
}

/** 타결 뒤 배정 화면 — **Story 008이 여기를 채운다.** */
function onSettled(settlement: Settlement): void {
  // eslint-disable-next-line no-console
  console.info('타결:', settlement.contract.id, `${Math.round(settlement.agreedReward)}G`);
}

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('#app 요소를 찾을 수 없다');

// 시드는 Story 016(엔딩·재시작)에서 플레이어가 고를 수 있게 된다.
const state = createGameState(Date.now() >>> 0, config);

mountCounterScreen(app, {
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
  onSettled,
});
