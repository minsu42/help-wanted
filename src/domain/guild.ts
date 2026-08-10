/**
 * 길드 규칙 — 영입 비용·정원, 길드 확장.
 *
 * 이 게임의 유이한 자금 싱크다. 없으면 흥정으로 번 돈이 갈 곳이 없어 명성 점수의
 * 부속물이 되고, 흥정의 의미가 반감된다.
 *
 * ## 협상도 조건도 없다
 *
 * 돈을 내면 들어온다. 3일 마감을 위한 의도적 단순화다 — 영입 협상을 이 파일에
 * 붙이려는 유혹이 생기면 여기서 멈춘다. 창구 흥정(`negotiation.ts`)이 이미 그
 * 자리를 채우고 있고, 영입에 또 하나의 흥정 축을 만들면 3일 규모를 넘는다.
 *
 * ## 표시는 전력, 발견은 정보
 *
 * UI는 "의뢰를 감당할 사람이 늘어난다"로 이 모듈을 설명하지만, 실제로는 영입한
 * 사람의 인맥이 정보망에 들어온다. **이 파일은 그 효과를 직접 만들지 않는다** —
 * `rumor.ts`의 `resolveTalk`가 `Client.knownBy`를 이미 보고 있으므로 `inGuild = true`
 * 전환 하나로 저절로 나온다. 이 파일이 하는 일은 그 전환을 자금·정원 규칙에 맞춰
 * 지키는 것뿐이다. `rumor.ts`는 수정하지 않았다.
 *
 * ## 판정은 순수하게, 적용은 호출자가 — 단, 사람 객체는 예외다
 *
 * `economy.ts`와 같은 경계를 따른다: `funds`·`guildTier`처럼 `GameState`가 스칼라로
 * 직접 들고 있는 값은 새 값을 계산해 돌려주기만 하고, 호출자(`gameState.ts`)가
 * 제자리에 적는다. 다만 영입 대상 모험가 객체만은 `dispatch.ts`의 `applyOutcome`처럼
 * **직접 mutate한다** — `roster` 배열의 원소가 곧 그 사람의 유일한 저장소이므로,
 * 복사본을 돌려주면 "복사본을 바꿨는데 원본은 그대로"인 버그만 생긴다.
 *
 * 출처: `design/quick-specs/guild-scale-and-difficulty-2026-08-08.md` §3–4
 */
import { applyFunds } from './economy';
import type { Adventurer, GuildTier } from './types';

/** 영입 비용 계산에 필요한 수치. `balance.json`의 `recruit` 절에서 온다. */
export interface RecruitConfig {
  readonly costBase: number;
  readonly costPerCapability: number;
  readonly costPerTenure: number;
  /** 영입 직후의 신뢰. 낮게 시작한다 — 외부인은 아직 나를 모른다 */
  readonly initialTrust: number;
}

/**
 * 이 모듈이 쓰는 전체 설정. `recruit` 절과 `guildTiers` 테이블을 함께 묶는다.
 *
 * 둘을 하나로 묶은 이유: 영입 가능 여부(`checkRecruit`)가 정원을 판정하려면 결국
 * `guildTiers`도 함께 필요하다 — 두 절을 따로 인자로 받으면 호출부마다 어느 절을
 * 어디서 가져왔는지 추적해야 한다.
 */
export interface GuildConfig {
  readonly recruit: RecruitConfig;
  /** 등급별 정원·홀 출석 최대·동시 의뢰·비용. 조회는 항상 `tier` 값으로 찾는다 */
  readonly guildTiers: readonly GuildTier[];
}

/**
 * 영입 비용 계산이 실제로 보는 모험가의 부분.
 *
 * `capability`·`tenureYears` 둘만 본다 — 베테랑은 비싸고, 그 값의 절반은 인맥값이다.
 */
export type RecruitCostInput = Pick<Adventurer, 'capability' | 'tenureYears'>;

/**
 * `cost = costBase + costPerCapability×capability + costPerTenure×tenureYears`.
 *
 * 검증: 신입(역량 20, 근속 1년) → 80 + 40 + 15 = 135G.
 * 검증: 베테랑(역량 80, 근속 6년) → 80 + 160 + 90 = 330G.
 */
export function recruitCost(candidate: RecruitCostInput, config: RecruitConfig): number {
  return (
    config.costBase +
    config.costPerCapability * candidate.capability +
    config.costPerTenure * candidate.tenureYears
  );
}

/** 정원 판정이 보는 명부 한 명의 부분. */
export type RosterMember = Pick<Adventurer, 'inGuild' | 'status'>;

