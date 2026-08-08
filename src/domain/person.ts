/**
 * 인물 생성의 공통 조각 — 모험가와 의뢰인이 함께 쓴다.
 *
 * 두 종류의 인물이 있지만 **이름과 성격을 만드는 방법은 같다.** 그래서 여기 한 번만
 * 있다. 명부(`roster.ts`)와 의뢰(`contract.ts`)가 각자 복사해 가지면, 이름 충돌
 * 방지가 두 곳으로 갈라져서 "모험가끼리는 안 겹치는데 의뢰인과는 겹치는" 상태가 된다.
 *
 * ## 이름 표를 주입받는 이유
 *
 * `names.json`을 직접 import하지 않고 {@link NamePool}을 받는다. 정적 import면
 * 테스트에서 표를 줄일 수 없고, 그러면 **이름 고갈 경로를 영영 검증하지 못한다.**
 * 실패 경로를 테스트할 수 없는 방어 코드는 방어 코드가 아니다.
 */
import type { Rng } from './rng';
import { TRAITS, type Trait } from './types';

/** 이름을 조합해 만들 두 개의 표. 실제 값은 `src/data/names.json`에 있다. */
export interface NamePool {
  readonly given: readonly string[];
  readonly family: readonly string[];
}

/**
 * 이름 조합이 고갈됐을 때 무한 루프를 막는 상한.
 *
 * 밸런스 값이 아니라 기술적 안전장치이므로 `balance.json`에 두지 않는다
 * (판정 근거: `production/stories/story-001-world-roster.md`의 AC-10 절).
 *
 * 200인 이유: 기본 표가 14 × 12 = 168조합이고 뽑는 인원이 22명 + 의뢰인 몇이므로,
 * 정상 상황에서는 재시도가 한두 번을 넘지 않는다. 200번을 연달아 실패했다면 그것은
 * 운이 나쁜 것이 아니라 표가 부족한 것이다.
 */
const MAX_NAME_ATTEMPTS = 200;

/**
 * 아직 쓰이지 않은 이름 조합을 뽑고 `used`에 등록한다.
 *
 * 동명이인이 있으면 소문에서 "누가 말했는지"가 흐려진다. 인물이 이름으로만 존재하는
 * 게임에서 이름 충돌은 곧 인물 소실이다.
 *
 * `used`를 호출자가 넘기는 것이 핵심이다 — 모험가와 의뢰인이 **같은 집합**을 공유해야
 * 서로 간의 충돌까지 막힌다.
 *
 * @throws 표를 다 뒤져도 빈 조합을 못 찾았을 때
 */
export function pickUniqueName(rng: Rng, pool: NamePool, used: Set<string>): string {
  for (let attempt = 0; attempt < MAX_NAME_ATTEMPTS; attempt += 1) {
    const name = `${rng.pick(pool.given)} ${rng.pick(pool.family)}`;
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  throw new Error(
    `이름 조합이 고갈됐다 (${pool.given.length} × ${pool.family.length}조합, ` +
      `${used.size}개 사용 중) — names.json의 표를 늘려야 한다`,
  );
}

/**
 * 서로 다른 성격 태그 2개를 뽑는다.
 *
 * 같은 태그가 두 번 붙으면 "수다스럽고 수다스러운 사람"이 되어 성격 필터가 무의미해진다.
 *
 * @throws {@link TRAITS}가 2개 미만일 때 — 서로 다른 둘을 뽑는 것이 불가능하다
 */
export function pickTwoTraits(rng: Rng): readonly [Trait, Trait] {
  if (TRAITS.length < 2) {
    throw new Error(`성격 태그가 ${TRAITS.length}개뿐이다 — 서로 다른 2개를 뽑을 수 없다`);
  }
  const first = rng.pick(TRAITS);
  const rest = TRAITS.filter((trait) => trait !== first);
  return [first, rng.pick(rest)];
}
