/**
 * 월드 모험가 명부 생성.
 *
 * 이 게임의 모든 사람이 여기서 태어난다. 월드 풀 전체를 만들고, 그중 일부를 길드원으로
 * 표시한다. 나머지는 외부 모험가이며 길드 홀을 방문하거나 영입 대상이 된다.
 *
 * ## 왜 길드원을 무작위로 고르는가
 *
 * 역량 상위 N명을 길드원으로 삼지 않는다. 플레이어가 물려받은 것은 **다 망한 길드**이고,
 * 좋은 사람들이 이미 내 밑에 있다면 영입에 이유가 없어진다.
 *
 * ## 설정값을 주입받는 이유
 *
 * `balance.json`을 직접 읽지 않고 {@link RosterConfig}를 받는다. 싱글턴을 참조하면
 * 테스트에서 범위를 갈아 끼울 수 없고, 경계값 검증이 불가능해진다. 같은 이유로 이름
 * 표도 주입받는다 ({@link NamePool}).
 */
import { pickTwoTraits, pickUniqueName, type NamePool } from './person';
import type { Rng } from './rng';
import { GOALS, type Adventurer } from './types';

/** 명부 생성에 필요한 수치. 전부 `balance.json`에서 온다. */
export interface RosterConfig {
  readonly worldRosterSize: number;
  readonly startingGuildSize: number;
  readonly capabilityMin: number;
  readonly capabilityMax: number;
  readonly tenureYearsMin: number;
  readonly tenureYearsMax: number;
  /** 길드원의 시작 신뢰. 이미 내 사람이므로 외부인보다 높다 */
  readonly guildInitialTrust: number;
  /** 외부 모험가의 시작 신뢰. 낮아서 사실을 말해주지 않는다 */
  readonly visitorInitialTrust: number;
}

/**
 * 월드 모험가 명부를 만든다.
 *
 * 같은 `rng` 시드와 같은 `config`면 언제나 같은 명부가 나온다.
 *
 * @param names 이름 조합에 쓸 표 (`src/data/names.json`)
 * @param usedNames 이미 쓰인 이름. 의뢰인 생성과 집합을 공유하려면 넘긴다.
 *   생략하면 이 명부 안에서만 중복을 막는다
 * @throws 길드 정원이 월드 풀보다 클 때
 */
export function createWorldRoster(
  rng: Rng,
  config: RosterConfig,
  names: NamePool,
  usedNames: Set<string> = new Set(),
): Adventurer[] {
  if (config.startingGuildSize > config.worldRosterSize) {
    throw new Error(
      `길드 정원(${config.startingGuildSize})이 월드 풀(${config.worldRosterSize})보다 크다`,
    );
  }

  const roster: Adventurer[] = [];

  for (let i = 0; i < config.worldRosterSize; i += 1) {
    roster.push({
      id: `adv-${i}`,
      name: pickUniqueName(rng, names, usedNames),
      traits: pickTwoTraits(rng),
      goal: rng.pick(GOALS),
      trust: config.visitorInitialTrust,
      memories: [],
      capability: rng.int(config.capabilityMin, config.capabilityMax),
      status: 'available',
      inGuild: false,
      tenureYears: rng.int(config.tenureYearsMin, config.tenureYearsMax),
    });
  }

  for (const index of pickDistinctIndices(rng, config.worldRosterSize, config.startingGuildSize)) {
    const member = roster[index];
    member.inGuild = true;
    member.trust = config.guildInitialTrust;
  }

  return roster;
}

/**
 * 0 이상 `total` 미만의 정수 중 서로 다른 `count`개를 뽑는다.
 *
 * 부분 Fisher-Yates. 앞에서부터 `count`개만 섞으므로 전체를 섞을 필요가 없다.
 */
function pickDistinctIndices(rng: Rng, total: number, count: number): number[] {
  const pool = Array.from({ length: total }, (_, index) => index);
  for (let i = 0; i < count; i += 1) {
    const j = rng.int(i, total - 1);
    const swap = pool[i];
    pool[i] = pool[j];
    pool[j] = swap;
  }
  return pool.slice(0, count);
}