/**
 * 현재 정원을 채우고 있는 길드원 수.
 *
 * **사망자는 세지 않는다.** 사망으로 자리가 빈 것을 정원 계산이 반영하지 못하면
 * 죽음이 영입 기회까지 함께 앗아가는, 설계되지 않은 이중 처벌이 된다 — 사망은
 * `dispatch.ts`가 이미 감정적으로 무거운 대가를 치르게 하므로 여기서 또 벌하지 않는다.
 */
export function activeGuildRosterSize(roster: readonly RosterMember[]): number {
  return roster.filter((member) => member.inGuild && member.status !== 'dead').length;
}

/** `guildTiers`에서 등급 번호로 한 행을 찾는다. `gameState.ts`의 `currentTier()`와 같은 패턴이다. */
export function findGuildTier(guildTier: number, config: GuildConfig): GuildTier {
  const tier = config.guildTiers.find((entry) => entry.tier === guildTier);
  if (tier === undefined) {
    throw new Error(`정의되지 않은 길드 등급이다 (${guildTier})`);
  }
  return tier;
}

/**
 * 영입이 막히는 사유.
 *
 * **화면이 영입 버튼을 비활성화하고 사유를 표시해야 하므로** boolean 하나로는
 * 부족해 사유 코드로 분리했다. 한국어 문구는 이 모듈이 정하지 않는다 —
 * 프레젠테이션이 소유한다.
 */
export type RecruitBlockReason = 'alreadyInGuild' | 'rosterFull' | 'insufficientFunds';

/** 영입 가능 여부 판정 결과. */
export interface RecruitCheckResult {
  readonly canRecruit: boolean;
  /** `canRecruit`이 `false`일 때만 존재한다 */
  readonly reason?: RecruitBlockReason;
  /** 판정 근거가 된 비용. 가능 여부와 무관하게 항상 채워진다 — 화면이 가격표를 그릴 수 있어야 한다 */
  readonly cost: number;
}

/** 영입 가능 여부 판정이 보는 모험가의 부분. */
export type RecruitCandidate = Pick<Adventurer, 'inGuild' | 'capability' | 'tenureYears'>;

/**
 * 영입 가능 여부를 판정한다. 순수 함수 — 아무것도 바꾸지 않는다.
 *
 * 판정 순서: **이미 길드원인가 → 정원이 찼는가 → 자금이 모자란가.** 정원을 자금보다
 * 먼저 보는 이유는 정원 초과가 돈으로 해결되지 않는 더 단단한 벽이기 때문이다 — 자금은
 * 다음 주에 또 벌면 되지만 정원은 확장 없이는 절대 안 열린다.
 */
export function checkRecruit(
  candidate: RecruitCandidate,
  roster: readonly RosterMember[],
  funds: number,
  guildTier: number,
  config: GuildConfig,
): RecruitCheckResult {
  const cost = recruitCost(candidate, config.recruit);

  if (candidate.inGuild) {
    return { canRecruit: false, reason: 'alreadyInGuild', cost };
  }
  if (activeGuildRosterSize(roster) >= findGuildTier(guildTier, config).rosterCap) {
    return { canRecruit: false, reason: 'rosterFull', cost };
  }
  if (funds < cost) {
    return { canRecruit: false, reason: 'insufficientFunds', cost };
  }
  return { canRecruit: true, cost };
}

/**
 * 영입 대상 모험가. `recruitAdventurer`가 이 객체를 직접 mutate한다 — 명부 배열의
 * 원소 그 자체를 넘겨야 한다(복사본을 넘기면 반영되지 않는다).
 */
export type RecruitTarget = Pick<Adventurer, 'inGuild' | 'trust' | 'capability' | 'tenureYears'>;

/**
 * 영입을 실행한다.
 *
 * 호출자가 이미 `checkRecruit`을 통과시켰다고 가정하지 않는다 — 안전을 위해 내부에서
 * 다시 판정하고, 막혀 있으면 던진다. `dispatch.ts`의 `dispatchParty`가 자기 불변식을
 * 스스로 다시 검사하는 것과 같은 방어다.
 *
 * `candidate`(길드원이 될 모험가)는 **제자리에서** `inGuild = true`,
 * `trust = config.recruit.initialTrust`로 바뀐다. `funds`는 순수하게 새 값을 계산해
 * 돌려준다 — `GameState.funds`에 적는 것은 호출자의 몫이다.
 *
 * 협상도 조건도 없다. 이 함수는 승인/거절 판정을 하지 않는다 — `checkRecruit`이
 * 이미 참이면 무조건 들어온다.
 *
 * @throws `checkRecruit`이 막혔을 때 (사유가 메시지에 포함된다)
 */
export function recruitAdventurer(
  candidate: RecruitTarget,
  roster: readonly RosterMember[],
  funds: number,
  guildTier: number,
  config: GuildConfig,
): number {
  const check = checkRecruit(candidate, roster, funds, guildTier, config);
  if (!check.canRecruit) {
    throw new Error(`영입할 수 없다 (사유: ${check.reason})`);
  }

  candidate.inGuild = true;
  candidate.trust = config.recruit.initialTrust;

  return applyFunds(funds, -check.cost);
}

/** 길드 확장이 막히는 사유. `RecruitBlockReason`과 같은 이유로 코드만 돌려준다. */
export type ExpandBlockReason = 'maxTierReached' | 'insufficientFunds';

/** 길드 확장 가능 여부 판정 결과. */
export interface ExpandCheckResult {
  readonly canExpand: boolean;
  readonly reason?: ExpandBlockReason;
  /** 다음 등급 행. `maxTierReached`가 아니라면 채워진다 — 화면이 다음 등급 가격표를 그릴 수 있어야 한다 */
  readonly nextTier?: GuildTier;
}

/**
 * 길드 확장 가능 여부를 판정한다. 순수 함수.
 *
 * 등급 3(가장 높은 `tier`)에서는 다음 행이 없으므로 무조건 막힌다 — `guildTiers`
 * 배열의 길이가 아니라 "다음 tier가 존재하는가"로 판단한다. 등급 테이블이 나중에
 * 늘어나도 이 함수를 고칠 필요가 없다.
 */
export function checkExpand(
  guildTier: number,
  funds: number,
  config: GuildConfig,
): ExpandCheckResult {
  const nextTier = config.guildTiers.find((entry) => entry.tier === guildTier + 1);
  if (nextTier === undefined) {
    return { canExpand: false, reason: 'maxTierReached' };
  }
  if (funds < nextTier.cost) {
    return { canExpand: false, reason: 'insufficientFunds', nextTier };
  }
  return { canExpand: true, nextTier };
}

/** 길드 확장 실행 결과. `guildTier`·`funds`의 새 값만 담는다 — 적용은 호출자의 몫이다. */
export interface ExpandResult {
  readonly guildTier: number;
  readonly funds: number;
}

/**
 * 길드 등급을 올린다. 순수 함수 — `guildTier`와 `funds`의 새 값만 계산해 돌려준다.
 *
 * **정원·홀 출석 최대·동시 의뢰가 동시에 갱신되는 이유는 이 함수가 셋을 계산해서가
 * 아니라, 셋 다 `guildTiers` 룩업 테이블의 한 행에서 나오기 때문이다.** 등급 숫자
 * 하나만 바꾸면 세 값이 저절로 함께 바뀐다 — `findGuildTier`로 그 행을 다시 읽는
 * 모든 코드(`gameState.ts`의 `currentTier()`, 소문 판정의 홀 출석 상한 등)가 이미
 * 그렇게 짜여 있으므로 이 함수가 개별로 세 값을 계산할 이유가 없다.
 *
 * **효과는 다음 주부터 반영된다.** 이 함수는 `guildTier`와 `funds`만 바꾸고, 그 주
 * 안에는 그 외 아무것도 다시 계산되지 않는다 — 홀 출석 인원과 열린 의뢰 상한은
 * `advanceWeek()`가 한 주에 한 번 `currentTier()`로 등급을 새로 조회할 때에만 갱신된다.
 * 즉 "다음 주부터"는 이 함수가 스스로 보장하는 것이 아니라, `gameState.ts`의 한 주
 * 진행 순서(파견 판정 → 부상 회복 → 의뢰 리필)가 이미 등급 조회를 그 시점에 두고
 * 있기 때문에 자동으로 성립하는 사실이다.
 *
 * @throws `checkExpand`가 막혔을 때 (사유가 메시지에 포함된다)
 */
export function expandGuild(guildTier: number, funds: number, config: GuildConfig): ExpandResult {
  const check = checkExpand(guildTier, funds, config);
  if (!check.canExpand || check.nextTier === undefined) {
    throw new Error(`확장할 수 없다 (사유: ${check.reason})`);
  }

  return {
    guildTier: check.nextTier.tier,
    funds: applyFunds(funds, -check.nextTier.cost),
  };
}
